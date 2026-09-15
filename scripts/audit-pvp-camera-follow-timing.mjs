/* KELO-INDEX
 * area: QA / CAMERA / PVP
 * owner: Camera Foundation CI
 * keys: CAMERA PVP DEADZONE FOLLOW LOOKAHEAD AIM COMPOSITION 60HZ 90HZ 120HZ DETERMINISTIC
 * purpose: instrumenta la matemática de follow de engine-a a 60/90/120 Hz, conserva dead-zone semántica y certifica la composición perpendicular de aim sin introducir snap
 * online: N/A; cámara local de presentación
 */
const EPS=1e-9;
const speed=185.28;
const tuning=Object.freeze({deadXRatio:.10,lookAheadDist:36,lookAheadDecay:4,dampX:8});
const AIM_WINNER=.5;
const AIM_REFINED=.45;
const cases=[
  {name:'mobile-landscape',w:844,h:390,baseZoom:1.1079545454545454},
  {name:'desktop-landscape',w:1440,h:900,baseZoom:1.45}
];
function effectiveZoom(c){return c.baseZoom*(c.h/c.w);}
function simulate(c,hz,mode){
  const dt=1/hz,zoom=effectiveZoom(c),deadRatio=mode==='winner'?tuning.deadXRatio/zoom:tuning.deadXRatio;
  const deadWorld=c.w*deadRatio;
  let playerX=0,targetX=0,cameraX=0,lookOffsetX=0,onset=null;
  for(let step=1;step<=hz*3;step++){
    playerX+=speed*dt;
    const lookFactor=1-Math.exp(-tuning.lookAheadDecay*dt);
    lookOffsetX+=(tuning.lookAheadDist-lookOffsetX)*lookFactor;
    const deltaX=(playerX+lookOffsetX)-targetX;
    if(Math.abs(deltaX)>deadWorld){
      targetX+=deltaX-Math.sign(deltaX)*deadWorld;
      if(!onset)onset={step,t:step*dt,playerX,targetX,lookOffsetX,screenOffsetX:(playerX-cameraX)*zoom};
    }
    cameraX+=(targetX-cameraX)*(1-Math.exp(-tuning.dampX*dt));
    if(onset&&step>onset.step+Math.ceil(.25*hz))break;
  }
  return{hz,zoom,deadWorld,deadScreenPx:deadWorld*zoom,semanticPx:c.w*tuning.deadXRatio,onset};
}
function simulateAimFlip(hz,weight){
  const dt=1/hz,factor=1-Math.exp(-tuning.lookAheadDecay*dt),target=Math.abs(weight)*tuning.lookAheadDist;
  let y=0,maxStep=0,crossMs=null;
  for(let i=0;i<Math.ceil(.6*hz);i++)y+=(-target-y)*factor;
  const before=y;
  for(let i=1;i<=Math.ceil(.5*hz);i++){
    const prev=y;y+=(target-y)*factor;maxStep=Math.max(maxStep,Math.abs(y-prev));
    if(crossMs===null&&y>=0)crossMs=i*dt*1000;
  }
  return{hz,weight,target,before,after:y,maxStep,crossMs};
}
const report=[];
const aim=[];
for(const c of cases){
  for(const hz of [60,90,120]){
    const baseline=simulate(c,hz,'baseline');
    const winner=simulate(c,hz,'winner');
    if(Math.abs(winner.deadScreenPx-winner.semanticPx)>EPS)throw new Error(`DEADZONE_PARITY_${c.name}_${hz}`);
    if(!(winner.onset.t>baseline.onset.t))throw new Error(`ONSET_NOT_DELAYED_${c.name}_${hz}`);
    report.push({case:c.name,hz,baseline,winner});
  }
}
for(const hz of [60,90,120]){
  const candidateA=simulateAimFlip(hz,AIM_WINNER),candidateB=simulateAimFlip(hz,AIM_REFINED);
  if(Math.abs(candidateA.before)<=15)throw new Error(`AIM_ROOM_TOO_SMALL_${hz}`);
  if(candidateA.maxStep>=19)throw new Error(`AIM_SNAP_${hz}`);
  if(candidateA.crossMs===null||candidateA.crossMs>220)throw new Error(`AIM_FLIP_TOO_SLOW_${hz}`);
  if(!(Math.abs(candidateA.before)>Math.abs(candidateB.before)))throw new Error(`AIM_A_NOT_CLEARER_THAN_B_${hz}`);
  aim.push({hz,candidateA,candidateB,verdict:'A_WINS_READABILITY'});
}
const spread=Math.max(...aim.map(x=>x.candidateA.crossMs))-Math.min(...aim.map(x=>x.candidateA.crossMs));
if(spread>20)throw new Error(`AIM_REFRESH_SPREAD_${spread}`);
console.log('PVP_CAMERA_TIMING_OK '+JSON.stringify({deadzone:report,aim,aimFlipSpreadMs:spread}));
