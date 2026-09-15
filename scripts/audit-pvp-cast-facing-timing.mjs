/* KELO-INDEX
 * area: TEST / PVP / APPEARANCE
 * keys: PVP CAST AIM FACING WINDUP ACTIVE RECOVERY 60HZ 90HZ 120HZ TIMELINE
 * hace: valida con la timeline real que el aim-facing solo cubra windup+active y libere locomotion-facing al entrar en recovery
 * online: N/A; usa la primitiva temporal compartida cliente/server y no crea autoridad ni gameplay paralelo
 */
import timeline from '../src/abilities/ability-action-timeline.js';

const FIREBALL={action:{windup:0.075,active:0.025,recovery:0.18,movementScale:0.78}};
const rates=[60,90,120];
const results=[];

function aimCommitted(state){
  return !!(state&&!state.done&&(state.phase==='windup'||state.phase==='active'));
}

for(const hz of rates){
  const dt=1/hz;
  const state=timeline.create(FIREBALL);
  let elapsed=0;
  let previous=aimCommitted(state);
  let releaseAt=null;
  let transitions=0;
  const samples=[];
  for(let step=0;step<120&&!state.done;step++){
    samples.push({step,elapsed:+elapsed.toFixed(6),phase:state.phase,aimCommitted:aimCommitted(state)});
    timeline.advance(state,dt);
    elapsed+=dt;
    const current=aimCommitted(state);
    if(current!==previous){
      transitions++;
      if(!current&&state.phase==='recovery')releaseAt=elapsed;
      previous=current;
    }
  }
  if(releaseAt==null)throw new Error(`NO_RECOVERY_RELEASE_${hz}`);
  if(transitions!==1)throw new Error(`UNEXPECTED_FACE_TRANSITIONS_${hz}_${transitions}`);
  const ideal=FIREBALL.action.windup+FIREBALL.action.active;
  const errorMs=Math.abs(releaseAt-ideal)*1000;
  if(errorMs>(1000/hz)+0.01)throw new Error(`RELEASE_ERROR_TOO_HIGH_${hz}_${errorMs.toFixed(3)}ms`);
  if(samples.some(s=>s.phase==='recovery'&&s.aimCommitted))throw new Error(`RECOVERY_AIM_LOCK_${hz}`);
  if(samples.some(s=>(s.phase==='windup'||s.phase==='active')&&!s.aimCommitted))throw new Error(`CAST_PHASE_LOST_AIM_${hz}`);
  results.push({hz,idealReleaseMs:ideal*1000,observedReleaseMs:+(releaseAt*1000).toFixed(3),releaseErrorMs:+errorMs.toFixed(3),transitions});
}
console.log(JSON.stringify({policy:'aim on windup+active; locomotion on recovery',results},null,2));
console.log('PVP_CAST_FACING_TIMING_OK');
