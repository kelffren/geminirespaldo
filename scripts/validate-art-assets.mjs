import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src/environment/art-asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function fail(message) {
  console.error(`ASSET_CONTRACT_FAIL ${message}`);
  process.exitCode = 1;
}
function pass(message) { console.log(`ASSET_CONTRACT_PASS ${message}`); }
function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function uniqueStrings(values, label) {
  if (!Array.isArray(values) || values.length === 0 || !values.every(isNonEmptyString)) {
    fail(`${label} must be a non-empty string array`);
    return new Set();
  }
  const set = new Set(values);
  if (set.size !== values.length) fail(`${label} contains duplicates`);
  return set;
}
function pngHasTransparency(buffer, colorType) {
  if (colorType === 4 || colorType === 6) return true;
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const nextChunk = dataStart + length + 4;
    if (nextChunk > buffer.length) return false;
    const type = buffer.toString('ascii', typeStart, typeStart + 4);
    if (type === 'tRNS') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset = nextChunk;
  }
  return false;
}
function requireMode(asset, field, allowed) {
  const value = asset[field];
  if (!value || typeof value !== 'object' || !allowed.has(value.mode)) {
    fail(`${asset.id} ${field}.mode must be one of ${[...allowed].join(', ')}`);
  }
}
function withStandaloneDefaults(raw) {
  const standalone = raw && (raw.kind === 'standalone-prop' || raw.kind === 'standalone-decal');
  if (!standalone) return raw;
  const isDecal = raw.kind === 'standalone-decal';
  return {
    padding:0,
    spacing:0,
    frames:{mode:'single',count:1},
    anchor:{mode:isDecal?'world-top-left':'registry-instance'},
    visualBounds:{mode:'asset'},
    footprint:{mode:'none'},
    collider:{mode:'none'},
    priority:10,
    occlusion:{mode:'none'},
    ...raw
  };
}
function readIrregularMetadata(relativePath) {
  const full = path.join(root, relativePath);
  const source = fs.readFileSync(full, 'utf8').trim();
  if (/\.json$/i.test(relativePath)) return JSON.parse(source);
  const match = source.match(/Object\.freeze\((\{[\s\S]*\})\)\s*;?\s*$/);
  if (!match) throw new Error(`unsupported metadata module format ${relativePath}`);
  return JSON.parse(match[1]);
}

if (manifest.contractVersion !== 'kelo-art-asset-contract-v2') fail(`unexpected contractVersion=${manifest.contractVersion}`);
if (manifest.worldTileSize !== 32) fail(`worldTileSize must be 32, got ${manifest.worldTileSize}`);
if (manifest.sampling !== 'nearest') fail(`sampling must be nearest, got ${manifest.sampling}`);
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) fail('assets must be a non-empty array');

const layerPhases = uniqueStrings(manifest.layerPhases, 'layerPhases');
const districtIds = uniqueStrings(manifest.districtIds, 'districtIds');
const layerStackSource = fs.readFileSync(path.join(root, 'src/environment/environment-layer-stack.js'), 'utf8');
const phaseDecl = layerStackSource.match(/const PHASES=Object\.freeze\(\[([^\]]+)\]\);/);
if (!phaseDecl) fail('could not derive formal PHASES from environment-layer-stack.js');
else {
  const runtimePhases = [...phaseDecl[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  if (JSON.stringify(runtimePhases) !== JSON.stringify(manifest.layerPhases)) {
    fail(`manifest layerPhases ${JSON.stringify(manifest.layerPhases)} != runtime PHASES ${JSON.stringify(runtimePhases)}`);
  }
}

const requiredAssetFields = [
  'id','family','version','path','kind','width','height','requireAlpha','sampling',
  'padding','spacing','frames','anchor','visualBounds','footprint','collider',
  'ownership','layers','priority','occlusion','districtCompatibility','cache','fallback'
];
const anchorModes = new Set(['tile-origin','world-top-left','registry-frame','registry-instance']);
const visualBoundsModes = new Set(['cell','asset','registry-frame','registry-instance']);
const placementModes = new Set(['none','registry-frame','registry-instance']);
const frameModes = new Set(['grid','single','irregular']);
const cacheStrategies = new Set(['query','runtime-owner']);
const fallbackModes = new Set(['none','asset']);
const seen = new Set();
const manifestPaths = new Set();
const assetsById = new Map();
const normalizedAssets = (manifest.assets || []).map(withStandaloneDefaults);

for (const asset of normalizedAssets) {
  for (const field of requiredAssetFields) {
    if (asset[field] === undefined || asset[field] === null) fail(`${asset.id || '<unknown>'} missing required field ${field}`);
  }
  if (!isNonEmptyString(asset.id) || !isNonEmptyString(asset.family) || !isNonEmptyString(asset.version) ||
      !isNonEmptyString(asset.path) || !isNonEmptyString(asset.kind) || !isNonEmptyString(asset.ownership)) {
    fail(`asset identity/family/version/ownership fields must be non-empty strings: ${JSON.stringify({id:asset.id,family:asset.family,version:asset.version,path:asset.path,kind:asset.kind,ownership:asset.ownership})}`);
    continue;
  }
  if (seen.has(asset.id)) fail(`duplicate id=${asset.id}`);
  seen.add(asset.id);
  assetsById.set(asset.id, asset);
  if (manifestPaths.has(asset.path)) fail(`duplicate path=${asset.path}`);
  manifestPaths.add(asset.path);

  if (![asset.width,asset.height].every(Number.isInteger) || asset.width <= 0 || asset.height <= 0) fail(`${asset.id} width/height must be positive integers`);
  if (typeof asset.requireAlpha !== 'boolean') fail(`${asset.id} requireAlpha must be boolean`);
  if (asset.sampling !== manifest.sampling) fail(`${asset.id} sampling=${asset.sampling} must match manifest sampling=${manifest.sampling}`);
  if (!Number.isInteger(asset.padding) || asset.padding < 0) fail(`${asset.id} padding must be a non-negative integer`);
  if (!Number.isInteger(asset.spacing) || asset.spacing < 0) fail(`${asset.id} spacing must be a non-negative integer`);
  if (!Number.isInteger(asset.priority)) fail(`${asset.id} priority must be an integer`);
  if (!asset.frames || typeof asset.frames !== 'object' || !frameModes.has(asset.frames.mode) || !Number.isInteger(asset.frames.count) || asset.frames.count <= 0) {
    fail(`${asset.id} frames must declare mode=grid|single|irregular and positive integer count`);
  }
  requireMode(asset, 'anchor', anchorModes);
  requireMode(asset, 'visualBounds', visualBoundsModes);
  requireMode(asset, 'footprint', placementModes);
  requireMode(asset, 'collider', placementModes);
  requireMode(asset, 'occlusion', placementModes);

  if (!Array.isArray(asset.layers) || asset.layers.length === 0) fail(`${asset.id} layers must be non-empty`);
  else {
    for (const layer of asset.layers) if (!layerPhases.has(layer)) fail(`${asset.id} unknown layer=${layer}`);
    if (new Set(asset.layers).size !== asset.layers.length) fail(`${asset.id} duplicate layers`);
  }
  if (!Array.isArray(asset.districtCompatibility) || asset.districtCompatibility.length === 0) fail(`${asset.id} districtCompatibility must be non-empty`);
  else {
    for (const district of asset.districtCompatibility) if (district !== '*' && !districtIds.has(district)) fail(`${asset.id} unknown districtCompatibility=${district}`);
    if (asset.districtCompatibility.includes('*') && asset.districtCompatibility.length > 1) fail(`${asset.id} districtCompatibility '*' must be used alone`);
  }
  if (!asset.cache || typeof asset.cache !== 'object' || !cacheStrategies.has(asset.cache.strategy)) fail(`${asset.id} cache.strategy must be query|runtime-owner`);
  else if (asset.cache.strategy === 'query') {
    if (!isNonEmptyString(asset.cache.key) || !isNonEmptyString(String(asset.cache.value ?? ''))) fail(`${asset.id} query cache requires key/value`);
  } else if (!isNonEmptyString(asset.cache.version)) fail(`${asset.id} runtime-owner cache requires version`);
  if (!asset.fallback || typeof asset.fallback !== 'object' || !fallbackModes.has(asset.fallback.mode)) fail(`${asset.id} fallback.mode must be none|asset`);
  else if (asset.fallback.mode === 'asset' && !isNonEmptyString(asset.fallback.assetId)) fail(`${asset.id} asset fallback requires assetId`);

  if (!/\.png$/i.test(asset.path)) { fail(`${asset.id} must point to a PNG: ${asset.path}`); continue; }
  const fullPath = path.join(root, asset.path);
  if (!fs.existsSync(fullPath)) { fail(`${asset.id} missing file ${asset.path}`); continue; }
  const png = fs.readFileSync(fullPath);
  const header = png.subarray(0, 26);
  const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (header.length < 26 || !header.subarray(0, 8).equals(signature)) { fail(`${asset.id} is not a valid PNG header`); continue; }
  const width = header.readUInt32BE(16), height = header.readUInt32BE(20), colorType = header[25];
  if (width !== asset.width || height !== asset.height) fail(`${asset.id} dimensions ${width}x${height} != declared ${asset.width}x${asset.height}`);
  if (asset.requireAlpha === true && !pngHasTransparency(png, colorType)) fail(`${asset.id} requires transparency but PNG colorType=${colorType} has no alpha/tRNS`);

  const gridFields = ['cellWidth','cellHeight','columns','rows'];
  const hasGrid = gridFields.some(field => asset[field] !== undefined);
  if (asset.frames?.mode === 'grid' && !hasGrid) fail(`${asset.id} frames.mode=grid requires grid metadata`);
  if (asset.frames?.mode === 'single' && hasGrid) fail(`${asset.id} frames.mode=single must not declare grid metadata`);
  if (asset.frames?.mode === 'irregular') {
    if (hasGrid) fail(`${asset.id} frames.mode=irregular must not declare grid metadata`);
    if (!isNonEmptyString(asset.frames.metadata)) fail(`${asset.id} irregular frames require frames.metadata`);
    else {
      const metadataPath = path.join(root, asset.frames.metadata);
      if (!fs.existsSync(metadataPath)) fail(`${asset.id} missing irregular metadata ${asset.frames.metadata}`);
      else {
        try {
          const atlasMeta = readIrregularMetadata(asset.frames.metadata);
          const entries = Object.entries(atlasMeta.frames || {});
          if (atlasMeta.width !== width || atlasMeta.height !== height) fail(`${asset.id} irregular metadata dimensions do not match PNG`);
          if (entries.length !== asset.frames.count) fail(`${asset.id} irregular frame count ${entries.length} != declared ${asset.frames.count}`);
          for (const [frameId, r] of entries) {
            if (![r.x,r.y,r.w,r.h].every(Number.isInteger) || r.w <= 0 || r.h <= 0 || r.x < 0 || r.y < 0 || r.x+r.w > width || r.y+r.h > height) fail(`${asset.id} invalid irregular frame ${frameId}`);
          }
        } catch (err) { fail(`${asset.id} invalid irregular metadata: ${err.message}`); }
      }
    }
  }
  if (hasGrid) {
    const {cellWidth,cellHeight,columns,rows,padding,spacing} = asset;
    if (![cellWidth,cellHeight,columns,rows].every(Number.isInteger)) fail(`${asset.id} grid requires integer cellWidth/cellHeight/columns/rows`);
    else {
      if (cellWidth <= 0 || cellHeight <= 0 || columns <= 0 || rows <= 0) fail(`${asset.id} grid values must be positive`);
      if (cellWidth !== manifest.worldTileSize || cellHeight !== manifest.worldTileSize) fail(`${asset.id} grid cell must match worldTileSize=${manifest.worldTileSize}`);
      const expectedWidth = padding*2 + columns*cellWidth + Math.max(0,columns-1)*spacing;
      const expectedHeight = padding*2 + rows*cellHeight + Math.max(0,rows-1)*spacing;
      if (expectedWidth !== width || expectedHeight !== height) fail(`${asset.id} grid+padding+spacing covers ${expectedWidth}x${expectedHeight}, PNG is ${width}x${height}`);
      if (asset.frames?.mode === 'grid' && asset.frames.count !== columns*rows) fail(`${asset.id} frames.count=${asset.frames.count} != grid cells=${columns*rows}`);
    }
  } else if (asset.frames?.mode === 'single' && asset.frames.count !== 1) fail(`${asset.id} single frame asset must have frames.count=1`);

  pass(`${asset.id} ${width}x${height} ${asset.kind} family=${asset.family} version=${asset.version}`);
}

for (const asset of normalizedAssets) {
  if (asset.fallback?.mode === 'asset' && !assetsById.has(asset.fallback.assetId)) fail(`${asset.id} fallback assetId=${asset.fallback.assetId} does not exist`);
}

const tileRegistrySource = fs.readFileSync(path.join(root, 'src/environment/tile-registry.js'), 'utf8');
const registryPngs = new Map();
for (const match of tileRegistrySource.matchAll(/src:'(assets\/[^']+?\.png)(\?[^']*)?'/gi)) registryPngs.set(match[1], match[2] || '');
for (const [registryPath, query] of [...registryPngs.entries()].sort()) {
  const asset = normalizedAssets.find(item => item.path === registryPath);
  if (!asset) { fail(`TileRegistry PNG missing from asset manifest: ${registryPath}`); continue; }
  if (asset.cache?.strategy !== 'query') { fail(`${asset.id} is TileRegistry-owned and must declare cache.strategy=query`); continue; }
  const params = new URLSearchParams(query.replace(/^\?/, ''));
  const actual = params.get(asset.cache.key);
  if (actual !== String(asset.cache.value)) fail(`${asset.id} cache mismatch: registry ${asset.cache.key}=${actual} manifest=${asset.cache.value}`);
  else console.log(`ASSET_CONTRACT_REGISTRY_PASS ${registryPath} cache=${asset.cache.key}=${actual}`);
}

if (!process.exitCode) console.log(`ASSET_CONTRACT_OK version=${manifest.contractVersion} assets=${normalizedAssets.length} registryPngs=${registryPngs.size} phases=${manifest.layerPhases.length} districts=${manifest.districtIds.length}`);
