/* KELO-INDEX
 * area: QA / UNIVERSAL SPRITE INGESTION
 * owner: deterministic core adversarial audit
 * keys: SPRITE CORPUS FOREGROUND LAYOUT RIG NORMALIZE METRICS
 * purpose: exercise 20+ distinct degradations without a browser or network
 * online: N/A
 */
import assert from 'node:assert/strict';
import {interpretSpriteLayout} from '../src/creators/sprite-compiler/sprite-layout-interpreter.mjs';
import {interpretSpriteRig} from '../src/creators/sprite-compiler/sprite-rig-interpreter.mjs';
import {planSpriteFrameNormalization} from '../src/creators/sprite-compiler/sprite-frame-normalizer.mjs';

const COLUMNS = 4;
const ROWS = 4;

function sheet(spec = {}) {
  const layout = spec.layout || 'grid';
  const columns = layout === 'vertical' ? 1 : layout === 'horizontal' ? 4 : COLUMNS;
  const rows = layout === 'horizontal' ? 1 : layout === 'vertical' ? 4 : ROWS;
  const stepX = spec.stepX || 38;
  const stepY = spec.stepY || 48;
  const marginX = spec.marginX ?? 10;
  const marginY = spec.marginY ?? 8;
  const width = spec.width || marginX + (columns - 1) * stepX + 34 + (spec.rightMargin ?? 10);
  const height = spec.height || marginY + (rows - 1) * stepY + 44 + (spec.bottomMargin ?? 8);
  const data = new Uint8ClampedArray(width * height * 4);
  const background = spec.background || [0, 0, 0, 0];
  for (let pixel = 0; pixel < width * height; pixel++) {
    data[pixel * 4] = background[0];
    data[pixel * 4 + 1] = background[1];
    data[pixel * 4 + 2] = background[2];
    data[pixel * 4 + 3] = background[3];
  }
  if (spec.texture) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const light = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
    const offset = (y * width + x) * 4;
    data[offset] = light ? 194 : 63;
    data[offset + 1] = light ? 161 : 78;
    data[offset + 2] = light ? 132 : 91;
    data[offset + 3] = 255;
  }
  const set = (x, y, color = [37, 69, 126, 255]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3];
  };
  const omit = new Set(spec.omit || []);
  const count = layout === 'grid' ? 16 : 4;
  for (let index = 0; index < count; index++) {
    if (omit.has(index)) continue;
    const row = layout === 'vertical' ? index : layout === 'horizontal' ? 0 : Math.floor(index / 4);
    const column = layout === 'vertical' ? 0 : layout === 'horizontal' ? index : index % 4;
    const scale = spec.scales?.[index] || 1;
    const centerX = Math.round(marginX + column * stepX + 12 + (spec.xOffsets?.[index] || 0) + (spec.columnOffsets?.[column] || 0));
    const foot = Math.round(marginY + row * stepY + 36 + (spec.yOffsets?.[index] || 0) + (spec.rowOffsets?.[row] || 0));
    const bodyWidth = Math.max(7, Math.round(16 * scale));
    const bodyHeight = Math.max(11, Math.round(23 * scale));
    const radius = Math.max(3, Math.round(6 * scale));
    if (spec.halo) {
      for (let y = foot - bodyHeight - radius * 2 - 2; y <= foot + 2; y++) for (let x = centerX - bodyWidth / 2 - 2; x <= centerX + bodyWidth / 2 + 2; x++) {
        const nearBody = y >= foot - bodyHeight - 2 && Math.abs(x - centerX) <= bodyWidth / 2 + 2;
        const nearHead = (x - centerX) ** 2 + (y - (foot - bodyHeight - radius)) ** 2 <= (radius + 2) ** 2;
        if (nearBody || nearHead) set(Math.round(x), y, spec.halo);
      }
    }
    for (let y = foot - bodyHeight; y < foot; y++) for (let x = Math.round(centerX - bodyWidth / 2); x <= Math.round(centerX + bodyWidth / 2); x++) set(x, y);
    for (let y = foot - bodyHeight - radius * 2; y <= foot - bodyHeight; y++) for (let x = centerX - radius; x <= centerX + radius; x++) {
      if ((x - centerX) ** 2 + (y - (foot - bodyHeight - radius)) ** 2 <= radius ** 2) set(x, y);
    }
  }
  if (spec.bridge) {
    const y = marginY + 23;
    for (let x = marginX + 20; x < marginX + stepX + 5; x++) set(x, y);
  }
  return {data, width, height};
}

const alternatingX = new Array(16).fill(0).map((_, index) => index % 2 ? 5 : -4);
const alternatingY = new Array(16).fill(0).map((_, index) => index % 3 === 0 ? 7 : index % 3 === 1 ? -5 : 1);
const cases = [
  {id:'transparent',tier:'GOOD'},
  {id:'white-background',tier:'IRREGULAR',background:[255,255,255,255]},
  {id:'black-background',tier:'IRREGULAR',background:[0,0,0,255]},
  {id:'gray-background',tier:'IRREGULAR',background:[126,126,126,255]},
  {id:'color-background',tier:'IRREGULAR',background:[72,168,148,255]},
  {id:'imperfect-alpha',tier:'IRREGULAR',background:[244,238,226,228]},
  {id:'background-halo',tier:'IRREGULAR',background:[255,255,255,255],halo:[238,238,238,255]},
  {id:'asymmetric-margins',tier:'IRREGULAR',marginX:29,marginY:2,rightMargin:2,bottomMargin:34,width:190,height:230},
  {id:'variable-x-gutters',tier:'IRREGULAR',columnOffsets:[0,8,-2,13],width:190},
  {id:'variable-y-gutters',tier:'IRREGULAR',rowOffsets:[0,8,-4,12],height:225},
  {id:'frame-x-shifts',tier:'IRREGULAR',xOffsets:alternatingX},
  {id:'frame-y-shifts',tier:'IRREGULAR',yOffsets:alternatingY},
  {id:'scale-plus-15',tier:'IRREGULAR',scales:{5:1.15}},
  {id:'scale-minus-10',tier:'IRREGULAR',scales:{10:.90}},
  {id:'mixed-scale',tier:'IRREGULAR',scales:{1:1.08,6:.92,11:1.14,14:.94}},
  {id:'oversized-canvas',tier:'IRREGULAR',marginX:48,marginY:37,width:280,height:280},
  {id:'tight-spacing',tier:'IRREGULAR',stepX:24},
  {id:'touching-spacing',tier:'IRREGULAR',stepX:20},
  {id:'row-misalignment',tier:'IRREGULAR',rowOffsets:[0,4,-2,3],xOffsets:alternatingX,height:220},
  {id:'free-positioned',tier:'IRREGULAR',stepX:46,stepY:55,xOffsets:alternatingX,yOffsets:alternatingY,width:220,height:245},
  {id:'horizontal-strip',tier:'IRREGULAR',layout:'horizontal',expectedFrames:4,expectedDirections:1},
  {id:'vertical-strip',tier:'IRREGULAR',layout:'vertical',expectedFrames:4,expectedDirections:1},
  {id:'variable-frame-counts',tier:'IRREGULAR',omit:[7,15],expectedFrames:14},
  {id:'small-bridge',tier:'IRREGULAR',bridge:true},
  {id:'accidental-empty',tier:'EXTREME',omit:[6],expectedFrames:15,review:true},
  {id:'source-clipping',tier:'EXTREME',marginX:-5,width:130,review:true},
  {id:'complex-background',tier:'EXTREME',background:[129,117,105,255],texture:true,review:true}
];

assert.ok(cases.length >= 20, 'adversarial corpus must contain at least twenty distinct cases');
const results = [];
for (const spec of cases) {
  const source = sheet(spec);
  const layout = interpretSpriteLayout(source.data, source.width, source.height);
  const expectedFrames = spec.expectedFrames || 16;
  const expectedDirections = spec.expectedDirections || 4;
  if (!spec.review) assert.equal(layout.best.evidence.detectedFrames, expectedFrames, `${spec.id}: frame recovery`);
  const rig = interpretSpriteRig(layout.best, {fileName: `${spec.id}-${expectedDirections}dir.png`, rigHint: expectedDirections});
  if (!spec.review) assert.equal(rig.best.directions, expectedDirections, `${spec.id}: rig recovery`);
  const plan = planSpriteFrameNormalization(rig.best, {sourceWidth: source.width, sourceHeight: source.height});
  assert.equal(plan.outputMetrics.footAnchorDispersionPx, 0, `${spec.id}: foot anchor`);
  assert.equal(plan.outputMetrics.centerDrift, 0, `${spec.id}: center anchor`);
  assert.ok(plan.outputMetrics.heightVariation <= plan.sourceMetrics.heightVariation + .015, `${spec.id}: height normalization`);
  if (spec.review) assert.ok(layout.reviewRequired || rig.reviewRequired || plan.artDefects.length || layout.best.evidence.detectedFrames !== 16, `${spec.id}: review gate`);
  results.push({id:spec.id,tier:spec.tier,frames:layout.best.evidence.detectedFrames,layout:layout.best.mode,layoutScore:Number(layout.best.score.toFixed(3)),clipping:Number(layout.best.evidence.clipping.toFixed(3)),boundaryTouches:Number(layout.best.evidence.boundaryTouches.toFixed(3)),confidence:Number(layout.confidence.toFixed(3)),directions:rig.best.directions,review:layout.reviewRequired||rig.reviewRequired||plan.artDefects.length>0,reviewReasons:[...layout.reviewReasons,...rig.reviewReasons],sourceHeightVariation:Number(plan.sourceMetrics.heightVariation.toFixed(4))});
}

const tiers = Object.fromEntries(['GOOD','IRREGULAR','EXTREME'].map(tier => [tier, results.filter(result => result.tier === tier).length]));
console.log(JSON.stringify({ok:true,cases:results.length,tiers,results},null,2));
