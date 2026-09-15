/* KELO-INDEX
 * area: QA / MOVEMENT TIMING
 * owner: blocked-foot-plant deterministic audit
 * keys: MOVEMENT BLOCKED FOOT PLANT 60HZ 90HZ 120HZ TIMING
 * purpose: comprueba que el settle temporal de input bloqueado sea estable entre 60/90/120 Hz y siga siendo corto
 * online: N/A; solo auditoria determinista de presentacion
 * do-not: NO gameplay, NO autoridad, NO tuning
 */
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../engine-ac.js',import.meta.url),'utf8');
const m=source.match(/const BLOCKED_SETTLE_SEC = ([0-9.]+);/);
if(!m)throw new Error('BLOCKED_SETTLE_SEC_MISSING');
const threshold=Number(m[1]);
const rows=[];
for(const hz of [60,90,120]){
  const dt=1/hz;let elapsed=0,steps=0;
  while(elapsed+1e-12<threshold){elapsed+=dt;steps++;if(steps>30)throw new Error('SETTLE_LOOP');}
  rows.push({hz,steps,settleMs:elapsed*1000,overshootMs:(elapsed-threshold)*1000});
}
const min=Math.min(...rows.map(r=>r.settleMs));
const max=Math.max(...rows.map(r=>r.settleMs));
const spread=max-min;
const ok=threshold>=0.025&&threshold<=0.05&&max<=55&&spread<=10;
console.log(JSON.stringify({ok,thresholdMs:threshold*1000,rows,spreadMs:spread},null,2));
if(!ok)throw new Error('BLOCKED_FOOT_PLANT_TIMING_REGRESSION');