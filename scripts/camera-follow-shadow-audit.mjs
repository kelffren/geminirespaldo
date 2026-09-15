/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION
 * owner: Camera Follow Shadow Audit
 * owns: static safety checks and behavioral parity proof for camera follow shadow
 * does-not-own: runtime camera behavior or migration activation
 * purpose: prove the shadow is read-only and catches both parity and divergence
 * public-api: CLI `node scripts/camera-follow-shadow-audit.mjs`
 * extension-points: add deterministic camera scenarios
 * reuse: CI migration gate
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimePath=path.join(ROOT,'src/core/camera-follow-shadow.js');
const source=fs.readFileSync(runtimePath,'utf8');

for(const banned of ['setTimeout(','setInterval(','requestAnimationFrame(','addEventListener(','saveState(','showToast(']){
  assert(!source.includes(banned),`camera shadow must not use ${banned}`);
}
for(const pattern of [/\bcamera\.(?:x|y|targetX|targetY|lookOffsetX|lookOffsetY)\s*=/,/\blocalPlayer\.(?:x|y|vx|vy|hp|maxHp)\s*=/]){
  assert(!pattern.test(source),'camera shadow must not mutate camera/player state');
}
assert(source.includes("authority:'legacy-only'"),'camera shadow must declare legacy-only authority');
assert(source.includes('SAMPLE_EVERY=8'),'camera shadow must be sampled, not full-rate heavy instrumentation');

function legacyStep(s,wrong=false){
  const dt=s.dt;
  const lookFactor=1-Math.exp(-s.CONFIG.lookAheadDecay*dt);
  s.camera.lookOffsetX+=(s.input.normX*s.CONFIG.lookAheadDist-s.camera.lookOffsetX)*lookFactor;
  s.camera.lookOffsetY+=(s.input.normY*s.CONFIG.lookAheadDist-s.camera.lookOffsetY)*lookFactor;
  const deadW=s.screenW*s.CONFIG.deadXRatio,deadH=s.screenH*s.CONFIG.deadYRatio;
  const deltaX=(s.localPlayer.x+s.camera.lookOffsetX)-s.camera.targetX;
  const deltaY=(s.localPlayer.y+s.camera.lookOffsetY)-s.camera.targetY;
  if(Math.abs(deltaX)>deadW)s.camera.targetX+=deltaX-Math.sign(deltaX)*deadW;
  if(Math.abs(deltaY)>deadH)s.camera.targetY+=deltaY-Math.sign(deltaY)*deadH;
  s.camera.x+=(s.camera.targetX-s.camera.x)*(1-Math.exp(-s.CONFIG.dampX*dt));
  s.camera.y+=(s.camera.targetY-s.camera.y)*(1-Math.exp(-s.CONFIG.dampY*dt));
  if(wrong)s.camera.x+=0.25;
}
function makeSandbox(wrong=false){
  const sandbox={
    Math,Object,Number,Array,console,
    camera:{x:100,y:80,targetX:100,targetY:80,lookOffsetX:4,lookOffsetY:-3},
    localPlayer:{x:180,y:130},input:{normX:.7,normY:-.25},screenW:390,screenH:844,
    CONFIG:{dampX:8,dampY:8,deadXRatio:.1,deadYRatio:.08,lookAheadDist:60,lookAheadDecay:4}
  };
  sandbox.globalThis=sandbox;
  sandbox.updateCamera=function(dt){sandbox.dt=dt;legacyStep({...sandbox,dt},wrong);};
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'camera-follow-shadow.js'});
  return sandbox;
}

const good=makeSandbox(false);
for(let i=0;i<8;i++)good.updateCamera(1/60);
let snap=good.KeloCameraFollowShadow.snapshot();
assert.equal(snap.comparisons,1,'sample cadence should produce one comparison after eight frames');
assert.equal(snap.divergences,0,'matching legacy math must show zero divergence');
assert.equal(snap.matches,1,'matching legacy math must register parity');

const bad=makeSandbox(true);
for(let i=0;i<8;i++)bad.updateCamera(1/60);
snap=bad.KeloCameraFollowShadow.snapshot();
assert.equal(snap.comparisons,1,'divergence scenario should still sample once');
assert.equal(snap.divergences,1,'intentional camera drift must be detected');
assert(snap.last&&snap.last.match===false&&snap.last.maxDelta>0,'divergence evidence must retain delta');

console.log('CAMERA_FOLLOW_SHADOW_OK: read-only camera follow parity contract verified');
