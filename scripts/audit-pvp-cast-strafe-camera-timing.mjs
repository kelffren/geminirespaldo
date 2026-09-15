/* KELO-INDEX
 * area: TEST / PVP / CAMERA
 * keys: PVP CAMERA CAST STRAFE REVERSAL RELEASE 60HZ 90HZ 120HZ
 * hace: compara baseline, candidate A y candidate B para liberar framing residual de cast al salir en strafe contrario
 * online: N/A; valida matemática pura de presentación sin tocar autoridad gameplay
 */
const START_OFFSET=15.7;
const SETTLE_PX=4;
const variants=[
  {name:'baseline',decay:9},
  {name:'candidateA',decay:18},
  {name:'candidateB',decay:22}
];
function run(hz,decay){
  const dt=1/hz,factor=1-Math.exp(-decay*dt);
  let offset=START_OFFSET,t=0,maxStep=0;
  for(let i=0;i<hz;i++){
    const prev=offset;
    offset+=(0-offset)*factor;
    t+=dt;
    maxStep=Math.max(maxStep,Math.abs(offset-prev));
    if(Math.abs(offset)<=SETTLE_PX)return{hz,decay,settleMs:t*1000,maxStep,offset};
  }
  return{hz,decay,settleMs:null,maxStep,offset};
}
const rows=[];
for(const v of variants)for(const hz of [60,90,120])rows.push({variant:v.name,...run(hz,v.decay)});
const a=rows.filter(r=>r.variant==='candidateA');
const b=rows.filter(r=>r.variant==='candidateB');
if(!a.some(r=>r.settleMs>75))throw new Error('candidate A unexpectedly clears strict response gate; keep A/B evidence honest');
for(const r of b){
  if(r.settleMs==null||r.settleMs>75)throw new Error('candidate B release too slow: '+JSON.stringify(r));
  if(r.maxStep>8)throw new Error('candidate B release snaps: '+JSON.stringify(r));
}
console.table(rows);
console.log(JSON.stringify(rows,null,2));
console.log('PVP_CAST_STRAFE_CAMERA_TIMING_OK winner=candidateB candidateA=EMPATA_RESPONSE');
