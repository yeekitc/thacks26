(()=>{
const c=document.getElementById('c'),g=c.getContext('2d',{alpha:false});
let W=0,H=0;
const ZOOM=0.81;
const CAM_FOLLOW_Y=0.50; // was 0.58; shows ~20% more terrain below the buggy
let camFollowY=CAM_FOLLOW_Y;
let chromeLossRatio=0;
const ACCEL_SCALE=0.85;
const DECEL_SCALE=1.20;
const MAX_SPEED=460; // ~15% lower than previous 541 cap
const BOOST_MAX_MULT=1.50;
const BOOST_RECOVER_TIME=0.52;
const BOOST_RECOVER_DECEL=980;
const SLOPE_GRAVITY=286; // slightly softer downhill pull from terrain slope
const FIRST_BRIDGE_PUSHER_LEAD=1200;
const BETWEEN_BRIDGES_PUSHER_LEAD=520;
const BRIDGE_PUSHER_EDGE_PAD=140;
const PUSHER_SPAWN_RATE=0.5;
const BRIDGE_WIDTH_SCALE=0.85;
const PUSHER_RUN=0.5;
const PUSHER_FOLLOW_OFFSET=40;
const PUSHER_STOP_ALPHA=0.75;
const TAU=Math.PI*2;
const BUGGY={
  rideHeight:11,      // distance from buggy origin to wheel-ground contact
  frontProbe:24,      // forward collision probe for wall impacts
  airGravity:720,
  wallSlack:2,
  maxLandVY:298,
  maxLandDrop:214,
  maxBodyErr:0.95,
  maxImpactErr:0.86
};
const GEN={
  pot:{start:920,min:780,max:1280,jitter:36,step:42,maxTries:18,clear:220,maxSlope:0.55,gapPad:90},
  npc:{start:340,min:430,max:860,jitter:48,step:36,maxTries:20,clear:190,maxSlope:0.42,gapPad:95},
  bridge:{
    start:1550,safeStart:2500,chance:0.20,min:1700,max:2900,
    approachLen:[180,320],approachSlope:[-0.20,-0.11],
    rampLen:[120,220],rampSlope:[-0.30,-0.18],
    lipLen:[10,24],lipSlope:[-0.30,-0.18],
    width:[120,230],btmDrop:[220,380],landDrop:[10,22],
    settleLen1:[220,360],settleSlope1:[0.03,0.07],
    settleLen2:[300,520],settleSlope2:[0.04,0.09]
  },
  terrain:{lenMin:150,lenMax:275,min:-0.08,max:0.78,flatCut:0.14,flatLimit:2,maxRisePerSeg:22,maxRiseFromDeep:96}
};
const btn={call:{x:0,y:0,r:0,active:0,label:'CALL PUSHER'},act:{x:0,y:0,r:0,active:0,label:'ACTION',disabled:true}};
let actPulse=0; // expanding ring timer when action becomes available
const centerCues=[];
let ac=null,master=null;
let mode='title',reason='';
let tNow=0,score=0,best=0,startX=0,newBest=0;
let camX=0,camY=0,rollT=0;
let tutorialStep=0,tutorialTimer=0;
const input={call:0,act:0};

const world={
  pts:[{x:-240,y:300},{x:0,y:320}],
  gaps:[],
  pots:[],
  npcs:[],
  stoppedPushers:[],
  lastX:0,lastY:320,deepY:320,
  nextPot:GEN.pot.start,nextNpc:GEN.npc.start,nextGap:GEN.bridge.start,
  terrain:{slope:0.32,target:0.40,hold:0,flat:0,mode:'flow',modeLeft:0}
};

const player={
  x:80,y:0,vx:0,vy:0,speed:68,
  on:1,ang:0,airY:0,stall:0,
  have:0,boost:0,swerve:0,maxHave:3,potholeDip:0,potholeSlow:0,
  pusherIncoming:0,pusherStartX:0,boostCarry:0,
  pusherX:0,pusherY:0,pusherWave:0,pusherActive:0,pusherDropped:0
};

const particles=[];
const safeProbe=document.createElement('div');
safeProbe.style.cssText='position:fixed;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);pointer-events:none;visibility:hidden;width:0;height:0';
document.body.appendChild(safeProbe);
let safeL=0,safeR=0,safeT=0,safeB=0;

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  const vv=window.visualViewport;
  const sw=vv?vv.width:innerWidth,sh=vv?vv.height:innerHeight;
  const touchDevice=(navigator.maxTouchPoints||0)>0;
  const screenShort=Math.max(1,Math.min(screen.width||sw,screen.height||sh));
  const chromeLossPx=Math.max(0,screenShort-sh);
  chromeLossRatio=(touchDevice&&sw>=sh)?clamp(chromeLossPx/screenShort,0,0.35):0;
  camFollowY=clamp(CAM_FOLLOW_Y-chromeLossRatio*0.44,0.34,CAM_FOLLOW_Y);
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
  const rScale=1-chromeLossRatio*0.26;
  const r=Math.max(38,Math.min(W,H)*0.115*rScale)*1.15;
  const leftPad=Math.max(pad*1.8,safeL+pad*0.5);
  const rightPad=Math.max(pad*1.8,safeR+pad*0.5);
  const chromeLift=Math.max(0,H*chromeLossRatio*0.18);
  const bottomPad=Math.max(pad*2.2,safeB+pad*0.5)+chromeLift;
  const buttonLift=Math.max(10,r*0.18);
  btn.act.x=leftPad+r;btn.act.y=H-bottomPad-r-buttonLift;btn.act.r=r;
  btn.call.x=W-rightPad-r;btn.call.y=H-bottomPad-r-buttonLift;btn.call.r=r;
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
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function easeOutBack(t){
  const c1=1.70158,c3=c1+1;
  return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
}
function easeInBack(t){
  const c1=1.70158,c3=c1+1;
  return c3*t*t*t-c1*t*t;
}
function queueCenterCue(text,opt){
  const s=(text==null?'':String(text)).trim();
  if(!s) return;
  const o=opt||{};
  centerCues.push({
    text:s.toUpperCase(),
    t:0,
    dur:o.dur||1.04,
    size:o.size||28,
    weight:o.weight||800,
    col:o.col||'#fff',
    stroke:o.stroke||'rgba(0,0,0,0.62)'
  });
  if(centerCues.length>7) centerCues.splice(0,centerCues.length-7);
}
function updateCenterCues(dt){
  for(let i=centerCues.length-1;i>=0;i--){
    const m=centerCues[i];
    m.t+=dt;
    if(m.t>=m.dur) centerCues.splice(i,1);
  }
}
function drawCenterCues(){
  if(!centerCues.length) return;
  const cx=W*0.5,cy=H*0.5;
  g.textAlign='center';
  for(let i=0;i<centerCues.length;i++){
    const m=centerCues[i];
    const p=clamp(m.t/(m.dur||1),0,1);
    let scale=1;
    if(p<0.2){
      scale=lerp(0.34,1.22,easeOutBack(p/0.2));
    }else if(p<0.45){
      const k=(p-0.2)/0.25;
      scale=1+Math.sin(k*TAU*2.4)*0.08*(1-k);
    }else if(p>0.82){
      scale=lerp(1,0.32,easeInBack((p-0.82)/0.18));
    }
    let alpha=0.8; // 20% transparent baseline
    if(p<0.12) alpha*=p/0.12;
    else if(p>0.82) alpha*=Math.max(0,1-(p-0.82)/0.18);
    const sz=Math.max(28,m.size*2);
    const y=cy-(centerCues.length-1-i)*Math.max(34,sz*0.62);
    g.save();
    g.translate(cx,y);
    g.scale(scale,scale);
    g.globalAlpha=alpha;
    g.font='italic '+m.weight+' '+Math.round(sz)+'px system-ui,sans-serif';
    g.lineWidth=Math.max(4,sz*0.1);
    g.lineJoin='round';
    g.strokeStyle=m.stroke;
    g.strokeText(m.text,0,0);
    g.fillStyle=m.col;
    g.fillText(m.text,0,0);
    g.restore();
  }
  g.globalAlpha=1;
  g.textAlign='left';
}

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

  if(p1.k||p2.k){
    const dx=p2.x-p1.x||1;
    const s1=pointSlope(i),s2=pointSlope(i+1);
    const m1=s1*dx,m2=s2*dx;
    const t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*p1.y + (t3-2*t2+t)*m1 + (-2*t3+3*t2)*p2.y + (t3-t2)*m2;
  }

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

  if(p1.k||p2.k){
    const dx=p2.x-p1.x||1;
    const s1=pointSlope(i),s2=pointSlope(i+1);
    const m1=s1*dx,m2=s2*dx;
    const dydt=(6*t*t-6*t)*p1.y + (3*t*t-4*t+1)*m1 + (-6*t*t+6*t)*p2.y + (3*t*t-2*t)*m2;
    return dydt/dx;
  }

  // Derivative of Catmull-Rom spline for smooth slope
  const p0=p[Math.max(0,i-1)];
  const p3=p[Math.min(p.length-1,i+2)];

  const dx=p2.x-p1.x||1;
  const m1=(p2.y-p0.y)/(p2.x-p0.x||1)*(p2.x-p1.x);
  const m2=(p3.y-p1.y)/(p3.x-p1.x||1)*(p2.x-p1.x);

  const dydt=(6*t*t-6*t)*p1.y + (3*t*t-4*t+1)*m1 + (-6*t*t+6*t)*p2.y + (3*t*t-2*t)*m2;
  return dydt/dx;
}

function pointSlope(i){
  const p=world.pts;
  const c=p[i];
  if(c&&c.s!=null) return c.s;
  const a=p[Math.max(0,i-1)];
  const b=p[Math.min(p.length-1,i+1)];
  return (b.y-a.y)/(b.x-a.x||1);
}

function findGapWallHit(prevX,prevY,nextX,nextY){
  const prevFront=prevX+BUGGY.frontProbe;
  const nextFront=nextX+BUGGY.frontProbe;
  if(nextFront<=prevFront) return null;
  for(let i=0;i<world.gaps.length;i++){
    const q=world.gaps[i];
    if(prevFront>q.b||nextFront<q.b) continue;
    const t=(q.b-prevFront)/(nextFront-prevFront||1);
    if(t<0||t>1) continue;
    const yHit=lerp(prevY,nextY,t);
    const lip=(groundY(q.b)||q.btm)-BUGGY.rideHeight;
    if(yHit>lip+BUGGY.wallSlack){
      return {x:q.b,y:yHit,q};
    }
  }
  return null;
}

function findGroundTouch(prevX,prevY,nextX,nextY){
  const dx=nextX-prevX;
  if(Math.abs(dx)<1e-6){
    const gy=groundY(nextX);
    if(gy==null||nextY<gy-BUGGY.rideHeight) return null;
    return {x:nextX,y:gy-BUGGY.rideHeight,gy,slope:slopeAt(nextX)};
  }
  const steps=Math.max(4,Math.ceil(Math.abs(dx)/3));
  let t0=0;
  for(let s=1;s<=steps;s++){
    const t1=s/steps;
    const x1=lerp(prevX,nextX,t1),y1=lerp(prevY,nextY,t1);
    const gy1=groundY(x1);
    if(gy1!=null&&y1>=gy1-BUGGY.rideHeight){
      let lo=t0,hi=t1;
      for(let k=0;k<7;k++){
        const m=(lo+hi)*0.5;
        const mx=lerp(prevX,nextX,m),my=lerp(prevY,nextY,m);
        const mgy=groundY(mx);
        if(mgy!=null&&my>=mgy-BUGGY.rideHeight) hi=m;
        else lo=m;
      }
      const hitT=hi;
      const hitX=lerp(prevX,nextX,hitT);
      const gy=groundY(hitX);
      if(gy==null) return null;
      return {x:hitX,y:gy-BUGGY.rideHeight,gy,slope:slopeAt(hitX)};
    }
    t0=t1;
  }
  return null;
}

function addPoint(x,y,s,k){
  const pt={x,y};
  if(s!=null) pt.s=s;
  if(k) pt.k=1;
  world.pts.push(pt);
  world.lastX=x;world.lastY=y;
  world.deepY=Math.max(world.deepY,y);
}

function chooseTerrainMode(x0){
  const distToGap=world.nextGap-x0;
  const r=Math.random();
  if(distToGap<430){
    if(r<0.78) return {mode:'drop',target:rr(0.48,0.72),hold:2+((Math.random()*2)|0)};
    return {mode:'flow',target:rr(0.26,0.46),hold:2+((Math.random()*2)|0)};
  }
  if(r<0.42) return {mode:'drop',target:rr(0.42,0.66),hold:2+((Math.random()*3)|0)};
  if(r<0.90) return {mode:'flow',target:rr(0.16,0.44),hold:2+((Math.random()*3)|0)};
  return {mode:'recover',target:rr(-0.10,0.02),hold:2+((Math.random()*2)|0)};
}

function nextTerrainSlope(x0){
  const t=world.terrain;
  if(t.modeLeft<=0||t.hold<=0){
    const m=chooseTerrainMode(x0);
    t.mode=m.mode;t.target=m.target;t.hold=m.hold;t.modeLeft=m.hold;
  }
  t.modeLeft--;
  t.hold--;
  const turn=t.mode==='drop'?0.15:t.mode==='flow'?0.11:0.09;
  const jit=t.mode==='drop'?0.030:t.mode==='flow'?0.022:0.018;
  const delta=Math.max(-turn,Math.min(turn,t.target-t.slope));
  t.slope+=delta+(Math.random()*2-1)*jit;
  if(Math.abs(t.slope)<GEN.terrain.flatCut) t.flat++;
  else t.flat=0;
  if(t.flat>GEN.terrain.flatLimit){
    t.mode='drop';t.target=rr(0.36,0.58);
    t.modeLeft=2;t.hold=2;t.flat=0;
  }
  if(x0<900&&t.slope<0.30) t.slope=rr(0.30,0.46);
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
      if(Math.random()<PUSHER_SPAWN_RATE) world.npcs.push({x,got:0,wave:Math.random()*TAU});
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

function ensureGuaranteedPusherInRange(minX,maxX){
  const nc=GEN.npc;
  const lo=Math.max(120,minX);
  const hi=maxX;
  if(hi<=lo) return;
  if(world.npcs.some(n=>!n.got&&n.x>=lo&&n.x<=hi)) return;

  for(let x=hi-40;x>=lo;x-=nc.step){
    const tooClosePot=world.pots.some(p=>Math.abs(p.x-x)<nc.clear);
    const tooCloseNpc=world.npcs.some(n=>!n.got&&Math.abs(n.x-x)<nc.clear*0.75);
    if(nearGap(x,nc.gapPad)||tooClosePot||tooCloseNpc) continue;
    if(Math.abs(slopeAt(x))<=Math.max(0.62,nc.maxSlope)){
      world.npcs.push({x,got:0,wave:Math.random()*TAU});
      return;
    }
  }

  // Fallback: still inject one if terrain/spacing checks never found a spot.
  const fallbackX=clamp(hi-80,lo,hi);
  world.npcs.push({x:fallbackX,got:0,wave:Math.random()*TAU});
}

function ensurePusherBeforeBridge(bridgeStartX){
  const latestX=bridgeStartX-FIRST_BRIDGE_PUSHER_LEAD;
  const minX=Math.max(120,player.x+220);
  if(minX>=latestX) return;
  ensureGuaranteedPusherInRange(minX,latestX);
}

function ensurePusherBetweenBridges(prevGap,nextBridgeStartX){
  if(!prevGap) return;
  const minX=Math.max(prevGap.b+BRIDGE_PUSHER_EDGE_PAD,player.x+180);
  let maxX=nextBridgeStartX-BETWEEN_BRIDGES_PUSHER_LEAD;
  if(maxX<=minX) maxX=nextBridgeStartX-BRIDGE_PUSHER_EDGE_PAD;
  if(maxX<=minX) return;
  ensureGuaranteedPusherInRange(minX,maxX);
}

function ensureWorld(toX){
  const startX=world.lastX;
  const bc=GEN.bridge;
  while(world.lastX<toX){
    const x0=world.lastX,y0=world.lastY;
    if(x0>world.nextGap&&x0>bc.safeStart&&Math.random()<bc.chance){
      const prevGap=world.gaps.length?world.gaps[world.gaps.length-1]:null;
      const firstBridge=!prevGap;
      const lastI=world.pts.length-1;
      if(lastI>0){
        const prev=world.pts[lastI-1];
        world.pts[lastI].s=(y0-prev.y)/(x0-prev.x||1);
      }
      const rawGapW=rr(bc.width[0],bc.width[1]);
      const gapT=clamp((rawGapW-bc.width[0])/(bc.width[1]-bc.width[0]||1),0,1);
      const gapW=rawGapW*BRIDGE_WIDTH_SCALE;

      const approach=rr(
        lerp(bc.approachLen[0]*0.78,bc.approachLen[0],gapT),
        lerp(bc.approachLen[1]*1.02,bc.approachLen[1]*1.42,gapT)
      );
      const approachSlope=rr(
        lerp(bc.approachSlope[0]*0.72,bc.approachSlope[0]*0.96,gapT),
        lerp(bc.approachSlope[1]*0.88,bc.approachSlope[1]*1.42,gapT)
      );
      const x1=x0+approach,y1=y0+approach*approachSlope;
      addPoint(x1,y1,approachSlope,1);
      const rampLen=rr(
        lerp(bc.rampLen[0]*0.82,bc.rampLen[0],gapT),
        lerp(bc.rampLen[1]*1.04,bc.rampLen[1]*1.56,gapT)
      );
      const rampSlope=rr(
        lerp(bc.rampSlope[0]*0.76,bc.rampSlope[0]*1.02,gapT),
        lerp(bc.rampSlope[1]*0.88,bc.rampSlope[1]*1.48,gapT)
      );
      const x2=x1+rampLen,y2=y1+rampLen*rampSlope;
      addPoint(x2,y2,rampSlope,1);
      const lipLen=rr(
        lerp(bc.lipLen[0]*0.9,bc.lipLen[0],gapT),
        lerp(bc.lipLen[1]*1.0,bc.lipLen[1]*1.18,gapT)
      );
      // Keep takeoff as a true ramp cutoff: no flattening cap near the edge.
      const lipSlope=rampSlope;
      const takeoffX=x2+lipLen,takeoffY=y2+lipLen*lipSlope;
      addPoint(takeoffX,takeoffY,lipSlope,1);
      const gapBottom=takeoffY+rr(
        lerp(bc.btmDrop[0]*0.9,bc.btmDrop[0]*1.04,gapT),
        lerp(bc.btmDrop[1]*0.95,bc.btmDrop[1]*1.24,gapT)
      );
      world.gaps.push({
        a:takeoffX,b:takeoffX+gapW,btm:gapBottom,river:Math.random()<0.5,seed:Math.random(),
        w:gapW,t:gapT
      });
      if(firstBridge) ensurePusherBeforeBridge(takeoffX);
      else ensurePusherBetweenBridges(prevGap,takeoffX);
      const downSlope1=rr(
        lerp(bc.settleSlope1[0]*0.66,bc.settleSlope1[0]*0.9,gapT),
        lerp(bc.settleSlope1[1]*0.78,bc.settleSlope1[1]*1.06,gapT)
      );
      const downSlope2=rr(
        lerp(bc.settleSlope2[0]*0.68,bc.settleSlope2[0]*0.92,gapT),
        lerp(bc.settleSlope2[1]*0.8,bc.settleSlope2[1]*1.1,gapT)
      );
      const landX=takeoffX+gapW;
      const landY=takeoffY+rr(
        lerp(bc.landDrop[0]*1.2,bc.landDrop[0]*0.72,gapT),
        lerp(bc.landDrop[1]*1.26,bc.landDrop[1]*0.82,gapT)
      );
      addPoint(landX,landY,downSlope1,1);
      const downLen1=rr(
        lerp(bc.settleLen1[0]*0.84,bc.settleLen1[0],gapT),
        lerp(bc.settleLen1[1]*1.04,bc.settleLen1[1]*1.42,gapT)
      );
      const down1X=landX+downLen1,down1Y=landY+downLen1*downSlope1;
      addPoint(down1X,down1Y,(downSlope1+downSlope2)*0.5,1);
      const downLen2=rr(
        lerp(bc.settleLen2[0]*0.84,bc.settleLen2[0],gapT),
        lerp(bc.settleLen2[1]*1.05,bc.settleLen2[1]*1.5,gapT)
      );
      const down2X=down1X+downLen2,down2Y=down1Y+downLen2*downSlope2;
      addPoint(down2X,down2Y,downSlope2,1);
      world.lastX=down2X;world.lastY=down2Y;
      world.nextGap=down2X+rr(bc.min,bc.max)+gapW*0.22;
      world.terrain.hold=0;world.terrain.modeLeft=0;world.terrain.flat=0;
    }else{
      const len=rr(GEN.terrain.lenMin,GEN.terrain.lenMax);
      const s=nextTerrainSlope(x0);
      let y=y0+len*s;
      if(Math.abs(y-y0)<10) y=y0+len*rr(0.18,0.40);
      const climbCap=Math.min(GEN.terrain.maxRisePerSeg,Math.max(8,len*0.085));
      if(y<y0-climbCap) y=y0-climbCap;
      const globalFloor=world.deepY-GEN.terrain.maxRiseFromDeep;
      if(y<globalFloor) y=globalFloor;
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
  world.stoppedPushers=world.stoppedPushers.filter(v=>v.x>cut-140);
}

function resetRun(){
  mode='play';reason='';score=0;newBest=0;rollT=0;
  world.pts=[{x:-240,y:300},{x:0,y:320}];
  world.gaps=[];world.pots=[];world.npcs=[];world.stoppedPushers=[];
  world.lastX=0;world.lastY=320;world.deepY=320;
  world.nextPot=GEN.pot.start;world.nextNpc=GEN.npc.start;world.nextGap=GEN.bridge.start;
  world.terrain.slope=0.32;world.terrain.target=0.40;world.terrain.hold=0;world.terrain.flat=0;world.terrain.mode='flow';world.terrain.modeLeft=0;
  player.x=80;player.speed=68;player.vx=0;player.vy=0;player.on=1;player.ang=0;
  player.have=0;player.boost=0;player.swerve=0;player.airY=0;player.stall=0;player.potholeDip=0;player.potholeSlow=0;player.pusherIncoming=0;player.pusherStartX=0;player.boostCarry=0;
  player.pusherX=0;player.pusherY=0;player.pusherWave=0;player.pusherActive=0;player.pusherDropped=0;
  centerCues.length=0;actPulse=0;
  ensureWorld(player.x+2200);
  const gy=groundY(player.x)||320;
  player.y=gy-BUGGY.rideHeight;
  camX=player.x-W*0.33;camY=player.y-H*camFollowY;
  startX=player.x;
}

function startRunFromTitle(){
  mode='play';reason='';score=0;newBest=0;rollT=0;
  centerCues.length=0;actPulse=0;
  input.call=0;input.act=0;
  btn.call.active=0;btn.act.active=0;
  const gy=groundY(player.x)||320;
  player.y=gy-BUGGY.rideHeight;
  player.on=1;
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

function failInput(){
  queueCenterCue('FAIL!',{dur:0.86,size:30,col:'#ff6b6b',stroke:'rgba(70,0,0,0.65)'});
  player.speed*=0.7;
  if(!player.on) player.vx=Math.max(10,player.vx*0.7);
  sfx('hit');
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
      queueCenterCue('+1 PUSHER',{dur:0.96,size:28,col:'#b8e6ff'});
    }
    return;
  }
  if(nearPot){
    nearPot.dodge=1;nearPot.flash=0.22;player.swerve=0.28;
    sfx('swerve');burst(nearPot.x,groundY(nearPot.x)-8,8,'#aad0ef',90);
    queueCenterCue('SWERVED!',{dur:0.96,size:29,col:'#ffe08f'});
    return;
  }
  failInput();
}

function tryCall(){
  if(mode!=='play') return;
  if(player.have<=0){failInput();return;}
  if(player.boost<=0&&player.pusherIncoming<=0){
    queueCenterCue(btn.call.label,{dur:0.88,size:24,col:'#b8e6ff'});
    player.have--;
    player.pusherIncoming=PUSHER_RUN;
    player.pusherDropped=0;
    player.pusherStartX=camX-PUSHER_FOLLOW_OFFSET;
    player.pusherWave=Math.random()*TAU;
    player.pusherX=player.pusherStartX;
    const startGy=groundY(player.pusherStartX);
    player.pusherY=startGy==null?player.y+12:startGy;
    player.pusherActive=1;
    sfx('boost');burst(player.x-15,player.y+8,14,'#ffde94',150);
  }
}

function pushStoppedPusher(x,y,wave){
  if(!Number.isFinite(x)||!Number.isFinite(y)) return;
  world.stoppedPushers.push({x,y,wave});
  if(world.stoppedPushers.length>12) world.stoppedPushers.shift();
}

function stopActivePusherVisual(){
  if(!player.pusherActive) return;
  pushStoppedPusher(player.pusherX,player.pusherY,player.pusherWave);
  player.pusherActive=0;
  player.pusherDropped=1;
}

function updatePusherVisual(){
  if(player.pusherDropped){
    if(player.pusherIncoming<=0&&player.boost<=0) player.pusherDropped=0;
    return;
  }

  if(player.pusherIncoming>0){
    if(!player.on){
      stopActivePusherVisual();
      return;
    }
    const t=1-player.pusherIncoming/PUSHER_RUN;
    const eased=1-Math.pow(1-t,2);
    const targetX=player.x-PUSHER_FOLLOW_OFFSET;
    const px=player.pusherStartX+(targetX-player.pusherStartX)*eased;
    const gy=groundY(px);
    if(gy==null){
      stopActivePusherVisual();
      return;
    }
    player.pusherX=px;
    player.pusherY=gy;
    player.pusherActive=1;
    return;
  }

  if(player.boost>0){
    if(!player.pusherActive){
      if(!player.on) return;
      const startX=player.x-PUSHER_FOLLOW_OFFSET;
      const gy0=groundY(startX);
      if(gy0==null) return;
      player.pusherActive=1;
      player.pusherWave=Math.random()*TAU;
      player.pusherX=startX;
      player.pusherY=gy0;
    }

    if(!player.on){
      stopActivePusherVisual();
      return;
    }

    const px=player.x-PUSHER_FOLLOW_OFFSET;
    const gy=groundY(px);
    if(gy==null){
      stopActivePusherVisual();
      return;
    }
    player.pusherX=px;
    player.pusherY=gy;
    return;
  }

  if(player.pusherActive) stopActivePusherVisual();
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
    if(player.boost<=0) player.boostCarry=BOOST_RECOVER_TIME;
    if(Math.random()<0.7) burst(player.x-20,player.y+7,1,'#ffe68f',90);
    if(Math.random()<0.3) burst(player.x-18,player.y+5,1,'#ffb347',70);
  }
  if(player.boostCarry>0) player.boostCarry=Math.max(0,player.boostCarry-dt);

  player.swerve=Math.max(0,player.swerve-dt);
  player.potholeDip=Math.max(0,player.potholeDip-dt*3);
  player.potholeSlow=Math.max(0,player.potholeSlow-dt);

  if(player.on){
    const sl=slopeAt(player.x);
    const slopeAcc=sl*SLOPE_GRAVITY;
    let acc=(slopeAcc>=0?slopeAcc*ACCEL_SCALE:slopeAcc*DECEL_SCALE)-22*DECEL_SCALE;
    if(player.boost>0) acc+=385*ACCEL_SCALE;
    if(player.potholeSlow>0) acc-=240*DECEL_SCALE;
    const hardCap=MAX_SPEED*BOOST_MAX_MULT;
    player.speed+=acc*dt;
    player.speed=Math.max(0,Math.min(hardCap,player.speed));
    if(player.boost<=0){
      if(player.boostCarry>0&&player.speed>MAX_SPEED){
        player.speed=Math.max(MAX_SPEED,player.speed-BOOST_RECOVER_DECEL*dt);
      }else if(player.speed>MAX_SPEED){
        player.speed=MAX_SPEED;
      }
    }
    player.x+=player.speed*dt;
    const gy=groundY(player.x);
    if(gy==null){
      player.on=0;
      player.vx=Math.max(12,player.speed);
      player.vy=sl*player.speed*0.48;
      player.airY=player.y;
    }else{
      player.y=gy-BUGGY.rideHeight;
      player.ang=Math.atan(sl);
      if(player.speed>44&&Math.random()<0.35) burst(player.x-18,gy-4,1,'#c9ae84',40);
    }
  }else{
    const prevX=player.x,prevY=player.y;
    player.ang+=0.75*dt;
    if(player.boost>0) player.vx+=96*ACCEL_SCALE*dt;
    player.vy+=BUGGY.airGravity*dt;
    player.x+=player.vx*dt;
    player.y+=player.vy*dt;

    const wallHit=findGapWallHit(prevX,prevY,player.x,player.y);
    if(wallHit){endRun('Hit the cliff wall',1);return;}

    const q=gapAt(player.x);
    if(q&&player.y>q.btm){
      if(q.river) burst(player.x,player.y,22,'#5ab8e0',220);
      endRun(q.river?'Fell in the river':'Missed the bridge',0);return;
    }

    const touch=findGroundTouch(prevX,prevY,player.x,player.y);
    if(touch){
      const sa=Math.atan(touch.slope);
      const bodyErr=Math.abs(normAng(player.ang-sa));
      const velAng=Math.atan2(player.vy,Math.max(1,player.vx));
      const impactErr=Math.abs(normAng(velAng-sa));
      const hard=player.vy>BUGGY.maxLandVY||touch.y-player.airY>BUGGY.maxLandDrop;
      if(bodyErr>BUGGY.maxBodyErr||impactErr>BUGGY.maxImpactErr||hard){endRun('Bad landing',1);return;}
      player.on=1;
      player.x=touch.x;
      player.y=touch.y;
      player.speed=Math.max(16,player.vx*0.92);
      player.vx=0;player.vy=0;player.ang=sa;
      burst(player.x,touch.gy-3,8,'#d3b082',110);
    }
    if(player.y>camY+H+260){endRun('Could not recover',0);return;}
  }

  updatePusherVisual();

  for(let i=0;i<world.pots.length;i++){
    const p=world.pots[i];
    if(p.flash>0) p.flash-=dt;
    if(!p.done&&player.x>p.x+8){
      p.done=1;
      if(!p.dodge){
        player.potholeSlow=0.3;
        player.potholeDip=0.35;
        burst(p.x,groundY(p.x)-6,12,'#6e5a3f',140);
        sfx('hit');
        queueCenterCue('OOF',{dur:0.92,size:26,col:'#ffd7bf'});
      }
    }
  }

  if(player.on&&player.speed<5) player.stall+=dt;
  else player.stall=0;
  if(player.stall>1.05){endRun('Out of momentum',0);return;}

  score=Math.max(0,Math.floor((player.x-startX)/10));
  camX+=(player.x-W*0.30-camX)*Math.min(1,dt*4.5);
  camY+=(player.y-H*camFollowY-camY)*Math.min(1,dt*4.2);
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
    // Darker, higher-contrast pothole body so hazards read clearly at speed.
    g.fillStyle=flash?'rgba(70,140,182,.45)':'rgba(0,0,0,.44)';
    g.beginPath();g.ellipse(0,2,r*1.1,rh*1.1,0,0,TAU);g.fill();
    // Inner hole
    g.fillStyle=flash?'#2d6d91':'#0d0704';
    g.beginPath();g.ellipse(0,0,r*0.75,rh*0.7,0,0,TAU);g.fill();
    g.strokeStyle=flash?'rgba(125,198,234,.8)':'rgba(182,132,94,.55)';
    g.lineWidth=2;
    g.beginPath();g.ellipse(0,0,r*0.77,rh*0.72,0,0,TAU);g.stroke();
    // Cracks
    g.strokeStyle=flash?'rgba(70,140,182,.8)':'rgba(0,0,0,.55)';
    g.lineWidth=1.4;g.lineCap='round';
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

function drawPusherFigure(x,y,opt){
  const o=opt||{};
  const sx=x-camX;
  if(sx<-50||sx>W+50) return;

  const running=!!o.running;
  const runSpeed=o.runSpeed||8;
  const wave=o.wave||0;
  const alpha=o.alpha==null?1:o.alpha;
  let armSwing=0,legLift=0,legBack=0,lean=0;

  if(running){
    const runPhase=tNow*runSpeed+wave;
    legLift=Math.abs(Math.sin(runPhase))*(o.legLift||6);
    legBack=Math.sin(runPhase)*(o.legBack||3);
    armSwing=Math.sin(runPhase)*(o.armSwing||3.5);
    lean=o.lean==null?-0.18:o.lean;
  }else{
    const idle=Math.sin(tNow*2+wave)*0.7;
    armSwing=idle*0.4;
    legBack=idle*0.3;
  }

  g.save();
  g.globalAlpha*=alpha;
  g.translate(sx,y-camY);
  g.rotate(lean);
  g.strokeStyle='#f7d58d';g.lineWidth=3;g.lineCap='round';
  g.beginPath();
  g.moveTo(0,-8);g.lineTo(0,-38);
  g.moveTo(0,-30);g.lineTo(8+armSwing,-24);
  g.moveTo(0,-30);g.lineTo(-8-armSwing,-22);
  if(running){
    g.moveTo(0,-8);g.lineTo(3+legBack,-2+legLift);
    g.moveTo(0,-8);g.lineTo(-3-legBack,-2-legLift);
  }else{
    g.moveTo(0,-8);g.lineTo(3+legBack,3);
    g.moveTo(0,-8);g.lineTo(-3-legBack,3);
  }
  g.stroke();
  g.fillStyle='#f7d58d';g.beginPath();g.arc(0,-42,4.5,0,TAU);g.fill();
  g.restore();
}

function drawPotholeSpriteScreen(sx,sy,opt){
  const o=opt||{};
  const r=o.r||20;
  const rh=r*0.45;
  const flash=!!o.flash;
  const ang=o.ang||0;
  g.save();
  g.translate(sx,sy);
  g.rotate(ang);
  g.fillStyle=flash?'rgba(70,140,182,.45)':'rgba(0,0,0,.44)';
  g.beginPath();g.ellipse(0,2,r*1.1,rh*1.1,0,0,TAU);g.fill();
  g.fillStyle=flash?'#2d6d91':'#0d0704';
  g.beginPath();g.ellipse(0,0,r*0.75,rh*0.7,0,0,TAU);g.fill();
  g.strokeStyle=flash?'rgba(125,198,234,.8)':'rgba(182,132,94,.55)';
  g.lineWidth=2;
  g.beginPath();g.ellipse(0,0,r*0.77,rh*0.72,0,0,TAU);g.stroke();
  g.strokeStyle=flash?'rgba(70,140,182,.8)':'rgba(0,0,0,.55)';
  g.lineWidth=1.4;g.lineCap='round';
  for(let j=0;j<4;j++){
    const a=j*1.5+0.4;
    g.beginPath();
    g.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*rh*0.6);
    g.lineTo(Math.cos(a)*r*1.2,Math.sin(a)*rh*1.1);
    g.stroke();
  }
  g.restore();
}

function drawActionTutorialPanel(){
  const bw=Math.min(W*0.9,560);
  const bh=Math.min(H*0.24,150);
  const bx=W*0.5-bw*0.5;
  const by=Math.max(120,Math.min(H*0.58,btn.act.y-bh-30));
  const grad=g.createLinearGradient(bx,by,bx,by+bh);
  grad.addColorStop(0,'rgba(17,20,25,.94)');
  grad.addColorStop(1,'rgba(12,16,20,.92)');
  g.fillStyle=grad;
  roundRect(bx,by,bw,bh,14);g.fill();
  g.strokeStyle='rgba(222,232,242,.35)';
  g.lineWidth=2;
  g.stroke();

  g.textAlign='center';
  g.fillStyle='rgba(232,239,247,.9)';
  g.font='800 12px system-ui,sans-serif';
  g.fillText('ACTION TARGETS',W*0.5,by+20);

  const sx=bx+16,sy=by+30,sw=bw-32,sh=bh-46;
  const sky=g.createLinearGradient(sx,sy,sx,sy+sh);
  sky.addColorStop(0,'rgba(92,122,150,.55)');
  sky.addColorStop(0.7,'rgba(73,93,112,.42)');
  sky.addColorStop(1,'rgba(49,60,72,.36)');
  g.fillStyle=sky;
  roundRect(sx,sy,sw,sh,10);g.fill();
  g.strokeStyle='rgba(220,232,244,.24)';
  g.lineWidth=1.5;
  g.stroke();

  const gy=sy+sh*0.85;
  g.fillStyle='rgba(84,60,39,.9)';
  roundRect(sx+4,gy,sw-8,sh-(gy-sy)-2,8);g.fill();
  g.strokeStyle='rgba(35,23,14,.6)';
  g.lineWidth=1.2;
  g.beginPath();
  g.moveTo(sx+8,gy+1);
  g.lineTo(sx+sw-8,gy+1);
  g.stroke();

  const px=sx+sw*0.22;
  const hx=sx+sw*0.78;
  drawPusherFigure(camX+px,camY+gy+2,{wave:0.1});
  drawPotholeSpriteScreen(hx,gy+4,{r:Math.max(14,sw*0.032),ang:-0.08});

  g.fillStyle='rgba(240,246,252,.92)';
  g.font='700 10px system-ui,sans-serif';
  g.fillText('PUSHER: ACTION collects it',px,gy+20);
  g.fillText('POTHOLE: ACTION swerves it',hx,gy+20);
  g.textAlign='left';
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

  for(let i=0;i<world.stoppedPushers.length;i++){
    const p=world.stoppedPushers[i];
    drawPusherFigure(p.x,p.y,{alpha:PUSHER_STOP_ALPHA,wave:p.wave});
  }

  if(player.pusherActive){
    const incoming=player.pusherIncoming>0;
    drawPusherFigure(player.pusherX,player.pusherY,{
      running:incoming||player.boost>0,
      runSpeed:incoming?18:8,
      legLift:incoming?10:6,
      legBack:incoming?6:3,
      armSwing:incoming?5:3.5,
      lean:-0.18,
      wave:player.pusherWave
    });
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
  const bw=Math.round(Math.min(W*0.4,btn.act.r*3.5)),bh=Math.round(12*s);
  const bx=W*0.5-bw*0.5;
  const speedPad=Math.max(18,Math.min(W,H)*0.03);
  const chromeLift=Math.max(0,H*chromeLossRatio*0.18);
  const speedBottomPad=Math.max(speedPad*0.8,safeB+speedPad*0.3)+chromeLift*0.5;
  const by=H-speedBottomPad-bh;
  const v=Math.min(1,player.speed/420);
  const br=bh*0.5;
  g.globalAlpha=0.35;g.fillStyle='#fff';g.font='600 '+Math.max(10,Math.round(11*s))+'px system-ui,sans-serif';
  g.textAlign='center';g.fillText('SPEED',W*0.5,by-4);g.textAlign='left';
  g.globalAlpha=0.45;g.fillStyle='#000';
  roundRect(bx,by,bw,bh,br);g.fill();
  g.globalAlpha=0.8;
  g.fillStyle=v>.67?'#67e18f':v>.34?'#ffd36a':'#ff8c5a';
  if(v>0){roundRect(bx+1,by+1,(bw-2)*v,bh-2,br-1);g.fill();}
  g.globalAlpha=1;
}

function drawPusherReserve(){
  const reserve=getPusherReserveMetrics();
  if(!reserve) return;
  const {maxSlots,slotW,slotH,gap,totalW,sx,sy,labelY,labelSize}=reserve;
  const tutTarget=tutorialFocusKey();
  const isTutTarget=(mode==='title'&&tutTarget==='reserve');
  const deEmphasis=(mode==='title'&&tutTarget&&tutTarget!=='reserve')?0.52:1;

  if(isTutTarget){
    const padX=Math.max(10,slotW*0.34);
    const padY=Math.max(8,slotH*0.34);
    const boxX=sx-padX;
    const boxY=sy-padY;
    const boxW=totalW+padX*2;
    const boxH=(labelY+Math.max(14,labelSize*0.75))-boxY;
    g.globalAlpha=0.16;
    g.fillStyle='#f2f6fb';
    roundRect(boxX,boxY,boxW,boxH,12);g.fill();
    g.globalAlpha=0.62;
    g.strokeStyle='rgba(238,243,251,.78)';
    g.lineWidth=2;
    roundRect(boxX,boxY,boxW,boxH,12);g.stroke();
    g.globalAlpha=1;
  }

  g.textAlign='center';
  for(let i=0;i<maxSlots;i++){
    const filled=i<player.have;
    const x=sx+i*(slotW+gap);
    const r=Math.max(5,slotW*0.28);
    g.globalAlpha=(filled?0.88:0.45)*deEmphasis;
    g.fillStyle=filled?'rgba(174,234,255,0.95)':'rgba(255,255,255,0.20)';
    roundRect(x,sy,slotW,slotH,r);g.fill();
    g.globalAlpha=(filled?0.92:0.50)*deEmphasis;
    g.strokeStyle=filled?'rgba(210,245,255,0.95)':'rgba(255,255,255,0.45)';
    g.lineWidth=2;
    roundRect(x,sy,slotW,slotH,r);g.stroke();

    const cx=x+slotW*0.5;
    const headY=sy+slotH*0.34;
    g.globalAlpha=(filled?0.98:0.50)*deEmphasis;
    g.fillStyle=filled?'#083347':'#f2f2f2';
    g.beginPath();g.arc(cx,headY,slotW*0.16,0,TAU);g.fill();
    g.strokeStyle=g.fillStyle;
    g.lineWidth=Math.max(2,slotW*0.11);
    g.lineCap='round';
    g.beginPath();
    g.moveTo(cx,headY+slotW*0.2);
    g.lineTo(cx,sy+slotH*0.82);
    g.moveTo(cx-slotW*0.16,sy+slotH*0.56);
    g.lineTo(cx+slotW*0.16,sy+slotH*0.56);
    g.stroke();
  }

  g.globalAlpha=0.70*deEmphasis;
  g.fillStyle='#fff';
  g.font='700 '+labelSize+'px system-ui,sans-serif';
  g.fillText('PUSHERS '+player.have+'/'+maxSlots,btn.call.x,labelY);
  g.globalAlpha=1;
  g.textAlign='left';
}

function getPusherReserveMetrics(){
  const maxSlots=player.maxHave;
  if(maxSlots<=0) return null;
  const scale=1.15;
  const slotW=Math.max(20,btn.call.r*0.34)*scale;
  const slotH=Math.round(slotW*1.2);
  const gap=Math.max(8,slotW*0.2);
  const totalW=maxSlots*slotW+(maxSlots-1)*gap;
  const sx=btn.call.x-totalW*0.5;
  const sy=btn.call.y+btn.call.r+12;
  const labelSize=Math.max(10,Math.round(btn.call.r*0.15))*scale;
  const labelY=sy+slotH+Math.max(13,btn.call.r*0.18);
  return {maxSlots,slotW,slotH,gap,totalW,sx,sy,labelSize,labelY};
}

function tutorialFocusTarget(){
  if(mode!=='title') return null;
  if(tutorialStep===1){
    const r=getPusherReserveMetrics();
    if(!r) return null;
    return {
      x:btn.call.x,
      y:r.sy+r.slotH*0.58,
      r:Math.max(r.totalW*0.44,r.slotH*1.8),
      key:'reserve'
    };
  }
  if(tutorialStep===2) return {x:btn.call.x,y:btn.call.y,r:btn.call.r+9,key:'call'};
  if(tutorialStep===3) return {x:btn.act.x,y:btn.act.y,r:btn.act.r+9,key:'act'};
  if(tutorialStep===4) return {x:btn.act.x,y:btn.act.y,r:btn.act.r+9,key:'act'};
  return null;
}

function tutorialFocusKey(){
  const t=tutorialFocusTarget();
  return t&&t.key?t.key:'';
}

function getSkipRect(){
  const w=Math.round(clamp(W*0.24,140,180));
  const h=68;
  return {x:W-w-16,y:12,w,h,r:h*0.5};
}

function hitSkip(px,py){
  if(tutorialStep<1||tutorialStep>=5) return 0;
  const s=getSkipRect();
  return px>=s.x&&px<=s.x+s.w&&py>=s.y&&py<=s.y+s.h;
}

function drawButton(b,key){
  const active=b.active>0;
  // allow per-button disabled flag (b.disabled) but keep existing call-specific rule
  const callDisabled = (key==='call' && player.have===0);
  const bDisabled = !!b.disabled;
  const disabled = callDisabled || bDisabled;
  const tutTarget=tutorialFocusKey();
  const isTutTarget=(mode==='title'&&tutTarget&&key===tutTarget);
  const deEmphasis=(mode==='title'&&tutTarget&&key!==tutTarget)?0.5:1;
  const baseAlpha=(disabled?0.55:active?0.98:0.85)*deEmphasis;
  if(isTutTarget){
    const glowR=b.r+16+Math.sin(tNow*3.6)*1.5;
    const glow=g.createRadialGradient(b.x,b.y,b.r*0.68,b.x,b.y,glowR);
    glow.addColorStop(0,'rgba(235,242,250,0.22)');
    glow.addColorStop(0.7,'rgba(226,235,246,0.1)');
    glow.addColorStop(1,'rgba(226,235,246,0)');
    g.globalAlpha=1;
    g.fillStyle=glow;
    g.beginPath();g.arc(b.x,b.y,glowR,0,TAU);g.fill();
  }
  g.globalAlpha=baseAlpha;
  g.fillStyle=disabled?'#666':key==='call'?'#2e91d8':'#6fbf4f';
  g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
  g.strokeStyle=disabled?'rgba(255,255,255,.65)':'rgba(255,255,255,.98)';g.lineWidth=3;g.stroke();

  if(isTutTarget){
    const pulse=(Math.sin(tNow*4.4)+1)*0.5;
    g.globalAlpha=0.52;
    g.strokeStyle='rgba(239,245,253,0.95)';
    g.lineWidth=2.4;
    g.beginPath();g.arc(b.x,b.y,b.r+8+pulse*2,0,TAU);g.stroke();
  }

  // Expanding pulse ring when action button becomes available
  if(key==='act'&&actPulse>0){
    const t=1-actPulse/0.38; // 0→1 over the pulse lifetime
    const pulseR=b.r+t*22;
    g.globalAlpha=Math.max(0,(1-t)*0.7);
    g.strokeStyle='#ffe08f';g.lineWidth=3;
    g.beginPath();g.arc(b.x,b.y,pulseR,0,TAU);g.stroke();
    actPulse=Math.max(0,actPulse-1/60);
  }

  // Keep labels/icons on buttons for readability while center cues animate separately.
  const textEmphasis=(mode==='title'&&tutTarget&&key!==tutTarget)?0.78:1;
  g.globalAlpha=(disabled?0.85:1.0)*textEmphasis;
  g.fillStyle=disabled?'#e1e1e1':'#fff';
  g.textAlign='center';
  if(b.icon){
    g.font='italic 800 '+Math.max(22,b.r*0.52)+'px system-ui,sans-serif';
    g.fillText(b.icon,b.x,b.y-2);
    g.font='italic 800 '+Math.max(14,b.r*0.288)+'px system-ui,sans-serif';
    g.fillText(String(b.label||'').toUpperCase(),b.x,b.y+Math.max(15,b.r*0.34));
  }else{
    const label=String(b.label||'').toUpperCase();
    if(key==='call'&&label==='CALL PUSHER'){
      g.font='italic 800 '+Math.max(17,b.r*0.312)+'px system-ui,sans-serif';
      g.fillText('CALL',b.x,b.y-Math.max(2,b.r*0.1));
      g.font='italic 800 '+Math.max(16,b.r*0.299)+'px system-ui,sans-serif';
      g.fillText('PUSHER',b.x,b.y+Math.max(16,b.r*0.36));
    }else{
      g.font='italic 800 '+Math.max(17,b.r*0.36)+'px system-ui,sans-serif';
      g.fillText(label,b.x,b.y+5);
    }
  }
  g.textAlign='left';
  g.globalAlpha=1;
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
  const pulse=(Math.sin(tNow*3.1)+1)*0.5;
  const focus=hb?{x:hb.x,y:hb.y,r:Math.max(34,hb.r)}:null;
  g.save();
  if(focus){
    const innerR=focus.r+12+pulse*1.4;
    const outerR=innerR*1.8;
    g.fillStyle='rgba(6,9,13,.84)';
    g.beginPath();
    g.rect(0,0,W,H);
    g.arc(focus.x,focus.y,innerR,0,TAU,true);
    g.fill('evenodd');
    const glow=g.createRadialGradient(focus.x,focus.y,innerR*0.6,focus.x,focus.y,outerR);
    glow.addColorStop(0,'rgba(232,240,248,0.16)');
    glow.addColorStop(0.66,'rgba(232,240,248,0.08)');
    glow.addColorStop(1,'rgba(232,240,248,0)');
    g.fillStyle=glow;
    g.beginPath();g.arc(focus.x,focus.y,outerR,0,TAU);g.fill();
    const wave=(tNow*0.62)%1;
    const rr=innerR+6+wave*16;
    g.globalAlpha=(1-wave)*0.36;
    g.strokeStyle='rgba(235,242,250,0.95)';
    g.lineWidth=2;
    g.beginPath();g.arc(focus.x,focus.y,rr,0,TAU);g.stroke();
    g.globalAlpha=1;
  }else{
    g.fillStyle='rgba(6,9,13,.72)';
    g.fillRect(0,0,W,H);
  }
  g.restore();

  g.textAlign='center';
  g.font='700 17px system-ui,sans-serif';
  const bw=Math.min(W*0.88,Math.max(272,g.measureText(text).width+74));
  const bh=94;
  const bx=W*0.5-bw*0.5;
  const preferredY=focus?focus.y-focus.r-bh-118:H*0.30-bh*0.5;
  const by=Math.max(14,Math.min(H-bh-22,preferredY));
  const grad=g.createLinearGradient(bx,by,bx,by+bh);
  grad.addColorStop(0,'rgba(20,23,28,.95)');
  grad.addColorStop(1,'rgba(28,31,36,.92)');
  g.fillStyle=grad;
  roundRect(bx,by,bw,bh,12);g.fill();
  g.strokeStyle='rgba(221,230,240,.48)';g.lineWidth=2;g.stroke();
  g.fillStyle='rgba(214,222,233,.72)';
  roundRect(bx+16,by+11,110,22,11);g.fill();
  g.fillStyle='#1a222c';
  g.font='800 12px system-ui,sans-serif';
  g.fillText('TUTORIAL',bx+71,by+27);
  g.fillStyle='#eef3f8';
  g.font='700 18px system-ui,sans-serif';
  g.fillText(text,W*0.5,by+57);
  g.fillStyle='rgba(232,238,245,.74)';
  g.font='600 13px system-ui,sans-serif';
  g.fillText('Tap anywhere to continue',W*0.5,by+78+Math.sin(tNow*5)*1.6);
  if(focus){
    const ax=clamp(focus.x,bx+24,bx+bw-24);
    const ay=focus.y-focus.r-12;
    g.strokeStyle='rgba(224,233,243,.78)';
    g.lineWidth=2.4;
    g.lineCap='round';
    g.beginPath();
    g.moveTo(ax,by+bh+2);
    g.lineTo(ax,ay);
    g.stroke();
    g.fillStyle='rgba(224,233,243,.78)';
    g.beginPath();
    g.moveTo(ax-7,ay+10);
    g.lineTo(ax+7,ay+10);
    g.lineTo(ax,ay-2);
    g.closePath();
    g.fill();
  }
  g.textAlign='left';
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
  drawButton(btn.act,'act');
  drawPusherReserve();
  drawCenterCues();

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
      tutBox('You can hold up to 3 pushers at once',tutorialFocusTarget());
    }else if(tutorialStep===2){
      tutBox('Tap CALL PUSHER to activate a boost',tutorialFocusTarget());
    }else if(tutorialStep===3){
      tutBox('Dodge potholes or pick up pushers nearby',tutorialFocusTarget());
    }else if(tutorialStep===4){
      tutBox('Press ACTION near these to collect pushers and swerve potholes.',tutorialFocusTarget());
      drawActionTutorialPanel();
    }else{
      const lines=['All 446 Pittsburgh bridges are down,','so you\'ll have to jump the gaps!','Run out of speed or crash = run over.'];
      const bw=Math.min(W*0.9,560),bh=188;
      const bx=W*0.5-bw*0.5,by=Math.max(40,H*0.2);
      const card=g.createLinearGradient(bx,by,bx,by+bh);
      card.addColorStop(0,'rgba(20,23,28,.96)');
      card.addColorStop(1,'rgba(15,18,23,.94)');
      g.fillStyle=card;
      roundRect(bx,by,bw,bh,14);g.fill();
      g.strokeStyle='rgba(220,230,240,.24)';
      g.lineWidth=2;
      g.stroke();

      g.fillStyle='rgba(228,236,245,.86)';
      roundRect(bx+16,by+14,130,24,12);g.fill();
      g.fillStyle='#1b242f';
      g.font='800 12px system-ui,sans-serif';
      g.fillText('BRIDGE ALERT',bx+81,by+30);

      g.fillStyle='#f0f5fa';
      g.font='700 19px system-ui,sans-serif';
      g.fillText(lines[0],W*0.5,by+67);
      g.font='600 17px system-ui,sans-serif';
      g.fillStyle='rgba(233,241,249,.9)';
      g.fillText(lines[1],W*0.5,by+94);
      g.fillStyle='rgba(241,198,192,.9)';
      g.fillText(lines[2],W*0.5,by+122);

      const sbw=Math.min(280,bw-72),sbh=48;
      const sbx=W*0.5-sbw*0.5,sby=by+bh+24;
      const pulse=(Math.sin(tNow*4)+1)*0.5;
      g.fillStyle='rgba(173,54,54,.78)';
      roundRect(sbx,sby,sbw,sbh,24);g.fill();
      g.strokeStyle='rgba(247,208,208,'+(0.58+pulse*0.22)+')';
      g.lineWidth=2.2;
      g.stroke();
      g.fillStyle='#fff4f4';
      g.font='800 22px system-ui,sans-serif';
      g.fillText('TAP TO START',W*0.5,sby+sbh*0.65);
    }
    if(tutorialStep>=1&&tutorialStep<5){
      const s=getSkipRect();
      const skipPulse=(Math.sin(tNow*4.4)+1)*0.5;
      g.fillStyle='rgba(10,13,18,.58)';
      roundRect(s.x,s.y,s.w,s.h,s.r);g.fill();
      g.strokeStyle='rgba(222,232,243,'+(0.34+skipPulse*0.12)+')';
      g.lineWidth=2;
      g.stroke();
      g.textAlign='center';
      g.fillStyle='#dbe6f2';
      g.font='800 28px system-ui,sans-serif';
      g.fillText('SKIP \u25B6',s.x+s.w*0.5,s.y+s.h*0.62);
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
    g.fillStyle='#db3f3f';
    g.font='800 '+Math.round(38*Math.min(1,s))+'px system-ui,sans-serif';
    g.fillText('GAME OVER',cx,by+Math.round(48*Math.min(1,s)));
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
  updateCenterCues(dt);
  if(mode==='play'&&W>=H) updatePlay(dt);
  else{
    if(mode==='title'){
      tutorialTimer+=dt;
    }
    ensureWorld(player.x+W+1200);
    if(mode!=='over'){
      const gy=groundY(player.x)||320;
      camX+=(player.x-W*0.33-camX)*Math.min(1,dt*3.2);
      camY+=(gy-BUGGY.rideHeight-H*camFollowY-camY)*Math.min(1,dt*3);
    }
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
  if(mode==='play'&&(e.key==='a'||e.key==='A')){input.call=1;btn.call.active=0.18;audioInit()}
  if(mode==='play'&&(e.key===' '||e.key==='ArrowUp')){input.act=1;btn.act.active=0.18;audioInit()}
  if((e.key==='Enter'||e.key==='r'||e.key==='R')&&mode!=='play'){
    audioInit();
    if(mode==='title') startRunFromTitle();
    else resetRun();
  }
  if((e.key===' '||e.key==='ArrowUp')&&mode!=='play'){
    audioInit();
    if(mode==='title') startRunFromTitle();
    else resetRun();
  }
  if(['ArrowUp',' '].includes(e.key)) e.preventDefault();
}

function hitButton(x,y){
  for(const k of ['call','act']){
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
    if(hitSkip(px,py)){
      startRunFromTitle();
    }else if(tutorialStep<5){
      tutorialStep++;
      tutorialTimer=0;
    }else{
      startRunFromTitle();
    }
    e.preventDefault();
    return;
  }
  if(mode!=='play'){
    resetRun();
    e.preventDefault();
    return;
  }
  if(k==='call'){input.call=1;btn.call.active=0.18;}
  else if(k==='act'){input.act=1;btn.act.active=0.18;}
  e.preventDefault();
}

function loop(ms){
  const dt=Math.min(0.033,(ms-(loop.t||ms))*0.001);loop.t=ms;
  update(dt);render();
  requestAnimationFrame(loop);
}

addEventListener('resize',resize);
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
addEventListener('keydown',keyDown,{passive:false});
c.addEventListener('pointerdown',pointerDown,{passive:false});
resize();
resetRun();
mode='title';
requestAnimationFrame(loop);
})();
