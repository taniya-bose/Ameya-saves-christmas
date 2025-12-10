
/* ===== Config ===== */
const PLAYER_IMAGE_SRC = 'ameya_head-removebg-preview.png'; // place this file next to index.html
const TOTAL_CANDY = 5, TOTAL_TIME = 90;
const GRAVITY = 0.48, FRICTION = 0.88, RUN_SPEED = 0.9, JUMP_POWER = 10.5;
const COYOTE_FRAMES = 10, MAX_DOUBLE_JUMP = 1;
const SPRITE_SCALE_ADJ = 1.08, SPRITE_Y_ADJ = 2; // adjust if needed

/* ===== DOM ===== */
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const scorePill = $('scorePill'), scoreEl = $('score'), timeEl = $('time'), bestEl = $('best');
const overlayStart = $('overlayStart'), overlayPause = $('overlayPause'), overlayWin = $('overlayWin'), overlayLose = $('overlayLose'), finalTimeEl = $('finalTime');
const btnPause = $('btnPause'), btnReset = $('btnReset'), btnLeft = $('btnLeft'), btnRight = $('btnRight'), btnJump = $('btnJump');

/* ===== State ===== */
let player, platforms, spikes, candies, reindeer;
let running=false, paused=false, timer=null, timeLeft=TOTAL_TIME, best=Number(localStorage.getItem('xmas_best')||0);
let checkpoint = { x:30, y:460 }, collectedCount=0;
const keys={};

/* ===== Visuals ===== */
const snowflakes=[...Array(120)].map(()=>({x:Math.random()*960,y:Math.random()*540,r:Math.random()*2+0.6,s:Math.random()*0.6+0.3}));
let phase=0;

/* ===== SFX ===== */
let audioCtx=null;
function bell(d=0.15,f=880){ try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0.0,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0.2,audioCtx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+d); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+d+0.02);}catch(e){} }

/* ===== Helpers ===== */
function rect(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function drawText(t,x,y,c="#eaf3ff",size=16){ ctx.fillStyle=c; ctx.font=`${size}px system-ui`; ctx.fillText(t,x,y); }
function collide(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

/* ===== Level ===== */
let leftWall, rightWall;
function makeLevel(){
  platforms=[{x:0,y:500,w:960,h:40},{x:0,y:420,w:260,h:18},{x:290,y:380,w:140,h:18},{x:460,y:340,w:180,h:18},{x:670,y:300,w:180,h:18},{x:860,y:260,w:120,h:18},{x:80,y:260,w:130,h:18},{x:250,y:220,w:110,h:18},{x:390,y:190,w:110,h:18},{x:550,y:160,w:120,h:18}];
  spikes=[{x:370,y:488,w:70,h:12},{x:760,y:288,w:40,h:12}];
  candies=[{x:210,y:390},{x:470,y:320},{x:680,y:270},{x:120,y:230},{x:560,y:130}];
  reindeer={x:900,y:220,w:40,h:30};
  leftWall={x:-2,y:0,w:10,h:540}; rightWall={x:952,y:0,w:10,h:540};
}

/* ===== Player sprite ===== */
let playerImg=null, playerImgReady=false, playerScale=1, playerOffsetY=0;
function loadPlayerImage(){
  const img=new Image();
  img.onload=()=>{
    playerImg=img; playerImgReady=true;
    const s=Math.min(player.w/img.width, player.h/img.height);
    playerScale=s*SPRITE_SCALE_ADJ;
    playerOffsetY=player.h - img.height*s + SPRITE_Y_ADJ;
  };
  img.onerror=()=>{ console.warn('Image load failed, using fallback sprite.'); playerImgReady=false; };
  img.src=PLAYER_IMAGE_SRC;
}

/* ===== Scoring effects ===== */
const pops=[], confetti=[];
function spawnScorePop(x,y){ pops.push({x,y,life:1.0,vy:-0.6}); }
function spawnConfetti(x,y){ for(let i=0;i<18;i++){ confetti.push({x,y,vx:(Math.random()*2-1)*2.2,vy:(Math.random()*2-1)*2.0-0.4,life:0.9,color:['#ff4d4d','#ffd166','#7dd3fc','#3fb950'][i%4]}); } }
function updateEffects(){ for(const p of pops){ p.y+=p.vy; p.life-=0.02; } for(let i=pops.length-1;i>=0;i--) if(pops[i].life<=0) pops.splice(i,1); for(const c of confetti){ c.vy+=0.05; c.x+=c.vx; c.y+=c.vy; c.life-=0.02; } for(let i=confetti.length-1;i>=0;i--) if(confetti[i].life<=0) confetti.splice(i,1); }
function drawEffects(){ for(const p of pops){ ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,p.life)); ctx.fillStyle='#ffd166'; ctx.font='bold 18px system-ui'; ctx.fillText('+1',p.x,p.y); ctx.restore(); } for(const c of confetti){ ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,c.life)); ctx.fillStyle=c.color; ctx.fillRect(c.x,c.y,3,3); ctx.restore(); } }

/* ===== Lifecycle ===== */
function fullReset(){
  player={x:30,y:460,w:24,h:32,vx:0,vy:0,onGround:false,coyote:0,doubleLeft:MAX_DOUBLE_JUMP,facing:1};
  collectedCount=0; makeLevel(); timeLeft=TOTAL_TIME;
  scoreEl.textContent=0; timeEl.textContent=timeLeft;
  paused=false; running=false; clearInterval(timer);
  overlayStart.hidden=false; overlayWin.hidden=true; overlayLose.hidden=true; overlayPause.hidden=true;
  bestEl.textContent=best;
  loadPlayerImage(); draw();
}
function respawn(){ player.x=checkpoint.x; player.y=checkpoint.y; player.vx=0; player.vy=0; player.onGround=false; player.coyote=COYOTE_FRAMES; player.doubleLeft=MAX_DOUBLE_JUMP; }
function start(){ if(running) return; running=true; overlayStart.hidden=true; timer=setInterval(()=>{ if(!paused){ timeLeft--; timeEl.textContent=timeLeft; if(timeLeft<=0) gameLose(); } },1000); requestAnimationFrame(loop); }
function pauseToggle(){ if(!running) return; paused=!paused; overlayPause.hidden=!paused; if(!paused) requestAnimationFrame(loop); }
function gameWin(){ running=false; clearInterval(timer); finalTimeEl.textContent=timeLeft; overlayWin.hidden=false; bell(0.2,1046); setTimeout(()=>bell(0.2,1318),140); if(timeLeft>best){ best=timeLeft; localStorage.setItem('xmas_best',best); bestEl.textContent=best; } }
function gameLose(){ running=false; clearInterval(timer); overlayLose.hidden=false; }
function loop(){ if(!running||paused) return; update(); draw(); requestAnimationFrame(loop); }

/* ===== Update ===== */
function update(){
  if(keys['ArrowLeft']||keys['a']){ player.vx-=RUN_SPEED; player.facing=-1; }
  if(keys['ArrowRight']||keys['d']){ player.vx+=RUN_SPEED; player.facing=1; }
  player.vx*=FRICTION; player.vy+=GRAVITY;

  player.x+=player.vx;
  for(const p of platforms){ if(collide(player,p)){ if(player.vx>0) player.x=p.x-player.w; if(player.vx<0) player.x=p.x+p.w; player.vx=0; } }
  for(const wall of [leftWall,rightWall]){ if(collide(player,wall)){ if(player.vx>0 && wall===rightWall) player.x=wall.x-player.w; if(player.vx<0 && wall===leftWall) player.x=wall.x+wall.w; player.vx=0; } }

  player.y+=player.vy; player.onGround=false;
  for(const p of platforms){ if(collide(player,p)){ if(player.vy>0){ player.y=p.y-player.h; player.vy=0; player.onGround=true; player.coyote=COYOTE_FRAMES; player.doubleLeft=MAX_DOUBLE_JUMP; checkpoint={x:player.x,y:player.y}; } else if(player.vy<0){ player.y=p.y+p.h; player.vy=0; } } }
  if(!player.onGround) player.coyote=Math.max(0,player.coyote-1);

  for(const s of spikes){ if(collide(player,s)) respawn(); }
  if(player.y>540) respawn();

  candies=candies.filter(c=>{
    const hit=Math.abs(player.x+player.w/2-c.x)<16 && Math.abs(player.y+player.h/2-c.y)<16;
    if(hit){
      collectedCount++; scoreEl.textContent=collectedCount;
      timeLeft=Math.min(TOTAL_TIME,timeLeft+2); timeEl.textContent=timeLeft;
      bell(0.15,987);
      spawnScorePop(player.x+player.w/2, player.y-8);
      spawnConfetti(player.x+player.w/2, player.y+player.h/2);
      scorePill.classList.remove('pulse'); void scorePill.offsetWidth; scorePill.classList.add('pulse');
    }
    return !hit;
  });

  if(candies.length===0 && collide(player,reindeer)) gameWin();

  phase+=0.02; updateEffects();
}

/* ===== Draw ===== */
function drawAurora(){ const t=phase; const g=ctx.createLinearGradient(0,0,960,0); g.addColorStop(0,`rgba(121,237,255,${0.06+Math.sin(t)*0.03})`); g.addColorStop(1,`rgba(255,150,200,${0.04+Math.cos(t*0.7)*0.03})`); ctx.fillStyle=g; ctx.fillRect(0,0,960,160); }
function drawSnow(){ ctx.fillStyle='#0b1626'; ctx.fillRect(0,0,960,540); drawAurora(); for(const s of snowflakes){ ctx.fillStyle='rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); s.y+=s.s; s.x+=Math.sin(phase+s.y*0.01)*0.15; if(s.y>540){ s.y=-4; s.x=Math.random()*960; } } }
function drawLightsStrip(x,y,w,spacing=18){ for(let i=0;i<w;i+=spacing){ const n=(i/spacing+Math.floor(phase*10))%4; const colors=['#ff4d4d','#ffd166','#7dd3fc','#3fb950']; ctx.fillStyle=colors[n]; ctx.beginPath(); ctx.arc(x+i,y,3.2,0,Math.PI*2); ctx.fill(); } }

function draw(){
  drawSnow();

  for(const wall of [leftWall,rightWall]){
    rect(wall.x,wall.y,wall.w,wall.h,'#20344f');
    ctx.fillStyle='#284462'; ctx.fillRect(wall.x,wall.y,wall.w,12);
    for(let y=80;y<=480;y+=80){ ctx.fillRect(wall.x,y,wall.w,8); }
    const cx=wall===leftWall?wall.x+wall.w-2:wall.x+2;
    for(const ly of [40,120,200,280,360,440]) drawLightsStrip(cx,ly,1,1);
  }

  for(const p of platforms){ rect(p.x,p.y,p.w,p.h,'#244466'); ctx.fillStyle='#2e5985'; ctx.fillRect(p.x,p.y,p.w,6); drawLightsStrip(p.x+6,p.y+4,p.w-12); }
  for(const s of spikes){ ctx.fillStyle='#5ec6ff'; for(let i=0;i<s.w;i+=10){ ctx.beginPath(); ctx.moveTo(s.x+i,s.y+s.h); ctx.lineTo(s.x+i+5,s.y); ctx.lineTo(s.x+i+10,s.y+s.h); ctx.closePath(); ctx.fill(); } }

  ctx.fillStyle='#a32727'; rect(reindeer.x-36,reindeer.y+8,36,14,'#a32727');
  ctx.fillStyle='#8b5a2b'; rect(reindeer.x-30,reindeer.y+20,32,6,'#8b5a2b');
  ctx.fillStyle='#a36b3a'; rect(reindeer.x,reindeer.y,reindeer.w,reindeer.h,'#a36b3a');
  ctx.fillStyle='#40220f'; rect(reindeer.x+12,reindeer.y-6,18,8,'#40220f');
  drawText('🦌', reindeer.x+8, reindeer.y+24, '#fff', 20);

  const tx=860, ty=180;
  ctx.fillStyle='#2e6b3a';
  ctx.beginPath(); ctx.moveTo(tx+40,ty); ctx.lineTo(tx,ty+60); ctx.lineTo(tx+80,ty+60); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx+40,ty+50); ctx.lineTo(tx-20,ty+120); ctx.lineTo(tx+100,ty+120); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx+40,ty+110); ctx.lineTo(tx-40,ty+180); ctx.lineTo(tx+120,ty+180); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#8b5a2b'; ctx.fillRect(tx+34,ty+180,12,16);
  ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(tx+40,ty-6,6,0,Math.PI*2); ctx.fill();
  drawLightsStrip(tx+10,ty+70,60,16); drawLightsStrip(tx,ty+130,80,16);

  // Player
  if(playerImgReady && playerImg){
    ctx.save();
    const drawX=player.x + (player.facing===-1 ? player.w : 0);
    ctx.translate(drawX, player.y + playerOffsetY);
    ctx.scale(player.facing===-1 ? -playerScale : playerScale, playerScale);
    ctx.drawImage(playerImg,0,0);
    ctx.restore();
  }else{
    rect(player.x,player.y,player.w,player.h,'#7dd3fc');
    ctx.fillStyle='#fff'; ctx.fillRect(player.x+5,player.y+6,10,6);
  }
  drawText('Ameya', player.x-6, player.y-8, '#eaf3ff', 12);

  drawEffects();
  drawText('🎄 Collect 5 candy canes → reach the sleigh & reindeer! (Double jump + coyote time)', 20, 30, '#eaf3ff', 16);
}

/* ===== Jump ===== */
function tryJump(){ const canGround=player.onGround||player.coyote>0; if(canGround){ player.vy=-JUMP_POWER; player.onGround=false; player.coyote=0; player.doubleLeft=MAX_DOUBLE_JUMP; return; } if(player.doubleLeft>0){ player.vy=-JUMP_POWER*0.9; player.doubleLeft--; } }

/* ===== Input ===== */
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(!running && (k==='enter'||k==='arrowleft'||k==='arrowright'||k==='a'||k==='d'||k===' '||k==='w'||k==='x')) start();
  if(k==='p') pauseToggle();
  if(k==='r'){ fullReset(); start(); }
  keys[e.key]=true;
  if([' ','space','w','x'].includes(k)) tryJump();
});
window.addEventListener('keyup', e=>{ keys[e.key]=false; });
canvas.addEventListener('pointerdown', ()=>{ if(!running) start(); });

btnPause.onclick=()=>pauseToggle();
btnReset.onclick=()=>{ fullReset(); start(); };
btnLeft.onmousedown=()=>{ keys['ArrowLeft']=true; }; btnLeft.onmouseup=()=>{ keys['ArrowLeft']=false; };
btnRight.onmousedown=()=>{ keys['ArrowRight']=true; }; btnRight.onmouseup=()=>{ keys['ArrowRight']=false; };
btnJump.onclick=()=>tryJump();

/* ===== Boot ===== */
fullReset();
