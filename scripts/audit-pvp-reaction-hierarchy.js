/* KELO-INDEX
 * area: QA / PVP FEEL
 * owner: pvp-reaction-hierarchy-audit
 * keys: MELEE REACTION COMBO 60HZ 90HZ 120HZ FRAME-INDEPENDENCE
 * purpose: verifica que la jerarquía de recoil corporal M1 sobreviva muestreo 60/90/120 Hz y siga acotada
 */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const visuals=fs.readFileSync(path.join(root,'src/visuals/melee-combat-visuals.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'src/visuals/melee-visual-manifest.js'),'utf8');
function scale(stage){const re=new RegExp(stage+": Object\\.freeze\\(\\{[^}]*reactionScale: ([0-9.]+)");const m=visuals.match(re);if(!m)throw new Error('REACTION_SCALE_MISSING_'+stage);return Number(m[1]);}
const scales=[scale(1),scale(2),scale(3)];
if(!/reactionFor\(face\)[\s\S]*x: v\.x \* 9, y: v\.y \* 9/.test(manifest))throw new Error('BASE_REACTION_AMPLITUDE_CHANGED');
const speeds=[1.06,1.0,.82],duration=.13;
const keys=[{t:0,v:0},{t:.10,v:0},{t:.24,v:9},{t:.52,v:9*.78},{t:1,v:0}];
function sample(p){for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1];if(p<=b.t){const k=Math.max(0,Math.min(1,(p-a.t)/(b.t-a.t||1)));return a.v+(b.v-a.v)*k;}}return 0;}
function peak(hz,stage){const dt=1/hz,s=scales[stage],speed=speeds[stage];let elapsed=0,max=0;while(elapsed<duration+dt){max=Math.max(max,sample(Math.min(1,elapsed/duration))*s);elapsed+=dt*speed;}return max;}
const rows=[60,90,120].map(hz=>{const recoil=[0,1,2].map(i=>peak(hz,i));return{hz,recoil,followVsOpener:recoil[1]/recoil[0],finisherVsFollow:recoil[2]/recoil[1]};});
for(const r of rows){if(!(r.recoil[0]>=7.5&&r.recoil[1]>r.recoil[0]&&r.recoil[2]>r.recoil[1]*1.12&&r.recoil[2]<=14))throw new Error('REACTION_HIERARCHY_FRAME_FAIL_'+r.hz);}
console.log(JSON.stringify({scales,rows},null,2));
