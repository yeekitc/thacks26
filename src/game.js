(()=>{
const c=document.getElementById('c'),g=c.getContext('2d',{alpha:false});
let W=0,H=0;
const ZOOM=0.81;
const PUSHER_RUN=0.5;
const TAU=Math.PI*2;
const GEN={
  pot:{start:920,min:780,max:1280,jitter:36,step:42,maxTries:18,clear:220,maxSlope:0.55,gapPad:90},
  npc:{start:340,min:430,max:860,jitter:48,step:36,maxTries:20,clear:190,maxSlope:0.42,gapPad:95},
  bridge:{
    start:1550,chance:0.20,min:1700,max:2900,
    approachLen:[130,220],approachSlope:[0.10,0.18],
    rampLen:[70,115],rampSlope:[0.22,0.32],
    lipLen:[20,34],lipSlope:[0.03,0.08],
    width:[120,220],btmDrop:[220,360],landDrop:[18,32],
    settleLen1:[110,180],settleSlope1:[0.06,0.14],
    settleLen2:[180,280],settleSlope2:[0.12,0.20]
  },
  terrain:{lenMin:150,lenMax:275,min:0.12,max:0.85,flatCut:0.30,flatLimit:0,topSoft:140,botSoft:600}
};
const btn={call:{x:0,y:0,r:0,active:0,label:'CALL PUSHER'},brake:{x:0,y:0,r:0,active:0,label:'BRAKE'},act:{x:0,y:0,r:0,active:0,label:'ACTION',disabled:true}};
const brakePointers=new Set();
let actPulse=0; // expanding ring timer when action becomes available
const btnFloats=[]; // floating text items rising from action button
let ac=null,master=null;
let mode='title',reason='';
let tNow=0,score=0,best=0,startX=0,newBest=0;
let camX=0,camY=0,rollT=0;
let tutorialStep=0,tutorialTimer=0;
const input={brake:0,call:0,act:0};

const world={
  pts:[{x:-240,y:300},{x:0,y:320}],
  gaps:[],
  pots:[],
  npcs:[],
  lastX:0,lastY:320,
  nextPot:GEN.pot.start,nextNpc:GEN.npc.start,nextGap:GEN.bridge.start,
  terrain:{slope:0.32,target:0.40,hold:0,flat:0,mode:'flow',modeLeft:0}
};

const player={
  x:80,y:0,vx:0,vy:0,speed:68,
  on:1,ang:0,airY:0,stall:0,
  have:0,boost:0,swerve:0,maxHave:5,potholeDip:0,potholeSlow:0,
  pusherIncoming:0,pusherStartX:0
};

const particles=[];
const textDisplays=[];
const safeProbe=document.createElement('div');
safeProbe.style.cssText='position:fixed;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);pointer-events:none;visibility:hidden;width:0;height:0';
document.body.appendChild(safeProbe);
let safeL=0,safeR=0,safeT=0,safeB=0;

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  const vv=window.visualViewport;
  const sw=vv?vv.width:innerWidth,sh=vv?vv.height:innerHeight;
  W=sw/ZOOM;H=sh/ZOOM;
  c.width=Math.floor(sw*dpr);c.height=Math.floor(sh*dpr);
  c.style.width=sw+'px';c.style.height=sh+'px';
  g.setTransform(dpr*ZOOM,0,0,dpr*ZOOM,0,0);
  const cs=getComputedStyle(safeProbe);
  safeT=(parseFloat(cs.paddingTop)||0)/ZOOM;
  safeR=(parseFloat(cs.paddingRight)||0)/ZOOM;
  safeB=(parseFloat(cs.paddingBottom)||0)/ZOOM;
  safeL=(parseFloat(cs.paddingLeft)||0)/ZOOM;
  layoutButtons();
}

function layoutButtons(){
  const pad=Math.max(18,Math.min(W,H)*0.03);
  const r=Math.max(42,Math.min(W,H)*0.115);
  const leftPad=Math.max(pad*1.8,safeL+pad*0.5);
  const rightPad=Math.max(pad*1.8,safeR+pad*0.5);
  const bottomPad=Math.max(pad*2.2,safeB+pad*0.5);
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

function rr(a,b){return a+Math.random()*(b-a)}

function nearGap(x,pad){
  const a=world.gaps;
  for(let i=0;i<a.length;i++){
    const q=a[i];
    if(x>q.a-pad&&x<q.b+pad) return 1;
  }
  return 0;
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

function chooseTerrainMode(x0){
  const y=world.lastY;
  const distToGap=world.nextGap-x0;
  if(y>560) return {mode:'recover',target:rr(-0.10,0.04),hold:2+((Math.random()*2)|0)};
  if(y<170) return {mode:'drop',target:rr(0.56,0.78),hold:2+((Math.random()*2)|0)};
  const r=Math.random();
  if(distToGap<430){
    if(r<0.82) return {mode:'drop',target:rr(0.55,0.82),hold:2+((Math.random()*2)|0)};
    return {mode:'flow',target:rr(0.40,0.58),hold:2+((Math.random()*2)|0)};
  }
  if(r<0.58) return {mode:'drop',target:rr(0.52,0.82),hold:2+((Math.random()*3)|0)};
  if(r<0.96) return {mode:'flow',target:rr(0.38,0.60),hold:2+((Math.random()*3)|0)};
  return {mode:'recover',target:rr(0.08,0.22),hold:1+((Math.random()*2)|0)};
}

function nextTerrainSlope(x0){
  const t=world.terrain;
  if(t.modeLeft<=0||t.hold<=0){
    const m=chooseTerrainMode(x0);
    t.mode=m.mode;t.target=m.target;t.hold=m.hold;t.modeLeft=m.hold;
  }
  t.modeLeft--;
  t.hold--;
  const turn=t.mode==='drop'?0.17:t.mode==='flow'?0.13:0.10;
  const jit=t.mode==='drop'?0.035:t.mode==='flow'?0.027:0.020;
  const delta=Math.max(-turn,Math.min(turn,t.target-t.slope));
  t.slope+=delta+(Math.random()*2-1)*jit;
  if(Math.abs(t.slope)<GEN.terrain.flatCut) t.flat++;
  else t.flat=0;
  if(t.flat>GEN.terrain.flatLimit){
    if(world.lastY>520){t.mode='recover';t.target=rr(-0.08,0.06);}
    else{t.mode='drop';t.target=rr(0.50,0.76);}
    t.modeLeft=2;t.hold=2;t.flat=0;
  }
  if(x0<900&&t.slope<0.38) t.slope=rr(0.38,0.58);
  if(world.lastY<155){
    t.mode='drop';t.target=rr(0.52,0.74);
    t.modeLeft=Math.max(t.modeLeft,2);
    t.slope=Math.max(t.slope,0.28);
  }
  if(world.lastY>585){
    t.mode='recover';t.target=rr(-0.16,-0.04);
    t.modeLeft=Math.max(t.modeLeft,2);
    t.slope=Math.min(t.slope,0.08);
  }
  t.slope=Math.max(GEN.terrain.min,Math.min(GEN.terrain.max,t.slope));
  return t.slope;
}

function spawnEntities(fromX,toX){
  if(toX<=fromX) return;
  const pc=GEN.pot,nc=GEN.npc;
  let attempts=0;
  while(world.nextPot<toX){
    const x=world.nextPot+(Math.random()*2-1)*pc.jitter;
    const tooCloseNpc=world.npcs.some(n=>Math.abs(n.x-x)<pc.clear);
    const tooClosePot=world.pots.some(p=>Math.abs(p.x-x)<pc.clear*0.72);
    if(x>=fromX&&!nearGap(x,pc.gapPad)&&Math.abs(slopeAt(x))<pc.maxSlope&&!tooCloseNpc&&!tooClosePot) {
      world.pots.push({x,r:20,done:0,dodge:0,flash:0});
      world.nextPot+=rr(pc.min,pc.max);
      attempts=0;
    } else {
      world.nextPot+=pc.step;
      attempts++;
      if(attempts>pc.maxTries) {
        world.nextPot+=rr(pc.min,pc.max)*0.5;
        attempts=0;
      }
    }
  }
  attempts=0;
  while(world.nextNpc<toX){
    const x=world.nextNpc+(Math.random()*2-1)*nc.jitter;
    const tooClosePot=world.pots.some(p=>Math.abs(p.x-x)<nc.clear);
    const tooCloseNpc=world.npcs.some(n=>!n.got&&Math.abs(n.x-x)<nc.clear*0.75);
    if(x>=fromX&&!nearGap(x,nc.gapPad)&&Math.abs(slopeAt(x))<nc.maxSlope&&!tooClosePot&&!tooCloseNpc) {
      world.npcs.push({x,got:0,wave:Math.random()*TAU});
      world.nextNpc+=rr(nc.min,nc.max);
      attempts=0;
    } else {
      world.nextNpc+=nc.step;
      attempts++;
      if(attempts>nc.maxTries) {
        world.nextNpc+=rr(nc.min,nc.max)*0.45;
        attempts=0;
      }
    }
  }
}

function ensureWorld(toX){
  const startX=world.lastX;
  const bc=GEN.bridge;
  while(world.lastX<toX){
    const x0=world.lastX,y0=world.lastY;
    if(x0>world.nextGap&&Math.random()<bc.chance){
      const approach=rr(bc.approachLen[0],bc.approachLen[1]);
      const approachSlope=rr(bc.approachSlope[0],bc.approachSlope[1]);
      const x1=x0+approach,y1=y0+approach*approachSlope;
      addPoint(x1,y1);
      const rampLen=rr(bc.rampLen[0],bc.rampLen[1]);
      const rampSlope=rr(bc.rampSlope[0],bc.rampSlope[1]);
      const x2=x1+rampLen,y2=y1+rampLen*rampSlope;
      addPoint(x2,y2);
      const lipLen=rr(bc.lipLen[0],bc.lipLen[1]);
      const lipSlope=rr(bc.lipSlope[0],bc.lipSlope[1]);
      const takeoffX=x2+lipLen,takeoffY=y2+lipLen*lipSlope;
      addPoint(takeoffX,takeoffY);
      const gw=rr(bc.width[0],bc.width[1]);
      world.gaps.push({a:takeoffX,b:takeoffX+gw,btm:takeoffY+rr(bc.btmDrop[0],bc.btmDrop[1]),river:Math.random()<0.5,seed:Math.random()});
      const landX=takeoffX+gw;
      const landY=takeoffY+rr(bc.landDrop[0],bc.landDrop[1]);  
      addPoint(landX,landY);
      const downLen1=rr(bc.settleLen1[0],bc.settleLen1[1]);
      const downSlope1=rr(bc.settleSlope1[0],bc.settleSlope1[1]);
      const down1X=landX+downLen1,down1Y=landY+downLen1*downSlope1;
      addPoint(down1X,down1Y);
      const downLen2=rr(bc.settleLen2[0],bc.settleLen2[1]);
      const downSlope2=rr(bc.settleSlope2[0],bc.settleSlope2[1]);
      const down2X=down1X+downLen2,down2Y=down1Y+downLen2*downSlope2;
      addPoint(down2X,down2Y);
      world.lastX=down2X;world.lastY=down2Y;
      world.nextGap=down2X+rr(bc.min,bc.max);
      world.terrain.hold=0;world.terrain.modeLeft=0;world.terrain.flat=0;
    }else{
      const len=rr(GEN.terrain.lenMin,GEN.terrain.lenMax);
      const s=nextTerrainSlope(x0);
      let y=y0+len*s;
      if(y>GEN.terrain.botSoft){
        const over=y-GEN.terrain.botSoft;
        y=GEN.terrain.botSoft-over*0.38;
        world.terrain.mode='recover';world.terrain.target=rr(-0.22,-0.06);world.terrain.modeLeft=Math.max(world.terrain.modeLeft,2);world.terrain.flat=0;
      }else if(y<GEN.terrain.topSoft){
        const over=GEN.terrain.topSoft-y;
        y=GEN.terrain.topSoft+over*0.38;
        world.terrain.mode='drop';world.terrain.target=rr(0.34,0.56);world.terrain.modeLeft=Math.max(world.terrain.modeLeft,2);world.terrain.flat=0;
      }
      if(Math.abs(y-y0)<14){
        const forced=world.lastY>510?rr(-0.06,0.08):rr(0.42,0.70);
        y=y0+len*forced;
      }
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
  mode='play';reason='';score=0;newBest=0;rollT=0;
  world.pts=[{x:-240,y:300},{x:0,y:320}];
  world.gaps=[];world.pots=[];world.npcs=[];
  world.lastX=0;world.lastY=320;
  world.nextPot=GEN.pot.start;world.nextNpc=GEN.npc.start;world.nextGap=GEN.bridge.start;
  world.terrain.slope=0.32;world.terrain.target=0.40;world.terrain.hold=0;world.terrain.flat=0;world.terrain.mode='flow';world.terrain.modeLeft=0;
  player.x=80;player.speed=68;player.vx=0;player.vy=0;player.on=1;player.ang=0;
  player.have=0;player.boost=0;player.swerve=0;player.airY=0;player.stall=0;player.potholeDip=0;player.potholeSlow=0;player.pusherIncoming=0;player.pusherStartX=0;
  btnFloats.length=0;actPulse=0;
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
  newBest=score>best?1:0;
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
      btnFloats.push({text:'+1 PUSHER',time:0.9,max:0.9,col:'#b8e6ff'});
    }
    return;
  }
  if(nearPot){
    nearPot.dodge=1;nearPot.flash=0.22;player.swerve=0.28;
    sfx('swerve');burst(nearPot.x,groundY(nearPot.x)-8,8,'#aad0ef',90);
    btnFloats.push({text:'SWERVED!',time:0.9,max:0.9,col:'#ffe08f'});
  }
}

function tryCall(){
  if(mode!=='play') return;
  if(player.have>0&&player.boost<=0&&player.pusherIncoming<=0){
    player.have--;
    player.pusherIncoming=PUSHER_RUN;
    player.pusherStartX=camX-40;
    sfx('boost');burst(player.x-15,player.y+8,14,'#ffde94',150);
  }
}

function updatePlay(dt){
  ensureWorld(player.x+W*1.8+900);

  if(input.call){tryCall();input.call=0;}
  if(input.act){tryAction();input.act=0;}

  if(player.pusherIncoming>0){
    player.pusherIncoming=Math.max(0,player.pusherIncoming-dt);
    if(player.pusherIncoming<=0){
      player.boost=1.8;
      burst(player.x-15,player.y+8,14,'#ffde94',150);
    }
  }

  if(player.boost>0){
    player.boost=Math.max(0,player.boost-dt);
    if(Math.random()<0.7) burst(player.x-20,player.y+7,1,'#ffe68f',90);
    if(Math.random()<0.3) burst(player.x-18,player.y+5,1,'#ffb347',70);
  }

  player.swerve=Math.max(0,player.swerve-dt);
  player.potholeDip=Math.max(0,player.potholeDip-dt*3);
  player.potholeSlow=Math.max(0,player.potholeSlow-dt);

  if(player.on){
    const sl=slopeAt(player.x);
    let acc=sl*304-22;
    if(input.brake) acc-=144;
    if(player.boost>0) acc+=385;
    if(player.potholeSlow>0) acc-=240;
    player.speed+=acc*dt;
    player.speed=Math.max(0,Math.min(541,player.speed));
    player.x+=player.speed*dt;
    const gy=groundY(player.x);
    if(gy==null){
      player.on=0;
      player.vx=Math.max(12,player.speed);
      player.vy=sl*player.speed*0.48;
      player.airY=player.y;
    }else{
      player.y=gy-16;
      player.ang=Math.atan(sl)-(input.brake?0.13:0);
      if(player.speed>44&&Math.random()<0.35) burst(player.x-18,gy-4,1,'#c9ae84',40);
    }
  }else{
    if(input.brake){
      player.vx=Math.max(14,player.vx-112*dt);
      player.ang-=1.8*dt;
    }else player.ang+=0.75*dt;
    if(player.boost>0) player.vx+=96*dt;
    player.vy+=720*dt;
    player.x+=player.vx*dt;
    player.y+=player.vy*dt;

    const q=gapAt(player.x);
    if(q&&player.y>q.btm){
      if(q.river) burst(player.x,player.y,22,'#5ab8e0',220);
      endRun(q.river?'Fell in the river':'Missed the bridge',0);return;
    }
    const gy=groundY(player.x);
    if(gy!=null&&player.y>=gy-16){
      const sa=Math.atan(slopeAt(player.x));
      const aErr=Math.abs(normAng(player.ang-sa));
      const hard=player.vy>304||player.y-player.airY>220;
      if(aErr>0.95||hard){endRun('Bad landing',1);return;}
      player.on=1;
      player.y=gy-16;
      player.speed=Math.max(16,player.vx*0.92);
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
        player.potholeSlow=0.3;
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
  camX+=(player.x-W*0.30-camX)*Math.min(1,dt*4.5);
  camY+=(player.y-H*0.58-camY)*Math.min(1,dt*4.2);
  rollT-=dt;
  if(rollT<=0&&player.on&&player.speed>24){
    const s=Math.min(1,player.speed/304);
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
  const lx=arr[arr.length-1][0],fx=arr[0][0];
  let minY=arr[0][1];
  for(let i=1;i<arr.length;i++) if(arr[i][1]<minY) minY=arr[i][1];
  // Single clean fill — Alto style: no edge stroke, just a shape
  g.beginPath();
  g.moveTo(arr[0][0],arr[0][1]);
  for(let i=1;i<arr.length;i++) g.lineTo(arr[i][0],arr[i][1]);
  g.lineTo(lx,H+80);g.lineTo(fx,H+80);g.closePath();
  const grd=g.createLinearGradient(0,minY,0,minY+200);
  grd.addColorStop(0,'#7a5232');
  grd.addColorStop(0.35,'#5e3a1e');
  grd.addColorStop(1,'#3a2010');
  g.fillStyle=grd;g.fill();
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
    const gapW=x2-x1;
    // River filling the gap (if applicable)
    if(q.river){
      const ry=Math.max(y1,y2)+40;
      const rg=g.createLinearGradient(0,ry,0,H+20);
      rg.addColorStop(0,'#3a6a8a');rg.addColorStop(0.4,'#2a5070');rg.addColorStop(1,'#1a3048');
      g.fillStyle=rg;
      g.fillRect(x1-4,ry,gapW+8,H-ry+20);
      // Shimmer lines
      g.strokeStyle='rgba(160,210,240,.2)';g.lineWidth=1;
      for(let j=0;j<4;j++){
        const sy=ry+20+j*28;
        const sx=x1+((tNow*25+j*gapW*0.3)%gapW);
        g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+22,sy-2);g.stroke();
      }
    }
    // Left cliff face
    g.fillStyle='#3a2412';
    g.beginPath();g.moveTo(x1,y1-4);g.lineTo(x1+6,y1);g.lineTo(x1+4,y1+90);g.lineTo(x1-2,y1+90);g.closePath();g.fill();
    // Right cliff face
    g.beginPath();g.moveTo(x2,y2-4);g.lineTo(x2-6,y2);g.lineTo(x2-4,y2+90);g.lineTo(x2+2,y2+90);g.closePath();g.fill();
    // Snapped bridge — left side (hangs from left edge)
    const swing=Math.sin(tNow*1.8+q.seed*6)*0.15;
    g.save();g.translate(x1,y1-2);g.rotate(0.3+swing);
    g.strokeStyle='#5a4020';g.lineWidth=2;g.lineCap='round';
    const planks=3+Math.floor(q.seed*3);
    for(let j=0;j<planks;j++){
      const py=j*14+6;
      g.strokeStyle='#6a5030';g.lineWidth=1.5;
      g.beginPath();g.moveTo(-1,py);g.lineTo(0,py+12);g.stroke(); // rope
      g.fillStyle='#7a6040';g.fillRect(-5,py+1,10,3); // plank
    }
    g.restore();
    // Snapped bridge — right side (hangs from right edge)
    g.save();g.translate(x2,y2-2);g.rotate(-0.3-swing*0.8);
    for(let j=0;j<planks;j++){
      const py=j*14+6;
      g.strokeStyle='#6a5030';g.lineWidth=1.5;
      g.beginPath();g.moveTo(1,py);g.lineTo(0,py+12);g.stroke();
      g.fillStyle='#7a6040';g.fillRect(-5,py+1,10,3);
    }
    g.restore();
  }

  for(let i=0;i<world.pots.length;i++){
    const p=world.pots[i],sx=p.x-camX;
    if(sx<-40||sx>W+40) continue;
    const gy=groundY(p.x);if(gy==null) continue;
    const sy=gy-camY+2;
    const r=p.r,rh=r*0.45;
    const flash=p.flash>0;
    const ang=Math.atan(slopeAt(p.x));
    g.save();g.translate(sx,sy);g.rotate(ang);
    // Subtle depression shadow
    g.fillStyle=flash?'rgba(90,158,198,.3)':'rgba(0,0,0,.25)';
    g.beginPath();g.ellipse(0,2,r*1.1,rh*1.1,0,0,TAU);g.fill();
    // Inner hole
    g.fillStyle=flash?'#4a90b8':'#1e1008';
    g.beginPath();g.ellipse(0,0,r*0.75,rh*0.7,0,0,TAU);g.fill();
    // Cracks
    g.strokeStyle=flash?'rgba(90,158,198,.5)':'rgba(0,0,0,.2)';
    g.lineWidth=1;g.lineCap='round';
    for(let j=0;j<4;j++){
      const a=j*1.5+((i*3)%4)*0.4;
      g.beginPath();
      g.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*rh*0.6);
      g.lineTo(Math.cos(a)*r*1.2,Math.sin(a)*rh*1.1);
      g.stroke();
    }
    g.restore();
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

  if(player.pusherIncoming>0){
    const t=1-player.pusherIncoming/PUSHER_RUN;
    const eased=1-Math.pow(1-t,2);
    const targetX=player.x-40;
    const px=player.pusherStartX+(targetX-player.pusherStartX)*eased;
    const pScreenX=px-camX;
    let pGroundY;
    const pGap=gapAt(px);
    if(pGap){
      const ya=groundY(pGap.a)||player.y+12;
      const yb=groundY(pGap.b)||player.y+12;
      const gapT=(px-pGap.a)/(pGap.b-pGap.a);
      pGroundY=(ya+(yb-ya)*gapT)-camY;
    }else{
      pGroundY=(groundY(px)||player.y+12)-camY;
    }
    const runPhase=tNow*18;
    const legLift=Math.abs(Math.sin(runPhase))*10;
    const legBack=Math.sin(runPhase)*6;
    const armSwing=Math.sin(runPhase)*5;
    const lean=-0.18;
    g.save();
    g.translate(pScreenX,pGroundY);
    g.rotate(lean);
    g.strokeStyle='#f7d58d';g.lineWidth=3;g.lineCap='round';
    g.beginPath();
    g.moveTo(0,-8);g.lineTo(0,-38);
    g.moveTo(0,-30);g.lineTo(8+armSwing,-24);
    g.moveTo(0,-30);g.lineTo(-8-armSwing,-22);
    g.moveTo(0,-8);g.lineTo(3+legBack,-2+legLift);
    g.moveTo(0,-8);g.lineTo(-3-legBack,-2-legLift);
    g.stroke();
    g.fillStyle='#f7d58d';g.beginPath();g.arc(0,-42,4.5,0,TAU);g.fill();
    g.restore();
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
  const s=Math.min(W,H)/400;
  const fs1=Math.round(20*s),fs2=Math.round(13*s);
  const pad=Math.round(14*s);
  g.textAlign='right';
  g.fillStyle='#fff';
  g.font='700 '+fs1+'px system-ui,sans-serif';
  g.fillText(score+' m',W-pad,pad+fs1);
  g.fillStyle='rgba(255,255,255,.45)';
  g.font='500 '+fs2+'px system-ui,sans-serif';
  g.fillText('best '+best+' m',W-pad,pad+fs1+fs2+4);
  g.textAlign='left';
  const bw=Math.round(btn.act.r*2.2),bh=Math.round(8*s);
  const bx=btn.act.x-bw*0.5,by=btn.act.y+btn.act.r+Math.round(18*s);
  const v=Math.min(1,player.speed/420);
  const br=bh*0.5;
  g.globalAlpha=0.35;g.fillStyle='#fff';g.font='600 '+Math.max(8,Math.round(9*s))+'px system-ui,sans-serif';
  g.textAlign='center';g.fillText('SPEED',btn.act.x,by-3);g.textAlign='left';
  g.globalAlpha=0.45;g.fillStyle='#000';
  roundRect(bx,by,bw,bh,br);g.fill();
  g.globalAlpha=0.8;
  g.fillStyle=v>.67?'#67e18f':v>.34?'#ffd36a':'#ff8c5a';
  if(v>0){roundRect(bx+1,by+1,(bw-2)*v,bh-2,br-1);g.fill();}
  g.globalAlpha=1;
}

function drawButton(b,key){
  const active=(key==='brake'?input.brake:b.active>0);
  // allow per-button disabled flag (b.disabled) but keep existing call-specific rule
  const callDisabled = (key==='call' && player.have===0);
  const bDisabled = !!b.disabled;
  const disabled = callDisabled || bDisabled;
  g.globalAlpha=disabled?0.3:active?0.9:0.62;
  g.fillStyle=disabled?'#666':key==='brake'?'#f06a4f':key==='call'?'#2e91d8':'#6fbf4f';
  g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
  g.strokeStyle=disabled?'rgba(255,255,255,.4)':'rgba(255,255,255,.85)';g.lineWidth=3;g.stroke();

  // Expanding pulse ring when action button becomes available
  if(key==='act'&&actPulse>0){
    const t=1-actPulse/0.38; // 0→1 over the pulse lifetime
    const pulseR=b.r+t*22;
    g.globalAlpha=Math.max(0,(1-t)*0.7);
    g.strokeStyle='#ffe08f';g.lineWidth=3;
    g.beginPath();g.arc(b.x,b.y,pulseR,0,TAU);g.stroke();
    actPulse=Math.max(0,actPulse-1/60);
  }

  g.globalAlpha=1;
  g.fillStyle=disabled?'#999':'#fff';
  g.textAlign='center';
  if(b.icon){
    // Large icon above, smaller label below
    g.font='700 '+Math.max(18,b.r*0.42)+'px system-ui,sans-serif';
    g.fillText(b.icon,b.x,b.y-2);
    g.font='700 '+Math.max(9,b.r*0.17)+'px system-ui,sans-serif';
    g.fillText(b.label,b.x,b.y+Math.max(14,b.r*0.32));
  }else{
    g.font='700 '+Math.max(11,b.r*0.22)+'px system-ui,sans-serif';
    g.fillText(b.label,b.x,b.y+4);
  }
}

function drawOneTree(tx,baseY,kind,sc,dark){
  g.globalAlpha=dark?0.55:0.7;
  const col=dark?'#162e14':'#1e3a1a';
  const col2=dark?'#1a3418':'#2a4a22';
  const h=(kind===0?110:kind===1?130:115)*sc;
  // trunk
  g.fillStyle=dark?'#1a2e16':'#2a4020';
  g.fillRect(tx-3,baseY-h*0.05,6,h*0.3);
  if(kind===0){
    // Ellipse canopy
    g.fillStyle=col2;
    g.beginPath();g.ellipse(tx,baseY-h*0.4,h*0.22,h*0.38,0,0,TAU);g.fill();
  }else if(kind===1){
    // Triangle
    g.fillStyle=col;
    g.beginPath();g.moveTo(tx,baseY-h);g.lineTo(tx-h*0.22,baseY);g.lineTo(tx+h*0.22,baseY);
    g.closePath();g.fill();
  }else{
    // Spade
    g.fillStyle=col2;
    g.beginPath();
    g.moveTo(tx,baseY-h);
    g.bezierCurveTo(tx-h*0.35,baseY-h*0.45,tx-h*0.3,baseY+h*0.05,tx,baseY-h*0.05);
    g.bezierCurveTo(tx+h*0.3,baseY+h*0.05,tx+h*0.35,baseY-h*0.45,tx,baseY-h);
    g.fill();
  }
  g.globalAlpha=1;
}

function drawTrees(layer){
  if(layer){
    // Foreground: anchored to terrain, scroll 1:1 with world
    const spread=320;
    const startI=Math.floor((camX-80)/spread);
    const endI=Math.ceil((camX+W+80)/spread);
    for(let i=startI;i<=endI;i++){
      const wx=i*spread+((i*73+11)%spread)*0.3;
      if(gapAt(wx)) continue;
      const gy=groundY(wx);if(gy==null) continue;
      const sx=wx-camX, sy=gy-camY;
      if(sx<-80||sx>W+80) continue;
      const kind=((i*13+7)%3)|0;
      const sc=0.8+(((i<0?-i:i)*7)%5)*0.12;
      drawOneTree(sx,sy,kind,sc,true);
    }
  }else{
    // Background: parallax decorative trees
    const spd=0.25,n=14,spread=160;
    const wrap=n*spread;
    const yBase=H*0.72;
    for(let i=0;i<n;i++){
      const tx=((i*spread-(camX*spd)%wrap)+wrap)%wrap-80;
      if(tx<-80||tx>W+80) continue;
      const kind=((i*13+7)%3);
      const by=yBase+Math.sin(i*1.3+0.5)*10+((i*11)%7)*2;
      const sc=0.8+((i*7)%5)*0.12;
      drawOneTree(tx,by,kind,sc,false);
    }
  }
}

function roundRect(x,y,w,h,r){
  g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();
}

function tutBox(text,hb){
  g.textAlign='center';
  g.font='600 15px system-ui,sans-serif';
  const bw=Math.min(W*0.85,g.measureText(text).width+60),bh=70;
  const bx=W*0.5-bw*0.5,by=H*0.5-bh*0.5;
  g.fillStyle='rgba(20,14,8,.58)';
  roundRect(bx,by,bw,bh,12);g.fill();
  g.strokeStyle='rgba(255,255,255,.1)';g.lineWidth=1;g.stroke();
  g.fillStyle='#fff';g.fillText(text,W*0.5,by+bh*0.5+5);
  if(hb){g.strokeStyle='#ffe08f';g.lineWidth=4;g.beginPath();g.arc(hb.x,hb.y,hb.r+8,0,TAU);g.stroke();}
}

function render(){
  // --- Sky gradient (3-stop, Alto-style) ---
  const sky=g.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#4a90d9');
  sky.addColorStop(0.55,'#8ec5e8');
  sky.addColorStop(1,'#e8cfa0');
  g.fillStyle=sky;g.fillRect(0,0,W,H);

  // --- Sun with glow ---
  const sunX=W*0.72,sunY=H*0.18;
  g.globalAlpha=0.18;g.fillStyle='#fff';
  g.beginPath();g.arc(sunX,sunY,60,0,TAU);g.fill();
  g.globalAlpha=0.35;
  g.beginPath();g.arc(sunX,sunY,32,0,TAU);g.fill();
  g.globalAlpha=0.9;
  g.beginPath();g.arc(sunX,sunY,18,0,TAU);g.fill();
  g.globalAlpha=1;

  // --- Clouds ---
  g.fillStyle='rgba(255,255,255,.13)';
  for(let i=0;i<5;i++){
    const x=((i*260-(camX*0.08)%1300)+1300)%1300-120;
    const y=60+Math.sin(i*2.1+tNow*0.06)*20+i*12;
    g.beginPath();g.ellipse(x,y,66+i*8,18+i*2,0,0,TAU);g.fill();
  }

  // --- Parallax mountain layers (back to front) ---
  const mLayers=[
    {spd:0.04,base:0.52,amp:0.10,freq:0.0012,col:'#8da4b8',freq2:0.003,amp2:0.04},
    {spd:0.10,base:0.56,amp:0.12,freq:0.0018,col:'#7a9478',freq2:0.005,amp2:0.03},
    {spd:0.20,base:0.62,amp:0.13,freq:0.0025,col:'#5e7a4e',freq2:0.007,amp2:0.04}
  ];
  for(let L=0;L<mLayers.length;L++){
    const m=mLayers[L];
    g.fillStyle=m.col;
    g.beginPath();g.moveTo(0,H);
    for(let x=0;x<=W+30;x+=20){
      const wx=x+camX*m.spd;
      const y=H*m.base-Math.abs(Math.sin(wx*m.freq))*H*m.amp
        -Math.abs(Math.sin(wx*m.freq2+2.5))*H*m.amp2;
      g.lineTo(x,y);
    }
    g.lineTo(W+30,H);g.closePath();g.fill();
  }

  // --- Parallax trees (3 Alto types: ellipse, triangle, spade) ---
  drawTrees(0); // background trees (behind terrain)

  drawWorld();
  drawParticles();

  if(mode!=='title') drawBuggy();

  drawTrees(1); // foreground trees (in front of track, sparser)

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

  // Update Action button label and disabled state based on nearby pots (potholes) or npcs (pushers)
  {
    const wasDisabled=btn.act.disabled;
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
    if(nearNpc && (!nearPot || dN<=dP)){
      btn.act.icon='\u2795';
      btn.act.label='PUSHER';
      btn.act.disabled=false;
    } else if(nearPot){
      btn.act.icon='\u21AA';
      btn.act.label='SWERVE';
      btn.act.disabled=false;
    } else {
      btn.act.icon='';
      btn.act.label='ACTION';
      btn.act.disabled=true;
    }
    // trigger pulse when action becomes available
    if(wasDisabled&&!btn.act.disabled) actPulse=0.38;
  }

  drawButton(btn.call,'call');
  drawButton(btn.brake,'brake');
  drawButton(btn.act,'act');

  // Render floating text rising from the action button
  for(let i=btnFloats.length-1;i>=0;i--){
    const f=btnFloats[i];
    f.time-=1/60;
    if(f.time<=0){btnFloats.splice(i,1);continue;}
    const t=1-f.time/f.max; // 0→1 over lifetime
    const yOff=btn.act.r+20+t*55; // rise upward from button
    const alpha=Math.max(0,1-t*1.3);
    g.globalAlpha=alpha;
    g.textAlign='center';
    g.font='800 '+Math.max(13,btn.act.r*0.24)+'px system-ui,sans-serif';
    g.strokeStyle='rgba(0,0,0,0.5)';g.lineWidth=4;
    g.strokeText(f.text,btn.act.x,btn.act.y-yOff);
    g.fillStyle=f.col;
    g.fillText(f.text,btn.act.x,btn.act.y-yOff);
  }
  g.globalAlpha=1;
  g.textAlign='left';

  if(mode==='title'){
    g.textAlign='center';
    if(tutorialStep===0){
      g.fillStyle='#fff';
      g.font='800 '+Math.max(42,W*0.07)+'px system-ui,sans-serif';
      g.fillText('BUGGY ON',W*0.5,H*0.38);
      g.font='600 '+Math.max(18,W*0.03)+'px system-ui,sans-serif';
      g.fillStyle='rgba(255,255,255,.7)';
      g.fillText('CMU Tradition on Flagstaff Hill',W*0.5,H*0.46);
      g.fillStyle='#ffe08f';g.font='800 22px system-ui,sans-serif';
      g.fillText('TAP TO BEGIN',W*0.5,H*0.56+Math.sin(tNow*5)*3);
    }else if(tutorialStep===1){
      tutBox('You can hold up to 5 pushers at once');
      player.have=5;drawBuggy();player.have=0;
    }else if(tutorialStep===2){
      tutBox('Tap CALL PUSHER to activate a boost',btn.call);
    }else if(tutorialStep===3){
      tutBox('Dodge potholes or pick up pushers nearby',btn.act);
    }else if(tutorialStep===4){
      tutBox('You know what this one does',btn.brake);
    }else{
      const lines=['All 446 Pittsburgh bridges are down,','so you\'ll have to jump the gaps!','Run out of speed or crash = run over.'];
      g.font='600 15px system-ui,sans-serif';
      let maxW=0;
      for(let i=0;i<lines.length;i++){const w=g.measureText(lines[i]).width;if(w>maxW) maxW=w;}
      const bw=Math.min(W*0.85,maxW+60),bh=lines.length*24+30;
      const bx=W*0.5-bw*0.5,by=H*0.38-bh*0.5;
      g.fillStyle='rgba(20,14,8,.58)';roundRect(bx,by,bw,bh,12);g.fill();
      g.strokeStyle='rgba(255,255,255,.1)';g.lineWidth=1;g.stroke();
      g.fillStyle='#fff';
      for(let i=0;i<lines.length;i++) g.fillText(lines[i],W*0.5,by+24+i*24);
      g.fillStyle='#ffe08f';g.font='800 24px system-ui,sans-serif';
      g.fillText('TAP TO START',W*0.5,by+bh+45+Math.sin(tNow*4)*4);
    }
    if(tutorialStep>0&&tutorialStep<5){
      g.fillStyle='rgba(255,255,255,.5)';g.font='600 13px system-ui,sans-serif';
      g.fillText('tap to continue',W*0.5,H*0.5+60);
    }
    if(tutorialStep>=1){
      g.textAlign='right';
      g.fillStyle='rgba(255,255,255,.45)';g.font='600 14px system-ui,sans-serif';
      g.fillText('SKIP \u25B6',W-20,30);
      g.textAlign='center';
    }
    g.textAlign='left';
  }

  if(mode==='over'){
    const s=Math.min(W,H)/400;
    const cx=W*0.5,bw=Math.min(380,W*0.85),bh=Math.round(170*Math.min(1,s));
    const bx=cx-bw*0.5,by=H*0.22;
    g.fillStyle='rgba(20,14,8,.62)';
    roundRect(bx,by,bw,bh,14);g.fill();
    g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=1;g.stroke();
    g.textAlign='center';
    g.fillStyle='#fff';
    g.font='800 '+Math.round(38*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText('RUN OVER',cx,by+Math.round(48*Math.min(1,s)));
    g.fillStyle='rgba(210,195,170,.55)';
    g.font='500 '+Math.round(15*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText(reason,cx,by+Math.round(74*Math.min(1,s)));
    g.strokeStyle='rgba(255,255,255,.1)';g.lineWidth=1;
    g.beginPath();g.moveTo(bx+40,by+Math.round(88*Math.min(1,s)));g.lineTo(bx+bw-40,by+Math.round(88*Math.min(1,s)));g.stroke();
    g.fillStyle='#fff';
    g.font='800 '+Math.round(36*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText(score+' m',cx,by+Math.round(128*Math.min(1,s)));
    if(newBest){
      g.fillStyle='#ffe08f';g.font='600 '+Math.round(14*Math.min(1,s))+'px system-ui,sans-serif';
      g.fillText('🏆 New High Score!',cx,by+Math.round(152*Math.min(1,s)));
    }else{
      g.fillStyle='rgba(210,195,170,.45)';g.font='500 '+Math.round(13*Math.min(1,s))+'px system-ui,sans-serif';
      g.fillText('best: '+best+' m',cx,by+Math.round(152*Math.min(1,s)));
    }
    g.globalAlpha=0.8;g.fillStyle='#e0d8c8';g.font='500 '+Math.round(13*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText('A: retry • Collect pushers & save them for big gaps',cx,by+bh+Math.round(28*Math.min(1,s)));
    g.globalAlpha=1;
    g.fillStyle='#ffe08f';g.font='800 '+Math.round(22*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText('TAP TO RETRY',cx,by+bh+Math.round(60*Math.min(1,s))+Math.sin(tNow*5)*3);
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
  if((e.key===' '||e.key==='ArrowUp')&&!btn.act.disabled){input.act=1;btn.act.active=0.18;audioInit()}
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
  const px=e.clientX/ZOOM,py=e.clientY/ZOOM;
  const k=hitButton(px,py);
  if(mode==='title'){
    if(tutorialStep>=1&&px>W-100&&py<60){
      resetRun();
    }else if(tutorialStep<5){
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
  else if(k==='act'&&!btn.act.disabled){input.act=1;btn.act.active=0.18;}
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
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
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
