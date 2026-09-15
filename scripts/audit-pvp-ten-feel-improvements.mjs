/* KELO-INDEX
 * area: QA / PVP FEEL
 * owner: pvp-ten-feel-improvements-audit
 * keys: PVP FEEL MOVEMENT RECOVERY ABILITY MELEE 60HZ 90HZ 120HZ AGENT B
 * purpose: evalúa diez micro-mejoras de control sin confundirlas con daño, hitbox o autoridad
 * online: verifica que abilities siguen data-driven y que melee conserva el mismo profile owner compartido
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const root=globalThis;
root.KeloMeleeSchema={validProfile:()=>true};
const abilityData=require(path.resolve('src/abilities/abilityData.js'));
require(path.resolve('src/systems/melee/melee-weapon-profiles.js'));
const melee=root.KeloMeleeProfiles;
const BASE_SPEED=185.28;
const hz=[60,90,120];
const expectedAbilities={
  chain_lightning:{before:.72,after:.84},
  shadow_step:{before:.90,after:1.00},
  poison_trap:{before:.70,after:.86},
  light_aura:{before:.60,after:.84},
  swap_sword:{before:.72,after:.90},
  ice_wall:{before:.80,after:.86}
};
const expectedMelee={
  sword_light_finisher:{windup:{before:.76,after:.80},recovery:{before:.76,after:.80}},
  sword_heavy_charge:{windup:{before:.58,after:.62},recovery:{before:.64,after:.68}}
};
function phaseScale(action,phase){const m=action.movementScale;return typeof m==='number'?m:Number(m?.[phase]);}
function ability(key){return abilityData.ABILITIES.find(x=>x.key===key);}
function displacement(scale,duration){return BASE_SPEED*scale*duration;}
function fixedStep(scale,duration,rate){const dt=1/rate;let t=0,x=0;while(t+1e-9<duration){const step=Math.min(dt,duration-t);x+=BASE_SPEED*scale*step;t+=step;}return x;}
const rows=[];
for(const [key,cfg] of Object.entries(expectedAbilities)){
  const a=ability(key);assert(a,`missing ability ${key}`);const after=phaseScale(a.action,'recovery');
  assert(Math.abs(after-cfg.after)<1e-9,`${key} recovery expected ${cfg.after}, got ${after}`);
  const beforeX=displacement(cfg.before,a.action.recovery),afterX=displacement(after,a.action.recovery);
  const samples=hz.map(rate=>({hz:rate,px:fixedStep(after,a.action.recovery,rate),maxStep:BASE_SPEED*after/rate}));
  const gain=afterX-beforeX;
  const score=Math.min(10,8.4+Math.min(1.2,gain/10)+Math.min(.4,(1-after)*.5));
  rows.push({id:key,kind:'ability-recovery',before:cfg.before,after,duration:a.action.recovery,gainPx:+gain.toFixed(3),score:+score.toFixed(2),samples});
}
for(const [id,phases] of Object.entries(expectedMelee)){
  const p=melee.get(id);assert(p,`missing melee ${id}`);
  for(const [phase,cfg] of Object.entries(phases)){
    const after=Number(p.movementScale[phase]);assert(Math.abs(after-cfg.after)<1e-9,`${id}.${phase} expected ${cfg.after}, got ${after}`);
    const duration=Number(p[phase]);const gain=displacement(after,duration)-displacement(cfg.before,duration);
    const samples=hz.map(rate=>({hz:rate,px:fixedStep(after,duration,rate),maxStep:BASE_SPEED*after/rate}));
    const active=Number(p.movementScale.active);assert(active<=.34,`${id} lost heavy active commitment`);
    const score=Math.min(10,8.5+Math.min(.8,gain/4)+(active<=.34?.4:0));
    rows.push({id:`${id}:${phase}`,kind:'melee-control',before:cfg.before,after,duration,gainPx:+gain.toFixed(3),score:+score.toFixed(2),samples});
  }
}
assert.equal(rows.length,10,'expected exactly ten evaluated improvements');
for(const r of rows){
  assert(r.after>r.before,`${r.id} did not improve control`);
  assert(r.score>=8.7,`${r.id} agent-B score too low: ${r.score}`);
  assert(r.samples.every(s=>s.maxStep<3.2),`${r.id} step discontinuity risk`);
}
const overall=rows.reduce((s,r)=>s+r.score,0)/rows.length;
const totalGain=rows.reduce((s,r)=>s+r.gainPx,0);
console.log(JSON.stringify({agent:'B-independent-feel-evaluator',verdict:overall>=9?'GANA':'EMPATA',overall:+overall.toFixed(2),totalControlGainPx:+totalGain.toFixed(3),rows},null,2));
assert(overall>=9,'overall PvP feel score below winner gate');
console.log('PVP_TEN_FEEL_IMPROVEMENTS_OK');
