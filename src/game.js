(()=>{
const c=document.getElementById('c'),g=c.getContext('2d',{alpha:false});
let W=0,H=0;
const TAU=Math.PI*2;
const btn={call:{x:0,y:0,r:0,active:0,label:'CALL PUSHER'},brake:{x:0,y:0,r:0,active:0,label:'BRAKE'},act:{x:0,y:0,r:0,active:0,label:'ACTION'}};
const brakePointers=new Set();
let ac=null,master=null;
let mode='title',reason='';
let tNow=0,score=0,best=0,startX=0;
let camX=0,camY=0,hintT=11,rollT=0;
let tutorialStep=0,tutorialTimer=0;
const input={brake:0,call:0,act:0};

const world={
  pts:[{x:-240,y:300},{x:0,y:320}],
  gaps:[],
  pots:[],
  npcs:[],
  lastX:0,lastY:320,
  nextPot:360,nextNpc:280,nextGap:760
};

const player={
  x:80,y:0,vx:0,vy:0,speed:85,
  on:1,ang:0,airY:0,stall:0,
  have:0,boost:0,swerve:0,maxHave:5,potholeDip:0
};

const particles=[];
const textDisplays=[];

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  W=innerWidth;H=innerHeight;
  c.width=Math.floor(W*dpr);c.height=Math.floor(H*dpr);
  g.setTransform(dpr,0,0,dpr,0,0);
  layoutButtons();
}

function layoutButtons(){
  const pad=Math.max(18,Math.min(W,H)*0.03);
  const r=Math.max(42,Math.min(W,H)*0.115);
  const leftPad=pad*1.8;
  const rightPad=pad*1.8;
  const bottomPad=pad*2.2;
  btn.act.x=leftPad+r;btn.act.y=H-bottomPad-r;btn.act.r=r;
  btn.call.x=W-rightPad-r;btn.call.y=H-bottomPad-r;btn.call.r=r;
  btn.brake.x=W-rightPad-r;btn.brake.y=H-bottomPad-r-r*2.2;btn.brake.r=r*0.85;
}

function audioInit(){
  if(ac) return;
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C) return;
  ac=new C();
  master=ac.createGain();
  master.gain.value=0.18;
  master.connect(ac.destination);
}

function tone(freq,dur,type,vol,slide,delay){
  if(!ac) return;
  const now=ac.currentTime+(delay||0);
  const o=ac.createOscillator();
  const v=ac.createGain();
  o.type=type||'sine';
  o.frequency.setValueAtTime(Math.max(40,freq),now);
  if(slide&&slide!==1) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide),now+dur);
  v.gain.setValueAtTime(0.0001,now);
  v.gain.exponentialRampToValueAtTime(vol||0.02,now+0.01);
  v.gain.exponentialRampToValueAtTime(0.0001,now+dur);
  o.connect(v);v.connect(master);
  o.start(now);o.stop(now+dur+0.03);
}

function sfx(name){
  if(name==='boost'){tone(230,0.12,'square',0.05,1.9);tone(430,0.1,'triangle',0.03,0.8,0.03)}
  else if(name==='collect'){tone(520,0.07,'triangle',0.025,1.2)}
  else if(name==='swerve'){tone(310,0.06,'sawtooth',0.02,0.65)}
  else if(name==='hit'){tone(130,0.09,'square',0.04,0.6)}
  else if(name==='crash'){tone(90,0.16,'sawtooth',0.06,0.35);tone(50,0.24,'square',0.05,0.4,0.04)}
  else if(name==='fail'){tone(110,0.16,'triangle',0.04,0.5)}
}

function segAt(x){
  const p=world.pts;
  let lo=0,hi=p.length-2;
  while(lo<=hi){
    const m=(lo+hi)>>1;
    if(x<p[m].x) hi=m-1;
    else if(x>p[m+1].x) lo=m+1;
    else return m;
  }
  return Math.max(0,Math.min(p.length-2,lo));
}

function gapAt(x){
  const a=world.gaps;
  for(let i=0;i<a.length;i++){
    const q=a[i];
    if(x>q.a&&x<q.b) return q;
  }
  return null;
}

function groundY(x){
  if(gapAt(x)) return null;
  const p=world.pts;
  const i=segAt(x);
  const p1=p[i],p2=p[i+1];
  const t=(x-p1.x)/(p2.x-p1.x||1);

  // Catmull-Rom spline for smooth curves
  const p0=p[Math.max(0,i-1)];
  const p3=p[Math.min(p.length-1,i+2)];

  const t2=t*t,t3=t2*t;
  const m1=(p2.y-p0.y)/(p2.x-p0.x||1)*(p2.x-p1.x);
  const m2=(p3.y-p1.y)/(p3.x-p1.x||1)*(p2.x-p1.x);

  return (2*t3-3*t2+1)*p1.y + (t3-2*t2+t)*m1 + (-2*t3+3*t2)*p2.y + (t3-t2)*m2;
}

function slopeAt(x){
  if(gapAt(x)) return 0;
  const p=world.pts;
  const i=segAt(x);
  const p1=p[i],p2=p[i+1];
  const t=(x-p1.x)/(p2.x-p1.x||1);

  // Derivative of Catmull-Rom spline for smooth slope
  const p0=p[Math.max(0,i-1)];
  const p3=p[Math.min(p.length-1,i+2)];

  const dx=p2.x-p1.x||1;
  const m1=(p2.y-p0.y)/(p2.x-p0.x||1)*(p2.x-p1.x);
  const m2=(p3.y-p1.y)/(p3.x-p1.x||1)*(p2.x-p1.x);

  const dydt=(6*t*t-6*t)*p1.y + (3*t*t-4*t+1)*m1 + (-6*t*t+6*t)*p2.y + (3*t*t-2*t)*m2;
  return dydt/dx;
}

function addPoint(x,y){
  world.pts.push({x,y});
  world.lastX=x;world.lastY=y;
}

function spawnEntities(fromX,toX){
  if(toX<=fromX) return;
  let attempts=0;
  while(world.nextPot<toX){
    const x=world.nextPot+(Math.random()*50-25);
    if(x>=fromX&&!gapAt(x)&&Math.abs(slopeAt(x))<0.72) {
      world.pots.push({x,r:14,done:0,dodge:0,flash:0});
      world.nextPot+=180+Math.random()*220;
      attempts=0;
    } else {
      world.nextPot+=30;
      attempts++;
      if(attempts>20) {
        world.nextPot+=180+Math.random()*220;
        attempts=0;
      }
    }
  }
  attempts=0;
  while(world.nextNpc<toX){
    const x=world.nextNpc+(Math.random()*60-30);
    if(x>=fromX&&!gapAt(x)&&Math.abs(slopeAt(x))<0.52) {
      world.npcs.push({x,got:0,wave:Math.random()*TAU});
      world.nextNpc+=250+Math.random()*350;
      attempts=0;
    } else {
      world.nextNpc+=30;
      attempts++;
      if(attempts>20) {
        world.nextNpc+=250+Math.random()*350;
        attempts=0;
      }
    }
  }
}

function ensureWorld(toX){
  const startX=world.lastX;
  while(world.lastX<toX){
    const x0=world.lastX,y0=world.lastY;
    if(x0>world.nextGap&&Math.random()<0.45){
      const approach=80+Math.random()*60;
      const approachSlope=0.22+Math.random()*0.18;
      const x1=x0+approach,y1=y0+approach*approachSlope;
      addPoint(x1,y1);
      const rampLen=60+Math.random()*30;
      const rampSlope=0.35+Math.random()*0.20;
      const x2=x1+rampLen,y2=y1+rampLen*rampSlope;
      addPoint(x2,y2);
      const lipLen=15+Math.random()*10;
      const lipSlope=0.05+Math.random()*0.05;
      const takeoffX=x2+lipLen,takeoffY=y2+lipLen*lipSlope;
      addPoint(takeoffX,takeoffY);
      const gw=140+Math.random()*140;
      world.gaps.push({a:takeoffX,b:takeoffX+gw,btm:takeoffY+220+Math.random()*140});
      const landX=takeoffX+gw;
      const landY=takeoffY+25+Math.random()*35;  
      addPoint(landX,landY);
      const downLen1=40+Math.random()*30;
      const downSlope1=0.08+Math.random()*0.10;
      const down1X=landX+downLen1,down1Y=landY+downLen1*downSlope1;
      addPoint(down1X,down1Y);
      const downLen2=70+Math.random()*60;
      const downSlope2=0.18+Math.random()*0.22;
      const down2X=down1X+downLen2,down2Y=down1Y+downLen2*downSlope2;
      addPoint(down2X,down2Y);
      world.lastX=down2X;world.lastY=down2Y;
      world.nextGap=down2X+600+Math.random()*500; 
    }else{
      const len=80+Math.random()*140;
      const r=Math.random();
      let s=r<0.15?0.02+Math.random()*0.05:r<0.55?0.15+Math.random()*0.35:r<0.85?0.35+Math.random()*0.48:-0.18+Math.random()*0.12;
      const inStartZone=x0<700;
      if(inStartZone&&s<0.05) s=0.15+Math.random()*0.25;
      if(world.lastY<150&&s<0.05) s=0.25+Math.random()*0.3;
      if(world.lastY>560&&s>0.05) s=-0.15+Math.random()*0.12;
      let y=y0+len*s;
      y=Math.max(120,Math.min(620,y));
      addPoint(x0+len,y);
    }
  }
  spawnEntities(startX,toX);
}

function trimWorld(){
  const cut=camX-260;
  while(world.pts.length>4&&world.pts[1].x<cut) world.pts.shift();
  world.gaps=world.gaps.filter(v=>v.b>cut);
  world.pots=world.pots.filter(v=>v.x>cut-80);
  world.npcs=world.npcs.filter(v=>!v.got&&v.x>cut-100||v.got&&player.x-v.x<400);
}

function resetRun(){
  mode='play';reason='';score=0;hintT=11;rollT=0;
  world.pts=[{x:-240,y:300},{x:0,y:320}];
  world.gaps=[];world.pots=[];world.npcs=[];
  world.lastX=0;world.lastY=320;
  world.nextPot=320;world.nextNpc=240;world.nextGap=760;
  player.x=80;player.speed=85;player.vx=0;player.vy=0;player.on=1;player.ang=0;
  player.have=0;player.boost=0;player.swerve=0;player.airY=0;player.stall=0;player.potholeDip=0;
  ensureWorld(player.x+2200);
  const gy=groundY(player.x)||320;
  player.y=gy-16;
  camX=player.x-W*0.33;camY=player.y-H*0.58;
  startX=player.x;
}

function normAng(a){
  while(a>Math.PI) a-=TAU;
  while(a<-Math.PI) a+=TAU;
  return a;
}

function burst(x,y,n,color,speed){
  for(let i=0;i<n;i++){
    const a=Math.random()*TAU,m=(0.2+Math.random())*(speed||160);
    particles.push({x,y,vx:Math.cos(a)*m,vy:Math.sin(a)*m-60,life:0.35+Math.random()*0.45,max:0.35+Math.random()*0.45,r:2+Math.random()*3,col:color||'#d8c7a1'});
  }
}

function endRun(msg,crash){
  if(mode!=='play') return;
  reason=msg;mode='over';
  score=Math.max(0,Math.floor((player.x-startX)/10));
  if(score>best) best=score;
  if(crash){burst(player.x,player.y,26,'#ff9157',260);sfx('crash')}else sfx('fail');
}

function tryAction(){
  if(mode!=='play') return;
  let nearNpc=null,dN=9e9;
  for(let i=0;i<world.npcs.length;i++){
    const n=world.npcs[i];
    if(n.got) continue;
    const d=Math.abs(n.x-player.x);
    if(d<64&&d<dN){nearNpc=n;dN=d;}
  }
  let nearPot=null,dP=9e9;
  for(let i=0;i<world.pots.length;i++){
    const p=world.pots[i];
    if(p.done) continue;
    const d=Math.abs(p.x-player.x);
    if(d<72&&d<dP){nearPot=p;dP=d;}
  }
  if(nearNpc&&(!nearPot||dN<=dP)){
    if(player.have<player.maxHave){
      nearNpc.got=1;player.have++;sfx('collect');
    }
    return;
  }
  if(nearPot){
    nearPot.dodge=1;nearPot.flash=0.22;player.swerve=0.28;
    sfx('swerve');burst(nearPot.x,groundY(nearPot.x)-8,8,'#aad0ef',90);
  }
}

function tryCall(){
  if(mode!=='play') return;
  if(player.have>0&&player.boost<=0){
    player.have--;player.boost=3.2;
    sfx('boost');burst(player.x-15,player.y+8,14,'#ffde94',150);
  }
}

function updatePlay(dt){
  ensureWorld(player.x+W*1.8+900);

  if(input.call){tryCall();input.call=0;}
  if(input.act){tryAction();input.act=0;}

  if(player.boost>0){
    player.boost=Math.max(0,player.boost-dt);
    if(Math.random()<0.7) burst(player.x-20,player.y+7,1,'#ffe68f',90);
    if(Math.random()<0.3) burst(player.x-18,player.y+5,1,'#ffb347',70);
  }

  player.swerve=Math.max(0,player.swerve-dt);
  player.potholeDip=Math.max(0,player.potholeDip-dt*3);

  if(player.on){
    const sl=slopeAt(player.x);
    let acc=sl*380-28;
    if(input.brake) acc-=180;
    if(player.boost>0) acc+=240;
    player.speed+=acc*dt;
    player.speed=Math.max(0,Math.min(520,player.speed));
    player.x+=player.speed*dt;
    const gy=groundY(player.x);
    if(gy==null){
      player.on=0;
      player.vx=Math.max(15,player.speed);
      player.vy=sl*player.speed*0.48;
      player.airY=player.y;
    }else{
      player.y=gy-16;
      player.ang=Math.atan(sl)-(input.brake?0.13:0);
      if(player.speed>55&&Math.random()<0.35) burst(player.x-18,gy-4,1,'#c9ae84',40);
    }
  }else{
    if(input.brake){
      player.vx=Math.max(18,player.vx-140*dt);
      player.ang-=1.8*dt;
    }else player.ang+=0.75*dt;
    if(player.boost>0) player.vx+=60*dt;
    player.vy+=720*dt;
    player.x+=player.vx*dt;
    player.y+=player.vy*dt;

    const q=gapAt(player.x);
    if(q&&player.y>q.btm){endRun('Missed the bridge',0);return;}
    const gy=groundY(player.x);
    if(gy!=null&&player.y>=gy-16){
      const sa=Math.atan(slopeAt(player.x));
      const aErr=Math.abs(normAng(player.ang-sa));
      const hard=player.vy>380||player.y-player.airY>220;
      if(aErr>0.95||hard){endRun('Bad landing',1);return;}
      player.on=1;
      player.y=gy-16;
      player.speed=Math.max(20,player.vx*0.92);
      player.vx=0;player.vy=0;player.ang=sa;
      burst(player.x,gy-3,8,'#d3b082',110);
    }
    if(player.y>camY+H+260){endRun('Could not recover',0);return;}
  }

  for(let i=0;i<world.pots.length;i++){
    const p=world.pots[i];
    if(p.flash>0) p.flash-=dt;
    if(!p.done&&player.x>p.x+8){
      p.done=1;
      const gy=groundY(p.x);
      if(p.dodge){
        if(gy!=null) textDisplays.push({x:p.x,y:gy-40,text:'swerved',time:1.0});
      }else{
        player.speed=Math.max(0,player.speed*0.85-12);
        player.potholeDip=0.35;
        burst(p.x,groundY(p.x)-6,12,'#6e5a3f',140);
        sfx('hit');
        if(gy!=null) textDisplays.push({x:p.x,y:gy-40,text:'oof',time:1.0});
      }
    }
  }

  if(player.on&&player.speed<5) player.stall+=dt;
  else player.stall=0;
  if(player.stall>1.05){endRun('Out of momentum',0);return;}

  score=Math.max(0,Math.floor((player.x-startX)/10));
  camX+=(player.x-W*0.33-camX)*Math.min(1,dt*4.5);
  camY+=(player.y-H*0.58-camY)*Math.min(1,dt*4.2);
  hintT=Math.max(0,hintT-dt);

  rollT-=dt;
  if(rollT<=0&&player.on&&player.speed>30){
    const s=Math.min(1,player.speed/380);
    tone(70+s*65,0.03,'triangle',0.005+s*0.004,0.9);
    rollT=0.06+(1-s)*0.12;
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life-=dt;
    if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=380*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  }

  for(let i=textDisplays.length-1;i>=0;i--){
    const t=textDisplays[i];
    t.time-=dt;
    if(t.time<=0){textDisplays.splice(i,1);continue;}
  }

  trimWorld();
}

function drawChunk(arr){
  if(arr.length<2) return;
  g.beginPath();
  g.moveTo(arr[0][0],arr[0][1]);
  for(let i=1;i<arr.length;i++) g.lineTo(arr[i][0],arr[i][1]);
  const lx=arr[arr.length-1][0],fx=arr[0][0];
  g.lineTo(lx,H+80);g.lineTo(fx,H+80);g.closePath();
  g.fillStyle='#52331b';g.fill();
  g.beginPath();
  g.moveTo(arr[0][0],arr[0][1]);
  for(let i=1;i<arr.length;i++) g.lineTo(arr[i][0],arr[i][1]);
  g.lineJoin='round';g.lineCap='round';
  g.strokeStyle='#7a4e29';g.lineWidth=28;g.stroke();
  g.strokeStyle='#b98a4f';g.lineWidth=4;g.stroke();
}

function drawWorld(){
  const left=camX-90,right=camX+W+90,step=6;
  const path=[];
  for(let x=left;x<=right;x+=step){
    const y=groundY(x);
    if(y==null){drawChunk(path);path.length=0;continue;}
    path.push([x-camX,y-camY]);
    const n=groundY(x+step);
    if(n==null||x+step>right){drawChunk(path);path.length=0;}
  }

  for(let i=0;i<world.gaps.length;i++){
    const q=world.gaps[i];
    if(q.b<left||q.a>right) continue;
    const x1=q.a-camX,x2=q.b-camX;
    const y1=(groundY(q.a)||q.btm)-camY;
    const y2=(groundY(q.b)||q.btm)-camY;
    g.fillStyle='#2d1c12';
    g.fillRect(x1,Math.min(y1,y2)+60,x2-x1,H);
    g.strokeStyle='#a7773f';
    g.lineWidth=5;
    g.beginPath();
    g.moveTo(x1,y1-7);
    g.lineTo(x1,y1+60); 
    g.stroke();
    g.beginPath();
    g.moveTo(x2,y2-7);
    g.lineTo(x2,y2+60); 
    g.stroke();
  }

  for(let i=0;i<world.pots.length;i++){
    const p=world.pots[i],sx=p.x-camX;
    if(sx<-40||sx>W+40) continue;
    const gy=groundY(p.x);if(gy==null) continue;
    const sy=gy-camY+6;
    g.fillStyle=p.flash>0?'#6cb2e6':'#2a1f17';
    g.beginPath();g.ellipse(sx,sy,p.r,p.r*0.56,0,0,TAU);g.fill();
  }


  // Draw standing NPCs
  for(let i=0;i<world.npcs.length;i++){
    const n=world.npcs[i];
    if(n.got) continue;
    const sx=n.x-camX;
    if(sx<-40||sx>W+40) continue;
    const gy=groundY(n.x);if(gy==null) continue;
    const sy=gy-camY;
    const wave=Math.sin(tNow*4+n.wave)*2;
    g.strokeStyle='#efe4ce';g.lineWidth=3;g.lineCap='round';
    g.beginPath();
    g.moveTo(sx,sy-8);g.lineTo(sx,sy-27);
    g.lineTo(sx+6+wave,sy-18);
    g.moveTo(sx,sy-23);g.lineTo(sx-6,sy-14);
    g.moveTo(sx,sy-8);g.lineTo(sx-5,sy+6);g.moveTo(sx,sy-8);g.lineTo(sx+5,sy+6);
    g.stroke();
    g.fillStyle='#efe4ce';g.beginPath();g.arc(sx,sy-31,4,0,TAU);g.fill();
  }
}

function drawBuggy(){
  const sx=player.x-camX;
  let sy=player.y-camY;
  if(player.swerve>0) sy+=Math.sin(tNow*46)*(1+player.swerve*7);

  const gy=groundY(player.x);
  if(gy!=null){
    const sh=Math.max(0,Math.min(1,(gy-player.y)/180));
    g.fillStyle='rgba(0,0,0,'+(0.14+0.2*sh).toFixed(3)+')';
    g.beginPath();g.ellipse(sx,gy-camY+10,20+sh*10,6+sh*2,0,0,TAU);g.fill();
  }

  if(player.boost>0){
    const py=(groundY(player.x-40)||player.y+12)-camY;
    const runPhase=tNow*8;
    const legLift=Math.abs(Math.sin(runPhase))*6;
    const legBack=Math.sin(runPhase)*3;
    g.strokeStyle='#f7d58d';g.lineWidth=3;g.lineCap='round';
    g.beginPath();
    g.moveTo(sx-40,py-8);g.lineTo(sx-40,py-36);
    g.moveTo(sx-40,py-28);g.lineTo(sx-40+6,py-24);
    g.moveTo(sx-40,py-30);g.lineTo(sx-40-6,py-22);
    g.moveTo(sx-40,py-8);g.lineTo(sx-40+2+legBack,py-4+legLift);
    g.moveTo(sx-40,py-8);g.lineTo(sx-40-2-legBack,py-4-legLift);
    g.stroke();
    g.fillStyle='#f7d58d';g.beginPath();g.arc(sx-40,py-40,4,0,TAU);g.fill();
  }

  if(player.have>0){
    const headY=sy-28+Math.sin(tNow*3)*2;
    const spacing=8;
    const startX=sx-(player.have-1)*spacing*0.5;
    for(let i=0;i<player.have;i++){
      const hx=startX+i*spacing;
      const hy=headY+Math.sin(tNow*4+i*0.8)*1.5;
      g.fillStyle='#b8e6ff';g.beginPath();g.arc(hx,hy,2.5,0,TAU);g.fill();
    }
  }

  g.save();
  g.translate(sx,sy);
  let nodAngle=0;
  if(player.potholeDip>0){
    const dipT=player.potholeDip/0.35;
    nodAngle=Math.sin(dipT*Math.PI)*0.18;
  }
  g.rotate(player.ang+nodAngle);

  g.fillStyle='#302720';
  g.fillRect(-28,-4,56,8);
  g.beginPath();g.arc(-20,6,5,0,TAU);g.arc(20,6,5,0,TAU);g.fill();
  g.fillStyle='#4a3a2a';
  g.fillRect(-18,-6,36,6);
  g.strokeStyle='#1a1a1a';
  g.lineWidth=2.5;
  g.beginPath();
  g.moveTo(-20,-6);
  g.lineTo(-24,-18);
  g.stroke();
  g.fillStyle='#cc0000';
  g.beginPath();g.arc(-24,-18,2,0,TAU);g.fill();
  g.fillStyle='#ffe9c6';
  g.fillRect(22,-2,6,4);

  g.restore();
}

function drawParticles(){
  for(let i=0;i<particles.length;i++){
    const p=particles[i],a=Math.max(0,p.life/p.max);
    g.globalAlpha=a;
    g.fillStyle=p.col;
    g.beginPath();g.arc(p.x-camX,p.y-camY,p.r,0,TAU);g.fill();
  }
  g.globalAlpha=1;
}

function drawHud(){
  g.fillStyle='rgba(0,0,0,.3)';
  g.fillRect(12,12,240,56);
  g.fillStyle='#fff';
  g.font='700 18px system-ui,sans-serif';
  g.fillText('DIST '+score+' m',20,34);
  g.font='600 13px system-ui,sans-serif';
  g.fillText('BEST '+best+' m',20,53);

  const v=Math.min(1,player.speed/420);
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(265,18,170,16);
  g.fillStyle=v>.67?'#67e18f':v>.34?'#ffd36a':'#ff8c5a';g.fillRect(267,20,166*v,12);
  g.strokeStyle='rgba(255,255,255,.4)';g.strokeRect(265,18,170,16);

  if(hintT>0){
    const a=Math.min(1,hintT)*Math.min(1,tNow*0.7);
    g.globalAlpha=a;
    g.fillStyle='rgba(0,0,0,.45)';g.fillRect(W*0.5-230,H*0.08,460,56);
    g.fillStyle='#fff';g.font='600 14px system-ui,sans-serif';
    g.fillText('ACTION: collect pushers (max 5) / dodge potholes   A: call pusher   S or Down: brake',W*0.5-214,H*0.08+34);
    g.globalAlpha=1;
  }
}

function drawButton(b,key){
  const active=(key==='brake'?input.brake:b.active>0);
  const disabled=key==='call'&&player.have===0;
  g.globalAlpha=disabled?0.3:active?0.9:0.62;
  g.fillStyle=disabled?'#666':key==='brake'?'#f06a4f':key==='call'?'#2e91d8':'#6fbf4f';
  g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
  g.strokeStyle=disabled?'rgba(255,255,255,.4)':'rgba(255,255,255,.85)';g.lineWidth=3;g.stroke();
  g.globalAlpha=1;
  g.fillStyle=disabled?'#999':'#fff';
  g.textAlign='center';
  g.font='700 '+Math.max(11,b.r*0.22)+'px system-ui,sans-serif';
  g.fillText(b.label,b.x,b.y+4);
}

function render(){
  const sky=g.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#6fb6ff');
  sky.addColorStop(1,'#e7c78f');
  g.fillStyle=sky;g.fillRect(0,0,W,H);

  g.fillStyle='rgba(255,255,255,.18)';
  for(let i=0;i<5;i++){
    const x=((i*260-(camX*0.2)%1300)+1300)%1300-120;
    const y=80+Math.sin(i+tNow*0.08)*16;
    g.beginPath();g.ellipse(x,y,72,24,0,0,TAU);g.fill();
  }

  g.fillStyle='#6d8a53';
  g.beginPath();
  g.moveTo(0,H*0.72);
  for(let x=0;x<=W+40;x+=40){
    const yy=H*0.72+Math.sin((x+camX*0.35)*0.004)*30+Math.sin((x+camX*0.17)*0.007)*22;
    g.lineTo(x,yy);
  }
  g.lineTo(W,H+20);g.lineTo(0,H+20);g.closePath();g.fill();

  drawWorld();
  drawParticles();

  if(mode!=='title') drawBuggy();

  for(let i=0;i<textDisplays.length;i++){
    const t=textDisplays[i];
    const sx=t.x-camX;
    const sy=t.y-camY;
    if(sx<-100||sx>W+100||sy<-100||sy>H+100) continue;
    const alpha=Math.min(1,t.time);
    g.globalAlpha=alpha;
    g.fillStyle='#fff';
    g.font='800 '+(32+Math.sin(tNow*8)*2)+'px system-ui,sans-serif';
    g.textAlign='center';
    g.strokeStyle='rgba(0,0,0,0.6)';
    g.lineWidth=6;
    g.strokeText(t.text,sx,sy);
    g.fillText(t.text,sx,sy);
    g.textAlign='left';
  }
  g.globalAlpha=1;

  if(mode==='play') drawHud();

  drawButton(btn.call,'call');
  drawButton(btn.brake,'brake');
  drawButton(btn.act,'act');
  g.textAlign='left';

  if(mode==='title'){
    g.textAlign='center';
    if(tutorialStep===0){
      g.fillStyle='#fff';
      g.font='800 '+Math.max(42,W*0.07)+'px system-ui,sans-serif';
      g.fillText('BUGGY ON',W*0.5,H*0.4);
      g.font='600 '+Math.max(20,W*0.035)+'px system-ui,sans-serif';
      g.fillText('CMU Tradition on Flagstaff Hill',W*0.5,H*0.48);
    }else if(tutorialStep===1){
      g.font='600 14px system-ui,sans-serif';
      const text='You can hold up to 5 pushers at once';
      const m=g.measureText(text);
      const pad=24;
      const boxW=m.width+pad*2;
      const boxH=50+pad*2;
      const boxX=W*0.5-boxW*0.5;
      const boxY=H*0.5-boxH*0.5;
      g.fillStyle='rgba(0,0,0,.46)';g.fillRect(boxX,boxY,boxW,boxH);
      g.fillStyle='#fff';
      g.fillText(text,W*0.5,boxY+boxH*0.5+5);
      player.have=5;
      drawBuggy();
      player.have=0;
    }else if(tutorialStep===2){
      g.font='600 14px system-ui,sans-serif';
      const text='Click to activate a pusher when you need a boost';
      const m=g.measureText(text);
      const pad=24;
      const boxW=m.width+pad*2;
      const boxH=50+pad*2;
      const boxX=W*0.5-boxW*0.5;
      const boxY=H*0.5-boxH*0.5;
      g.fillStyle='rgba(0,0,0,.46)';g.fillRect(boxX,boxY,boxW,boxH);
      g.fillStyle='#fff';
      g.fillText(text,W*0.5,boxY+boxH*0.5+5);
      const bx=btn.call.x,by=btn.call.y,br=btn.call.r;
      g.strokeStyle='#ffe08f';g.lineWidth=4;
      g.beginPath();g.arc(bx,by,br+8,0,TAU);g.stroke();
      g.beginPath();g.moveTo(W*0.5,boxY+boxH);g.lineTo(bx,by-br-8);
      g.lineTo(bx-8,by-br);g.moveTo(bx,by-br-8);g.lineTo(bx+8,by-br);
      g.stroke();
    }else if(tutorialStep===3){
      g.font='600 14px system-ui,sans-serif';
      const text='Use this to either 1 dodge potholes or 2 pick up pushers';
      const m=g.measureText(text);
      const pad=24;
      const boxW=m.width+pad*2;
      const boxH=50+pad*2;
      const boxX=W*0.5-boxW*0.5;
      const boxY=H*0.5-boxH*0.5;
      g.fillStyle='rgba(0,0,0,.46)';g.fillRect(boxX,boxY,boxW,boxH);
      g.fillStyle='#fff';
      g.fillText(text,W*0.5,boxY+boxH*0.5+5);
      const bx=btn.act.x,by=btn.act.y,br=btn.act.r;
      g.strokeStyle='#ffe08f';g.lineWidth=4;
      g.beginPath();g.arc(bx,by,br+8,0,TAU);g.stroke();
      g.beginPath();g.moveTo(W*0.5,boxY+boxH);g.lineTo(bx,by-br-8);
      g.lineTo(bx-8,by-br);g.moveTo(bx,by-br-8);g.lineTo(bx+8,by-br);
      g.stroke();
    }else if(tutorialStep===4){
      g.font='600 14px system-ui,sans-serif';
      const text='Hope you know what this one does';
      const m=g.measureText(text);
      const pad=24;
      const boxW=m.width+pad*2;
      const boxH=50+pad*2;
      const boxX=W*0.5-boxW*0.5;
      const boxY=H*0.5-boxH*0.5;
      g.fillStyle='rgba(0,0,0,.46)';g.fillRect(boxX,boxY,boxW,boxH);
      g.fillStyle='#fff';
      g.fillText(text,W*0.5,boxY+boxH*0.5+5);
      const bx=btn.brake.x,by=btn.brake.y,br=btn.brake.r;
      g.strokeStyle='#ffe08f';g.lineWidth=4;
      g.beginPath();g.arc(bx,by,br+8,0,TAU);g.stroke();
      g.beginPath();g.moveTo(W*0.5,boxY+boxH);g.lineTo(bx,by-br-8);
      g.lineTo(bx-8,by-br);g.moveTo(bx,by-br-8);g.lineTo(bx+8,by-br);
      g.stroke();
    }else{
      g.font='600 14px system-ui,sans-serif';
      const lines=['Looks like all of Pittsburgh\'s 446 bridges are down too,','so you\'ll have to jump them!','If you run out of speed or you crash, run ends.'];
      let maxW=0;
      for(let i=0;i<lines.length;i++){
        const w=g.measureText(lines[i]).width;
        if(w>maxW) maxW=w;
      }
      const pad=24;
      const boxW=maxW+pad*2;
      const boxH=lines.length*22+pad*2;
      const boxX=W*0.5-boxW*0.5;
      const boxY=H*0.5-boxH*0.5-40;
      g.fillStyle='rgba(0,0,0,.46)';g.fillRect(boxX,boxY,boxW,boxH);
      g.fillStyle='#fff';
      for(let i=0;i<lines.length;i++){
        g.fillText(lines[i],W*0.5,boxY+pad+18+i*22);
      }
      g.fillStyle='#ffe08f';g.font='800 24px system-ui,sans-serif';
      g.fillText('TAP TO START',W*0.5,boxY+boxH+50+Math.sin(tNow*4)*4);
    }
    g.textAlign='left';
  }

  if(mode==='over'){
    g.fillStyle='rgba(0,0,0,.52)';g.fillRect(W*0.5-215,H*0.2,430,240);
    g.fillStyle='#fff';g.textAlign='center';
    g.font='800 42px system-ui,sans-serif';g.fillText('RUN OVER',W*0.5,H*0.31);
    g.font='700 22px system-ui,sans-serif';g.fillText(score+' m',W*0.5,H*0.39);
    g.font='600 16px system-ui,sans-serif';g.fillText(reason,W*0.5,H*0.45);
    g.font='700 20px system-ui,sans-serif';g.fillStyle='#ffe08f';g.fillText('TAP TO RETRY',W*0.5,H*0.55+Math.sin(tNow*6)*3);
    g.fillStyle='#fff';g.font='600 14px system-ui,sans-serif';g.fillText('A: retry | Collect multiple pushers and save them for big gaps',W*0.5,H*0.62);
    g.textAlign='left';
  }

  if(H>W){
    g.fillStyle='rgba(0,0,0,.7)';g.fillRect(0,0,W,H);
    g.fillStyle='#fff';g.textAlign='center';
    g.font='800 32px system-ui,sans-serif';g.fillText('Rotate Device',W*0.5,H*0.46);
    g.font='600 18px system-ui,sans-serif';g.fillText('Buggy Downhill is landscape',W*0.5,H*0.53);
    g.textAlign='left';
  }

  btn.call.active=Math.max(0,btn.call.active-1/60);
  btn.act.active=Math.max(0,btn.act.active-1/60);
}

function update(dt){
  tNow+=dt;
  if(mode==='play'&&W>=H) updatePlay(dt);
  else{
    if(mode==='title'){
      tutorialTimer+=dt;
      if(tutorialTimer>=2&&tutorialStep<5) tutorialStep++,tutorialTimer=0;
    }
    ensureWorld(player.x+W+1200);
    const gy=groundY(player.x)||320;
    camX+=(player.x-W*0.33-camX)*Math.min(1,dt*3.2);
    camY+=(gy-16-H*0.58-camY)*Math.min(1,dt*3);
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.life-=dt;
      if(p.life<=0) particles.splice(i,1);
      else{p.vy+=380*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
    }
  }
}

function keyDown(e){
  if(e.repeat&&(e.key==='a'||e.key==='A'||e.key===' '||e.key==='ArrowUp')) return;
  if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') input.brake=1;
  if((e.key==='a'||e.key==='A')&&player.have>0){input.call=1;btn.call.active=0.18;audioInit()}
  if(e.key===' '||e.key==='ArrowUp'){input.act=1;btn.act.active=0.18;audioInit()}
  if((e.key==='Enter'||e.key==='r'||e.key==='R')&&mode!=='play'){audioInit();resetRun();}
  if((e.key===' '||e.key==='ArrowUp')&&mode!=='play'){audioInit();resetRun();}
  if(['ArrowDown','ArrowUp',' '].includes(e.key)) e.preventDefault();
}

function keyUp(e){
  if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') input.brake=0;
}

function hitButton(x,y){
  for(const k of ['call','brake','act']){
    const b=btn[k],dx=x-b.x,dy=y-b.y;
    if(dx*dx+dy*dy<=b.r*b.r) return k;
  }
  return '';
}

function pointerDown(e){
  audioInit();
  const k=hitButton(e.clientX,e.clientY);
  if(mode==='title'){
    if(tutorialStep<5){
      tutorialStep++;
      tutorialTimer=0;
    }else{
      resetRun();
    }
    e.preventDefault();
    return;
  }
  if(mode!=='play'){
    resetRun();
    e.preventDefault();
    return;
  }
  if(k==='brake'){brakePointers.add(e.pointerId);input.brake=1;}
  else if(k==='call'&&player.have>0){input.call=1;btn.call.active=0.18;}
  else if(k==='act'){input.act=1;btn.act.active=0.18;}
  e.preventDefault();
}

function pointerUp(e){
  if(brakePointers.delete(e.pointerId)) input.brake=brakePointers.size>0?1:0;
}

function loop(ms){
  const dt=Math.min(0.033,(ms-(loop.t||ms))*0.001);loop.t=ms;
  update(dt);render();
  requestAnimationFrame(loop);
}

addEventListener('resize',resize);
addEventListener('keydown',keyDown,{passive:false});
addEventListener('keyup',keyUp);
c.addEventListener('pointerdown',pointerDown,{passive:false});
c.addEventListener('pointerup',pointerUp);
c.addEventListener('pointercancel',pointerUp);
c.addEventListener('pointerleave',pointerUp);
resize();
ensureWorld(2200);
player.y=(groundY(player.x)||320)-16;
camX=player.x-W*0.33;camY=player.y-H*0.58;
requestAnimationFrame(loop);
})();
