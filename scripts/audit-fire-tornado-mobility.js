/* KELO-INDEX
 * area: PVP / ABILITY / AUDIT
 * owner: audit only
 * keys: FIRE TORNADO MOVEMENT CAST FEEL 60HZ 90HZ 120HZ BASELINE WINNER
 * purpose: bloquea el movementScale ganador de Fire Tornado y lo compara contra el baseline .38 sin tocar gameplay
 * online: valida data compartida por cliente y server; N/A como autoridad
 * do-not: NO mutar runtime ni balance
 */
'use strict';
const data=require('../src/abilities/abilityData.js');
const ability=(data.ABILITIES||[]).find(a=>a&&a.key==='fire_tornado');
if(!ability)throw new Error('FIRE_TORNADO_MISSING');
const action=ability.action||{};
const SPEED=185.28,BASELINE=.38,WINNER=.52;
const duration=Number(action.windup||0)+Number(action.active||0)+Number(action.recovery||0);
const candidate=Number(action.movementScale);
if(!Number.isFinite(candidate))throw new Error('FIRE_TORNADO_SCALE_INVALID');
if(Math.abs(candidate-WINNER)>1e-9)throw new Error(`FIRE_TORNADO_WINNER_CHANGED:${candidate}`);
if(candidate<=BASELINE)throw new Error('FIRE_TORNADO_MOBILITY_NOT_IMPROVED');
if(candidate>=.56)throw new Error('FIRE_TORNADO_TOO_FREE_FOR_ULTIMATE');
function continuous(scale){return SPEED*duration*scale;}
function fixed(hz,scale){const dt=1/hz;let elapsed=0,distance=0;while(elapsed+1e-9<duration){distance+=SPEED*scale*dt;elapsed+=dt;}return distance;}
const out={ability:ability.key,durationSec:duration,scaleBefore:BASELINE,scaleAfter:candidate,winner:WINNER,continuous:{beforePx:continuous(BASELINE),afterPx:continuous(candidate),gainPx:continuous(candidate)-continuous(BASELINE),freePx:continuous(1)},fixed:[60,90,120].map(hz=>({hz,beforePx:fixed(hz,BASELINE),afterPx:fixed(hz,candidate),gainPx:fixed(hz,candidate)-fixed(hz,BASELINE)}))};
for(const row of out.fixed){if(row.gainPx<=0)throw new Error('NO_GAIN_'+row.hz);}
console.log('FIRE_TORNADO_MOBILITY_WINNER_OK');
console.log(JSON.stringify(out,null,2));
