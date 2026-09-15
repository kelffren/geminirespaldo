import {analyzeAssetSheetPixels, buildAssetSheetManifest} from '../src/creators/assets/asset-sheet-compiler.mjs';
import {applyAssetReviewPacket, createAssetReviewPacket, createChatGPTReviewPrompt, buildReviewedAssetManifest} from '../src/creators/assets/kelo-creator-asset-bridge.mjs';
import {createAssetSheetWorkspaceManifest} from '../src/creators/workspaces/asset-sheet-workspace.mjs';
import {createCatalogPreviewDefinitions, installAssetSheetCatalogPreview} from '../src/creators/assets/asset-sheet-catalog-preview-adapter.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSET_SHEET_AUDIT_FAILED:${message}`);
}

function pixels(width, height, color = [0, 0, 0, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) data.set(color, index * 4);
  return data;
}

function rect(data, width, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) data.set(color, (py * width + px) * 4);
  }
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function decodePng(buffer) {
  let offset = 8, ihdr = null, palette = null, transparency = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8), start = offset + 8;
    const chunk = buffer.subarray(start, start + length);
    if (type === 'IHDR') ihdr = {width:chunk.readUInt32BE(0), height:chunk.readUInt32BE(4), bitDepth:chunk[8], colorType:chunk[9], interlace:chunk[12]};
    if (type === 'PLTE') palette = chunk;
    if (type === 'tRNS') transparency = chunk;
    if (type === 'IDAT') idat.push(chunk);
    offset = start + length + 4;
    if (type === 'IEND') break;
  }
  assert(ihdr && ihdr.bitDepth === 8 && ihdr.interlace === 0, 'real PNG decoder contract');
  const channels = new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]).get(ihdr.colorType);
  assert(channels, `real PNG color type=${ihdr.colorType}`);
  const rowBytes = ihdr.width * channels, inflated = zlib.inflateSync(Buffer.concat(idat));
  const scanlines = Buffer.alloc(rowBytes * ihdr.height);
  let read = 0;
  for (let y = 0; y < ihdr.height; y += 1) {
    const filter = inflated[read++], row = scanlines.subarray(y * rowBytes, (y + 1) * rowBytes), previous = y ? scanlines.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? row[x - channels] : 0, up = previous ? previous[x] : 0, upperLeft = previous && x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upperLeft) : NaN;
      assert(Number.isFinite(predictor), `real PNG filter=${filter}`);
      row[x] = (inflated[read++] + predictor) & 255;
    }
  }
  const rgba = new Uint8ClampedArray(ihdr.width * ihdr.height * 4);
  for (let pixel = 0; pixel < ihdr.width * ihdr.height; pixel += 1) {
    const source = pixel * channels, target = pixel * 4;
    if (ihdr.colorType === 6) rgba.set(scanlines.subarray(source, source + 4), target);
    else if (ihdr.colorType === 2) { rgba[target]=scanlines[source]; rgba[target+1]=scanlines[source+1]; rgba[target+2]=scanlines[source+2]; rgba[target+3]=255; }
    else if (ihdr.colorType === 4) { rgba[target]=rgba[target+1]=rgba[target+2]=scanlines[source]; rgba[target+3]=scanlines[source+1]; }
    else if (ihdr.colorType === 0) { rgba[target]=rgba[target+1]=rgba[target+2]=scanlines[source]; rgba[target+3]=255; }
    else { const index=scanlines[source], p=index*3; rgba[target]=palette?.[p]||0; rgba[target+1]=palette?.[p+1]||0; rgba[target+2]=palette?.[p+2]||0; rgba[target+3]=transparency?.[index]??255; }
  }
  return {...ihdr, rgba};
}

function buildFixture() {
  const width = 180, height = 120;
  const data = pixels(width, height);
  rect(data, width, 8, 10, 26, 46, [25, 150, 65, 255]);
  rect(data, width, 17, 52, 8, 24, [125, 70, 35, 255]);
  rect(data, width, 48, 12, 25, 42, [220, 105, 160, 255]);
  rect(data, width, 56, 50, 8, 26, [125, 70, 35, 255]);
  rect(data, width, 86, 42, 52, 18, [20, 125, 70, 255]);
  rect(data, width, 100, 37, 5, 7, [235, 210, 80, 255]);
  rect(data, width, 145, 48, 25, 14, [245, 100, 175, 255]);
  return {data, width, height};
}

const fixture = buildFixture();
const analysis = analyzeAssetSheetPixels(fixture.data, fixture.width, fixture.height, {minComponentArea:4, cropPadding:2});
assert(analysis.background.mode === 'edge-connected', 'jpeg-style background mode');
assert(analysis.assets.length >= 4, `asset count=${analysis.assets.length}`);
assert(new Set(analysis.assets.map(asset => asset.assetId)).size === analysis.assets.length, 'stable unique asset ids');
assert(analysis.assets.some(asset => asset.family === 'tree'), 'tree suggestion');
assert(analysis.assets.some(asset => asset.family === 'hedge'), 'hedge suggestion');
for (const asset of analysis.assets) {
  assert(asset.sourceRect.x >= 0 && asset.sourceRect.y >= 0, `${asset.assetId} rect origin`);
  assert(asset.sourceRect.x + asset.sourceRect.w <= fixture.width, `${asset.assetId} rect width`);
  assert(asset.sourceRect.y + asset.sourceRect.h <= fixture.height, `${asset.assetId} rect height`);
  assert(asset.anchor.kind === 'ground-pivot', `${asset.assetId} anchor`);
  assert(asset.collider.authority === 'review-required', `${asset.assetId} collider authority`);
  assert(asset.worldAssetProfile === 'kelo-world-asset-profile-v1', `${asset.assetId} reuses world asset compiler`);
  assert(asset.scale?.preserveAspectRatio === true, `${asset.assetId} scale plan`);
}

const manifest = buildAssetSheetManifest(analysis, {sourceName:'nature-sheet.png'});
assert(manifest.atlas.frameMode === 'irregular', 'irregular atlas output');
assert(manifest.galleries.length >= 2, 'family galleries');
assert(manifest.prefabs.length >= 1, 'prefab suggestions');
const previewDefinitions = createCatalogPreviewDefinitions(manifest);
assert(previewDefinitions.templates.length === manifest.assets.length, 'catalog preview parity');
assert(previewDefinitions.templates.every(template => template.parts[0].assetKey === previewDefinitions.atlasKey), 'catalog atlas ownership');
const registered = {atlas:null, templates:[]};
const preview = installAssetSheetCatalogPreview({root:{KELO_ATLAS_CONTRACT:{register:(key,atlas)=>{registered.atlas={key,atlas};}},KELO_PROPERTY_CATALOG:{registerTemplate:template=>{registered.templates.push(template);return template;}}}, manifest, atlasDataUrl:'data:image/png;base64,iVBORw0KGgo='});
assert(preview.assetCount === manifest.assets.length && preview.durable === false, 'same-session world preview');
assert(registered.atlas.key === previewDefinitions.atlasKey, 'preview atlas registered through owner');

const packet = createAssetReviewPacket(analysis, {sourceName:'nature-sheet.png'});
assert(packet.bridge === 'natural-file-review', 'natural bridge marker');
assert(packet.assets.length === analysis.assets.length, 'review packet parity');
const prompt = createChatGPTReviewPrompt(packet);
assert(prompt.includes('Devuelve SOLO JSON válido'), 'review prompt contract');
const first = packet.assets[0];
const review = {kind:'kelo-asset-review-result', version:'kelo-asset-review-v1', assets:[{assetId:first.assetId, name:'oak-01', family:'tree', category:'nature/tree', layer:'props_back', confidence:0.96, notes:'reviewed'}]};
const merged = applyAssetReviewPacket(analysis, review);
assert(merged.assets[0].label === 'oak-01', 'semantic review merge');
assert(merged.assets[0].sourceRect.x === analysis.assets[0].sourceRect.x, 'review cannot move rectangle');
const reviewedManifest = buildReviewedAssetManifest(analysis, review, {source:{sourceName:'nature-sheet.png'}});
assert(reviewedManifest.assets[0].label === 'oak-01', 'reviewed manifest');

const alphaFixture = pixels(24, 24, [0, 0, 0, 0]);
rect(alphaFixture, 24, 6, 6, 12, 2, [0, 0, 0, 255]);
rect(alphaFixture, 24, 6, 16, 12, 2, [0, 0, 0, 255]);
rect(alphaFixture, 24, 6, 8, 2, 8, [0, 0, 0, 255]);
rect(alphaFixture, 24, 16, 8, 2, 8, [0, 0, 0, 255]);
const alphaAnalysis = analyzeAssetSheetPixels(alphaFixture, 24, 24, {minComponentArea:2, cropPadding:1});
assert(alphaAnalysis.background.mode === 'native-alpha', 'native alpha mode');
assert(alphaAnalysis.assets.length === 1, `native alpha component count=${alphaAnalysis.assets.length}`);
assert(alphaAnalysis.contentRegion.y === 0 && alphaAnalysis.contentRegion.h === 24, 'native alpha keeps every atlas row');
assert(alphaAnalysis.stats.interfaceNoiseDetected === false, 'native alpha never treated as screenshot chrome');

const workspace = createAssetSheetWorkspaceManifest({loader:async()=>({openAssetSheetWorkspace:context=>context})});
assert(workspace.id === 'asset-sheet' && workspace.availability === 'active', 'creator workspace manifest');
for (const [path, token] of [['src/creators/creator-entry.mjs','registerAssetSheetWorkspace'], ['src/creators/ui/creator-hub.mjs',"['asset-sheet','Asset Sheet Studio','active']"]]) {
  if (fs.existsSync(path)) assert(fs.readFileSync(path, 'utf8').includes(token), `creator integration ${path}`);
}

let realAsset = null;
if (fs.existsSync('assets/Arboleskelo1.PNG')) {
  const decoded = decodePng(fs.readFileSync('assets/Arboleskelo1.PNG'));
  const real = analyzeAssetSheetPixels(decoded.rgba, decoded.width, decoded.height);
  const treeCount = real.assets.filter(asset => asset.family === 'tree').length;
  const rowShape = Array.from({length:real.stats.rowCount}, (_, rowIndex) => real.assets.filter(asset => asset.rowIndex === rowIndex).length);
  const familyCounts = Object.fromEntries([...new Set(real.assets.map(asset => asset.family))].sort().map(family => [family, real.assets.filter(asset => asset.family === family).length]));
  const loosePetals = real.assets.at(-1);
  assert(real.assets.length === 18, `real atlas asset count=${real.assets.length}`);
  assert(treeCount === 5, `real atlas tree count=${treeCount}`);
  assert(real.stats.rowCount === 3, `real atlas row count=${real.stats.rowCount}`);
  assert(JSON.stringify(rowShape) === '[5,6,7]', `real atlas row shape=${JSON.stringify(rowShape)}`);
  assert(loosePetals?.sourceComponentIds?.length === 13, `loose petals component count=${loosePetals?.sourceComponentIds?.length}`);
  realAsset = {dimensions:[decoded.width,decoded.height], assets:real.assets.length, rows:real.stats.rowCount, rowShape, trees:treeCount, families:familyCounts, loosePetals:loosePetals.sourceComponentIds.length};
}

console.log(JSON.stringify({
  status:'ASSET_SHEET_COMPILER_AUDIT_OK', version:analysis.version, dimensions:[fixture.width, fixture.height],
  assets:analysis.assets.length, families:[...new Set(analysis.assets.map(asset => asset.family))],
  galleries:manifest.galleries.length, prefabs:manifest.prefabs.length, reviewed:first.assetId, realAsset
}));
