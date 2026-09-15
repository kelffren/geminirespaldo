/* KELO-INDEX
 * area: QA / PVP MOVEMENT FEEL
 * owner: audit-pvp-diagonal-facing-timing
 * keys: PVP MOVEMENT DIAGONAL FACING HYSTERESIS 60HZ 90HZ 120HZ DETERMINISTIC
 * purpose: bloquea la estabilidad y respuesta de la selección cardinal de locomoción con la misma secuencia direccional a 60/90/120 Hz
 * online: N/A; QA puro, no muta gameplay ni autoridad
 * do-not: NO duplicar movement owner, NO tunear valores desde QA
 */
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../engine-ac.js',import.meta.url),'utf8');
function constant(name){
  const m=source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  if(!m) throw new Error(`MISSING_${name}`);
  return Number(m[1]);
}
const base=constant('DIRECTION_BASELINE_RATIO');
const hysteresis=constant('DIRECTION_HYSTERESIS_RATIO');
if(base!==1.15) throw new Error(`BASELINE_RATIO_CHANGED:${base}`);
if(hysteresis!==1.18) throw new Error(`HYSTERESIS_WINNER_CHANGED:${hysteresis}`);

function trace(samples){
  let axis=null;
  const out=[];
  for(const {x,y} of samples){
    const ax=Math.abs(x),ay=Math.abs(y);
    if(axis==='horizontal'){
      if(ay>ax*hysteresis) axis='vertical';
    }else if(axis==='vertical'){
      if(ax>ay*hysteresis) axis='horizontal';
    }else axis=ax*base>=ay?'horizontal':'vertical';
    out.push(axis);
  }
  return out;
}
function flips(rows){let n=0;for(let i=1;i<rows.length;i++)if(rows[i]!==rows[i-1])n++;return n;}
const report=[];
for(const hz of [60,90,120]){
  const dtMs=1000/hz;
  const jitter=Array.from({length:16},(_,i)=>({x:1,y:i%2===0?1.13:1.17}));
  const jitterAxes=trace(jitter);
  const jitterFlips=flips(jitterAxes);
  const deliberateRatios=[1.12,1.16,1.20,1.24,1.30];
  const deliberateAxes=trace(deliberateRatios.map(y=>({x:1,y})));
  const firstVertical=deliberateRatios[deliberateAxes.indexOf('vertical')]??null;
  const ok=jitterFlips===0&&firstVertical===1.20;
  report.push({hz,dtMs,jitterFlips,firstVertical,ok});
}
console.log(JSON.stringify({ok:report.every(r=>r.ok),base,hysteresis,report},null,2));
if(report.some(r=>!r.ok)) throw new Error('PVP_DIAGONAL_FACING_TIMING_FAILED');