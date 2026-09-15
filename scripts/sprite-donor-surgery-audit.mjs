/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / DONOR SURGERY AUDIT
 * purpose: regression coverage for donor suggestion, ghost-safe policy and selected-region-only overlays
 * gate: whole-frame donor replacement is forbidden; donor copy requires an explicit selected region
 */
import assert from 'node:assert/strict';
import {buildDonorSurgeryPlanFromPixels,donorCandidateFor,donorOverlaySpec} from '../src/creators/sprite-compiler/sprite-donor-surgery-bridge.mjs';

const W=48,H=20,COLS=3,ROWS=1,data=new Uint8ClampedArray(W*H*4);
function fillFrame(frame,x0,y0,x1,y1,r=72,g=138,b=201){const ox=frame*16;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*W+ox+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255}}
fillFrame(0,4,3,11,18);fillFrame(1,4,3,11,18);fillFrame(1,3,9,12,12);fillFrame(2,5,8,10,18);
const doctor={
  frames:[{index:0,reasons:[]},{index:1,reasons:[]},{index:2,reasons:['clipped']}],
  defective:[{index:2,row:0,column:2,reasons:['clipped'],severity:.9}],
  total:3,healthyCount:2,defectiveCount:1
};
const plan=buildDonorSurgeryPlanFromPixels(data,W,H,{columns:COLS,rows:ROWS,frameCounts:[3],frameDoctor:doctor,outlierThreshold:.32});
assert.equal(plan.schema,'kelo-donor-surgery-bridge-v1');
assert.equal(plan.policy.autoReplaceWholeFrame,false);
assert.equal(plan.policy.ghostAutoPreview,true);
assert.equal(plan.policy.copySelectedRegionOnly,true);
assert.equal(plan.policy.generativeLast,true);
const candidate=donorCandidateFor(plan,2);assert.ok(candidate,'expected donor suggestion for defective third frame');
assert.equal(candidate.targetIndex,2);assert.ok([0,1].includes(candidate.donorIndex));assert.notEqual(candidate.donorIndex,2);assert.equal(candidate.ghostRecommended,true);
const blocked=donorOverlaySpec(candidate,null);assert.equal(blocked.ok,false);assert.equal(blocked.reason,'SELECTION_REQUIRED');
const selection={x:.18,y:.08,w:.42,h:.26};const overlay=donorOverlaySpec(candidate,selection,{z:3});assert.equal(overlay.ok,true);assert.equal(overlay.reversible,true);assert.equal(overlay.scope,'selected-region-only');assert.equal(overlay.overlay.kind,'frame');assert.equal(overlay.overlay.sourceFrame,candidate.donorIndex);assert.deepEqual(overlay.overlay.sourceRect,overlay.overlay.frameRect);assert.deepEqual(overlay.overlay.sourceRect,selection);assert.equal(overlay.overlay.z,3);assert.equal(overlay.overlay.cutoutOriginal,false);
assert.equal(donorCandidateFor(plan,0),null);
console.log(JSON.stringify({ok:true,candidateCount:plan.candidateCount,target:2,donor:candidate.donorIndex,selection:overlay.overlay.sourceRect,policy:plan.policy}));
