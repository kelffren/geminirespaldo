/* KELO-INDEX
 * area: TESTS / UNIVERSAL SPRITE INGESTION
 * owner: reproducible labelled adversarial sprite corpus
 * keys: SPRITE CORPUS GOOD IRREGULAR EXTREME BACKGROUND HALO GUTTER OFFSET SCALE CLIP
 * purpose: derive deterministic damaged copies from a known-good real Kelo spritesheet
 * public-api: buildAdversarialSpriteCorpus(root, options)
 * consumes: assets/hero.PNG + browser Canvas
 * state-owned: none
 * do-not: modify the source asset or use generative image repair
 */

const F = Object.freeze;
const GRID_COLUMNS = 4;
const GRID_ROWS = 4;
const FRAME_HEIGHT = 108;
const DEFAULT_STEP_X = 96;
const DEFAULT_STEP_Y = 126;
const DEFAULT_MARGIN_X = 26;
const DEFAULT_MARGIN_Y = 20;

function canvasFor(root, width, height) {
  const canvas = root.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function imageFor(root, url) {
  const image = new root.Image();
  image.decoding = 'async';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`CORPUS_SOURCE_LOAD_FAILED:${url}`));
    image.src = url;
  });
  return image;
}

function alphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] <= 12) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX >= 0 ? {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1} : null;
}

function extractFrames(root, image) {
  const source = canvasFor(root, image.naturalWidth, image.naturalHeight);
  const context = source.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const frames = [];
  for (let row = 0; row < GRID_ROWS; row++) for (let column = 0; column < GRID_COLUMNS; column++) {
    const x0 = Math.floor(column * source.width / GRID_COLUMNS);
    const x1 = Math.floor((column + 1) * source.width / GRID_COLUMNS);
    const y0 = Math.floor(row * source.height / GRID_ROWS);
    const y1 = Math.floor((row + 1) * source.height / GRID_ROWS);
    const imageData = context.getImageData(x0, y0, x1 - x0, y1 - y0);
    const bounds = alphaBounds(imageData.data, imageData.width, imageData.height);
    if (!bounds) throw new Error(`CORPUS_REFERENCE_FRAME_EMPTY:${row}:${column}`);
    const scale = FRAME_HEIGHT / bounds.h;
    const frame = canvasFor(root, Math.max(1, Math.round(bounds.w * scale)), FRAME_HEIGHT);
    const frameContext = frame.getContext('2d');
    frameContext.imageSmoothingEnabled = true;
    frameContext.imageSmoothingQuality = 'high';
    frameContext.drawImage(source, x0 + bounds.x, y0 + bounds.y, bounds.w, bounds.h, 0, 0, frame.width, frame.height);
    frames.push(F({canvas: frame, width: frame.width, height: frame.height, row, column, index: row * GRID_COLUMNS + column}));
  }
  return F(frames);
}

function tintFrame(root, frame, color) {
  const canvas = canvasFor(root, frame.width, frame.height);
  const context = canvas.getContext('2d');
  context.drawImage(frame.canvas, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function fillBackground(context, spec, width, height) {
  if (spec.background === 'transparent' || !spec.background) return;
  if (spec.background === 'texture') {
    context.fillStyle = '#81766a';
    context.fillRect(0, 0, width, height);
    let seed = 1977;
    for (let index = 0; index < 900; index++) {
      seed = (seed * 48271) % 2147483647;
      const x = seed % width;
      seed = (seed * 48271) % 2147483647;
      const y = seed % height;
      const shade = 90 + seed % 90;
      context.fillStyle = `rgba(${shade},${Math.max(0, shade - 12)},${Math.max(0, shade - 24)},.34)`;
      context.fillRect(x, y, 2 + seed % 5, 2 + seed % 5);
    }
    return;
  }
  context.save();
  context.globalAlpha = spec.backgroundAlpha ?? 1;
  context.fillStyle = spec.background;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function selectedIndexes(spec) {
  if (spec.layout === 'single') return [0];
  if (spec.layout === 'horizontal' || spec.layout === 'vertical') return [0, 1, 2, 3];
  const omitted = new Set(spec.omit || []);
  return new Array(16).fill(0).map((_, index) => index).filter(index => !omitted.has(index));
}

function basePosition(index, spec, frame) {
  const row = Math.floor(index / GRID_COLUMNS);
  const column = index % GRID_COLUMNS;
  const marginX = spec.marginX ?? DEFAULT_MARGIN_X;
  const marginY = spec.marginY ?? DEFAULT_MARGIN_Y;
  const stepX = spec.stepX ?? DEFAULT_STEP_X;
  const stepY = spec.stepY ?? DEFAULT_STEP_Y;
  if (spec.layout === 'single') return {x: marginX, foot: marginY + frame.height};
  if (spec.layout === 'horizontal') return {x: marginX + index * stepX, foot: marginY + frame.height};
  if (spec.layout === 'vertical') return {x: marginX, foot: marginY + index * stepY + frame.height};
  const irregularX = spec.xOffsets?.[index] || 0;
  const irregularY = spec.yOffsets?.[index] || 0;
  const gutterX = spec.columnOffsets?.[column] || 0;
  const gutterY = spec.rowOffsets?.[row] || 0;
  return {x: marginX + column * stepX + gutterX + irregularX, foot: marginY + row * stepY + gutterY + frame.height + irregularY};
}

function dimensions(spec, frames, indexes) {
  if (spec.width && spec.height) return {width: spec.width, height: spec.height};
  let right = 0;
  let bottom = 0;
  for (const index of indexes) {
    const frame = frames[index];
    const position = basePosition(index, spec, frame);
    const scale = spec.scales?.[index] || spec.scale || 1;
    right = Math.max(right, position.x + frame.width * scale);
    bottom = Math.max(bottom, position.foot + (spec.footOffsets?.[index] || 0));
  }
  return {width: Math.ceil(right + (spec.rightMargin ?? 28)), height: Math.ceil(bottom + (spec.bottomMargin ?? 24))};
}

function renderCase(root, frames, spec) {
  const indexes = selectedIndexes(spec);
  const size = dimensions(spec, frames, indexes);
  const canvas = canvasFor(root, size.width, size.height);
  const context = canvas.getContext('2d');
  fillBackground(context, spec, canvas.width, canvas.height);
  for (const index of indexes) {
    const frame = frames[index];
    const position = basePosition(index, spec, frame);
    const scale = spec.scales?.[index] || spec.scale || 1;
    const width = frame.width * scale;
    const height = frame.height * scale;
    const x = position.x;
    const foot = position.foot + (spec.footOffsets?.[index] || 0);
    const y = foot - height;
    if (spec.halo) {
      context.save();
      context.filter = `blur(${spec.halo.blur || 2}px)`;
      context.globalAlpha = spec.halo.alpha || .58;
      const tinted = tintFrame(root, frame, spec.halo.color || '#ffffff');
      const spread = spec.halo.spread || 2;
      context.drawImage(tinted, x - spread, y - spread, width + spread * 2, height + spread * 2);
      context.restore();
    }
    context.drawImage(frame.canvas, x, y, width, height);
  }
  if (spec.bridge) {
    const a = frames[spec.bridge[0]];
    const b = frames[spec.bridge[1]];
    const pa = basePosition(spec.bridge[0], spec, a);
    const pb = basePosition(spec.bridge[1], spec, b);
    context.strokeStyle = 'rgba(65,54,45,.9)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(pa.x + a.width, pa.foot - a.height * .45);
    context.lineTo(pb.x, pb.foot - b.height * .45);
    context.stroke();
  }
  return canvas;
}

function specs() {
  const alternatingX = new Array(16).fill(0).map((_, index) => index % 2 ? 13 : -7);
  const alternatingY = new Array(16).fill(0).map((_, index) => index % 3 === 0 ? 9 : index % 3 === 1 ? -6 : 2);
  return F([
    {id:'good-transparent-grid',tier:'GOOD',label:'Reference transparent 4×4',background:'transparent',expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'good-white-grid',tier:'GOOD',label:'Regular grid on white',background:'#ffffff',expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'good-static',tier:'GOOD',label:'Single static sprite',layout:'single',background:'transparent',expectedFrames:1,expectedDirections:1,expectedStatus:'VALIDATED'},
    {id:'irregular-black-background',tier:'IRREGULAR',label:'Black background',background:'#000000',expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-gray-background',tier:'IRREGULAR',label:'Gray background',background:'#747474',expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-color-background',tier:'IRREGULAR',label:'Colored background',background:'#56a69a',expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-imperfect-alpha',tier:'IRREGULAR',label:'Imperfect translucent background',background:'#f5eee1',backgroundAlpha:.91,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-white-halo',tier:'IRREGULAR',label:'White background halos',background:'#ffffff',halo:{color:'#ffffff',blur:2,spread:3,alpha:.72},expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-asymmetric-margin',tier:'IRREGULAR',label:'Asymmetric outer margins',background:'transparent',marginX:73,marginY:9,rightMargin:6,bottomMargin:71,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-variable-x-gutters',tier:'IRREGULAR',label:'Variable horizontal gutters',background:'transparent',columnOffsets:[0,16,3,29],expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-variable-y-gutters',tier:'IRREGULAR',label:'Variable vertical gutters',background:'transparent',rowOffsets:[0,13,-4,21],expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-frame-x-shifts',tier:'IRREGULAR',label:'Per-frame horizontal shifts',background:'transparent',xOffsets:alternatingX,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-frame-y-shifts',tier:'IRREGULAR',label:'Per-frame vertical shifts',background:'transparent',yOffsets:alternatingY,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-scale-plus-15',tier:'IRREGULAR',label:'One frame enlarged 15%',background:'transparent',scales:{5:1.15},expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-scale-minus-10',tier:'IRREGULAR',label:'One frame reduced 10%',background:'transparent',scales:{10:.90},expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-mixed-scale',tier:'IRREGULAR',label:'Mixed small scale drift',background:'transparent',scales:{1:1.08,6:.91,11:1.14,14:.94},expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-feet-offsets',tier:'IRREGULAR',label:'Feet at inconsistent heights',background:'transparent',footOffsets:{1:8,2:-6,5:7,10:-9,15:5},expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-oversized-canvas',tier:'IRREGULAR',label:'Canvas much too large',background:'transparent',width:720,height:720,marginX:122,marginY:82,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-tight-spacing',tier:'IRREGULAR',label:'Sprites too close',background:'transparent',stepX:64,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-slight-overlap',tier:'IRREGULAR',label:'Small overlaps',background:'transparent',stepX:54,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-row-misalignment',tier:'IRREGULAR',label:'Rows imperfectly aligned',background:'transparent',rowOffsets:[0,8,-4,7],xOffsets:alternatingX,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-free-positioned',tier:'IRREGULAR',label:'Free-positioned frames',background:'transparent',stepX:111,stepY:139,xOffsets:alternatingX,yOffsets:alternatingY,expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-horizontal-strip',tier:'IRREGULAR',label:'Horizontal animation strip',layout:'horizontal',background:'#ffffff',stepX:79,expectedFrames:4,expectedDirections:1,expectedStatus:'VALIDATED'},
    {id:'irregular-vertical-strip',tier:'IRREGULAR',label:'Vertical animation strip',layout:'vertical',background:'#111111',stepY:118,expectedFrames:4,expectedDirections:1,expectedStatus:'VALIDATED'},
    {id:'irregular-variable-frame-counts',tier:'IRREGULAR',label:'Different frames per direction',background:'transparent',omit:[7,15],expectedFrames:14,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'irregular-connected-bridge',tier:'IRREGULAR',label:'Two frames joined by a thin bridge',background:'transparent',bridge:[0,1],expectedFrames:16,expectedDirections:4,expectedStatus:'VALIDATED'},
    {id:'extreme-accidental-empty',tier:'EXTREME',label:'Accidental empty frame',background:'transparent',omit:[6],expectedFrames:16,expectedDirections:4,expectedStatus:'REVIEW_REQUIRED'},
    {id:'extreme-source-clipping',tier:'EXTREME',label:'Source artwork clipped by canvas',background:'transparent',xOffsets:[-42],marginX:0,expectedFrames:16,expectedDirections:4,expectedStatus:'REVIEW_REQUIRED'},
    {id:'extreme-large-overlap',tier:'EXTREME',label:'Large overlapping frames',background:'transparent',stepX:39,expectedFrames:16,expectedDirections:4,expectedStatus:'REVIEW_REQUIRED'},
    {id:'extreme-scale-30',tier:'EXTREME',label:'One frame enlarged 30%',background:'transparent',scales:{9:1.30},expectedFrames:16,expectedDirections:4,expectedStatus:'REVIEW_REQUIRED'},
    {id:'extreme-textured-background',tier:'EXTREME',label:'Non-uniform textured background',background:'texture',expectedFrames:16,expectedDirections:4,expectedStatus:'REVIEW_REQUIRED'}
  ]);
}

function blobFor(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('CORPUS_PNG_ENCODE_FAILED')), 'image/png'));
}

export async function buildAdversarialSpriteCorpus(root = globalThis, {sourceUrl = './assets/hero.PNG'} = {}) {
  const image = await imageFor(root, sourceUrl);
  const frames = extractFrames(root, image);
  const cases = [];
  for (const spec of specs()) {
    const canvas = renderCase(root, frames, spec);
    const blob = await blobFor(canvas);
    const file = new root.File([blob], `${spec.id}-${spec.expectedDirections}dir.png`, {type: 'image/png'});
    cases.push(F({...spec, canvas, file, oracle: F({expectedFrames: spec.expectedFrames, expectedDirections: spec.expectedDirections})}));
  }
  return F({version: 'sprite-ingestion-adversarial-corpus-v1.0.0', sourceUrl, sourceFrames: frames, cases: F(cases)});
}

export const __adversarialCorpusInternals = F({alphaBounds, basePosition, dimensions, extractFrames, renderCase, specs});
