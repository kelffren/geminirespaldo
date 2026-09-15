/* KELO-INDEX
 * area: QA / CAMERA / PVP
 * owner: Camera Foundation CI
 * keys: CAMERA PVP ACTION FRAMING 60HZ 90HZ 120HZ A-B
 * purpose: compara Candidate A decay=12 contra winner decay=9 para el lead screen-space de una acción PvP estacionaria
 */
const LEAD_PX=28;
const COMMIT_SECONDS=.18;
const TOTAL_SECONDS=.52;
function simulate(hz,decay){
  const dt=1/hz;let t=0,lead=0,peak=0,maxStep=0,committedPeak=0;
  while(t<TOTAL_SECONDS-1e-9){
    const active=t<COMMIT_SECONDS;
    const target=active?LEAD_PX:0;
    const prev=lead;
    lead+=(target-lead)*(1-Math.exp(-decay*dt));
    maxStep=Math.max(maxStep,Math.abs(lead-prev));
    peak=Math.max(peak,Math.abs(lead));
    if(active)committedPeak=Math.max(committedPeak,Math.abs(lead));
    t+=dt;
  }
  return {hz,decay,peakPx:peak,committedPeakPx:committedPeak,maxStepPx:maxStep,residualPx:Math.abs(lead)};
}
const results=[];
for(const hz of [60,90,120]){
  const a=simulate(hz,12),b=simulate(hz,9);
  const bWins=b.committedPeakPx>=20&&b.maxStepPx<a.maxStepPx&&b.maxStepPx<4&&b.residualPx<1.2;
  if(!bWins)throw new Error(`STATIONARY_ACTION_CAMERA_FAIL_${hz} ${JSON.stringify({a,b})}`);
  results.push({hz,candidateA:a,winnerB:b,verdict:'B_WINS_CONTINUITY'});
}
const spread=Math.max(...results.map(r=>r.winnerB.committedPeakPx))-Math.min(...results.map(r=>r.winnerB.committedPeakPx));
if(spread>.5)throw new Error(`STATIONARY_ACTION_CAMERA_REFRESH_SPREAD ${spread}`);
console.log('PVP_STATIONARY_ACTION_CAMERA_OK '+JSON.stringify({leadPx:LEAD_PX,committedSeconds:COMMIT_SECONDS,results,peakSpreadPx:spread}));
