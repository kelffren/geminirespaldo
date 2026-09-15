/* KELO-INDEX
 * area: CREATORS / ASSET SHEET CATALOG PREVIEW
 * owner: Kelo Creator Asset Bridge adapter
 * owns: temporary manifest-to-existing-catalog registration for same-session world authoring
 * does-not-own: atlas lifecycle, property catalog, world placement, persistence, approval or runtime rendering
 * public-api: createCatalogPreviewDefinitions(), installAssetSheetCatalogPreview()
 * online: no; session draft only, durable publication remains in existing Creator/repository authority
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const slug = value => String(value || 'asset-sheet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset-sheet';

function analysisFingerprint(manifest) {
  let hash = 2166136261;
  const seed = JSON.stringify([manifest?.source?.name, manifest?.atlas?.width, manifest?.atlas?.height, (manifest?.assets || []).map(asset => [asset.assetId, asset.sourceRect])]);
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}

function scaledCollision(frame, worldWidth, worldHeight) {
  if (frame.collider?.passThrough) return null;
  const source = frame.collider?.solidBounds;
  if (!source) return null;
  const sx = worldWidth / Math.max(1, frame.sourceRect.w), sy = worldHeight / Math.max(1, frame.sourceRect.h);
  return {x:Math.round(source.x * sx), y:Math.round(source.y * sy), w:Math.max(1, Math.round(source.w * sx)), h:Math.max(1, Math.round(source.h * sy))};
}

export function createCatalogPreviewDefinitions(manifest, {atlasKey=''} = {}) {
  if (!manifest?.atlas || !Array.isArray(manifest.assets)) throw new Error('ASSET_SHEET_MANIFEST_REQUIRED');
  const key = atlasKey || `creatorSheet-${slug(manifest.atlas.id)}-${analysisFingerprint(manifest)}`;
  const templates = manifest.assets.map(frame => {
    const targetWidth = clamp(frame.scale?.targetPixelWidth || frame.visualBounds?.w || frame.sourceRect.w, 16, 512);
    const width = Math.max(16, Math.round(targetWidth));
    const height = Math.max(16, Math.round(frame.sourceRect.h / Math.max(1, frame.sourceRect.w) * width));
    return {
      id:`draft:${key}:${frame.assetId}`, label:frame.label, category:String(frame.category || 'decor').split('/')[0], family:frame.family || 'unknown', districts:['*'],
      width, height, snap:32, collision:scaledCollision(frame, width, height), source:'creator-asset-sheet-session-draft', sourceId:frame.assetId, placeable:true,
      parts:[{assetKey:key, source:{x:frame.sourceRect.x, y:frame.sourceRect.y, w:frame.sourceRect.w, h:frame.sourceRect.h}, offset:{x:0,y:0}, size:{w:width,h:height}, phase:frame.layer === 'props_front' ? 'props_front' : 'props_back'}]
    };
  });
  return {atlasKey:key, templates};
}

export function installAssetSheetCatalogPreview({root=globalThis, manifest, atlasDataUrl} = {}) {
  if (!String(atlasDataUrl || '').startsWith('data:image/png')) throw new Error('ASSET_SHEET_PREVIEW_PNG_REQUIRED');
  const atlasContract = root.KELO_ATLAS_CONTRACT, catalog = root.KELO_PROPERTY_CATALOG;
  if (typeof atlasContract?.register !== 'function') throw new Error('KELO_ATLAS_CONTRACT_NOT_READY');
  if (typeof catalog?.registerTemplate !== 'function') throw new Error('KELO_PROPERTY_CATALOG_NOT_READY');
  const definitions = createCatalogPreviewDefinitions(manifest);
  atlasContract.register(definitions.atlasKey, {id:definitions.atlasKey, src:atlasDataUrl, width:manifest.atlas.width, height:manifest.atlas.height, frameMode:'irregular', frames:manifest.atlas.frames}, {role:'optional'});
  const registered = definitions.templates.map(template => catalog.registerTemplate(template));
  try { root.dispatchEvent?.(new CustomEvent('kelo:creator-asset-gallery-ready', {detail:{atlasKey:definitions.atlasKey, templateIds:registered.map(row => row.id)}})); } catch {}
  return Object.freeze({kind:'creator-asset-sheet-session-preview', atlasKey:definitions.atlasKey, templateIds:Object.freeze(registered.map(row => row.id)), assetCount:registered.length, durable:false});
}

