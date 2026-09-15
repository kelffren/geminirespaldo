/* KELO-INDEX
 * area: CREATORS / NATURAL ASSET BRIDGE
 * owner: Kelo Creator Asset Bridge
 * owns: file-review packet, semantic classification merge and gallery/prefab draft output
 * does-not-own: image generation, pixel rectangles, asset storage, ChatGPT transport, map placement or collider authority
 * public-api: createAssetReviewPacket(), createChatGPTReviewPrompt(), applyAssetReviewPacket(), buildReviewedAssetManifest()
 * online: no; clipboard/download/attachment are the natural bridge and no API call is made
 */
import { buildAssetSheetManifest } from './asset-sheet-compiler.mjs';

export const ASSET_REVIEW_PACKET_VERSION = 'kelo-asset-review-v1';
const text = value => String(value == null ? '' : value).trim();
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const ALLOWED_FAMILIES = new Set(['tree','hedge','plant','planter','flower','rock','ground-cluster','structure','unknown']);
const ALLOWED_LAYERS = new Set(['ground','ground_variation','transitions','paths_floors','decals_details','props_back','props_front','vfx_weather_lighting']);

function safeName(value, fallback) {
  const normalized = text(value).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return normalized || fallback;
}

function family(value, fallback = 'unknown') {
  const candidate = text(value).toLowerCase().replace(/\s+/g, '-');
  return ALLOWED_FAMILIES.has(candidate) ? candidate : fallback;
}

function layer(value, fallback = 'props_front') {
  const candidate = text(value);
  return ALLOWED_LAYERS.has(candidate) ? candidate : fallback;
}

function confidence(value, fallback = 0.25) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(1, number)) * 100) / 100 : fallback;
}

function assertPacket(packet) {
  if (!packet || packet.kind !== 'kelo-asset-review-packet' || packet.version !== ASSET_REVIEW_PACKET_VERSION || !Array.isArray(packet.assets)) throw new Error('ASSET_REVIEW_PACKET_INVALID');
}

export function createAssetReviewPacket(analysis, {sourceName='', sourcePath='', atlasId=''} = {}) {
  const manifest = buildAssetSheetManifest(analysis, {sourceName:sourceName || analysis.sourceName || 'asset-sheet.png', sourcePath, atlasId});
  return {
    kind:'kelo-asset-review-packet', version:ASSET_REVIEW_PACKET_VERSION, bridge:'natural-file-review',
    source:copy(manifest.source), atlas:{id:manifest.atlas.id, width:manifest.atlas.width, height:manifest.atlas.height, frameMode:'irregular'},
    policy:{
      rectangles:'keep compiler sourceRect unchanged',
      semantics:'ChatGPT or a human may suggest name/family/category/layer only',
      collider:'suggestion-only; final collision remains Kelo Property/Map owner',
      transport:'attach this JSON and the original image; do not call an API'
    },
    assets:manifest.assets.map(asset => ({
      assetId:asset.assetId, frameId:asset.frameId, sourceRect:copy(asset.sourceRect), visualBounds:copy(asset.visualBounds),
      anchor:copy(asset.anchor), footprint:copy(asset.footprint), rowIndex:asset.rowIndex,
      suggestion:{name:asset.suggestedName, family:asset.family, category:asset.category, layer:asset.layer, confidence:asset.classification.confidence, rationale:asset.classification.rationale},
      review:{name:asset.suggestedName, family:asset.family, category:asset.category, layer:asset.layer, confidence:asset.classification.confidence, notes:''}
    })),
    output:{manifestKind:'kelo-asset-sheet-manifest', atlasId:manifest.atlas.id, galleryMode:'family', prefabMode:'family-cluster'}
  };
}

export function createChatGPTReviewPrompt(packet) {
  assertPacket(packet);
  const targets = packet.assets.map(asset => ({assetId:asset.assetId, frameId:asset.frameId, sourceRect:asset.sourceRect, suggestion:asset.suggestion}));
  return [
    'Actúa como revisor de una hoja de sprites 2D para Kelo.',
    'La imagen original va adjunta. Identifica qué es cada recuadro y organiza la hoja como una galería de assets reutilizables.',
    'Devuelve SOLO JSON válido. No cambies sourceRect, visualBounds, anchor, footprint ni frameId: esos campos pertenecen al compilador.',
    'Puedes corregir name, family, category, layer, confidence y notes. Si no estás seguro usa family="unknown" y confidence menor que 0.7.',
    'Familias válidas: tree, hedge, plant, planter, flower, rock, ground-cluster, structure, unknown.',
    'Capas válidas: ground, ground_variation, transitions, paths_floors, decals_details, props_back, props_front, vfx_weather_lighting.',
    'Formato exacto: {"kind":"kelo-asset-review-result","version":"kelo-asset-review-v1","assets":[{"assetId":"asset-001","name":"...","family":"tree","category":"nature/tree","layer":"props_back","confidence":0.9,"notes":"..."}]}',
    'No inventes assets que no estén en la lista y no incluyas rutas, URLs, código ni llamadas de red.',
    JSON.stringify({source:packet.source, assets:targets}, null, 2)
  ].join('\n');
}

export function parseAssetReviewText(serialized) {
  let parsed;
  try { parsed = JSON.parse(text(serialized)); } catch { throw new Error('ASSET_REVIEW_JSON_INVALID'); }
  if (parsed?.review && parsed.review.assets) parsed = parsed.review;
  if (!parsed || !Array.isArray(parsed.assets)) throw new Error('ASSET_REVIEW_RESULT_INVALID');
  return parsed;
}

export function applyAssetReviewPacket(analysis, review) {
  if (!analysis?.version || !Array.isArray(analysis.assets)) throw new Error('ASSET_SHEET_ANALYSIS_REQUIRED');
  if (!review || !Array.isArray(review.assets)) throw new Error('ASSET_REVIEW_RESULT_INVALID');
  const source = new Map(analysis.assets.map(asset => [asset.assetId, asset]));
  const accepted = new Map();
  const warnings = [];
  for (const row of review.assets) {
    const assetId = text(row?.assetId);
    const original = source.get(assetId);
    if (!original) { warnings.push(`UNKNOWN_ASSET:${assetId || 'missing-id'}`); continue; }
    if (accepted.has(assetId)) { warnings.push(`DUPLICATE_ASSET:${assetId}`); continue; }
    const nextFamily = family(row.family, original.family);
    const nextLayer = layer(row.layer, original.layer);
    const nextName = safeName(row.name, original.suggestedName || original.label);
    const nextCategory = text(row.category).replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 64) || original.category;
    const nextConfidence = confidence(row.confidence, original.classification?.confidence || 0.25);
    accepted.set(assetId, {
      ...original, label:nextName, suggestedName:nextName, family:nextFamily, category:nextCategory, layer:nextLayer,
      classification:{...original.classification, family:nextFamily, category:nextCategory, confidence:nextConfidence, needsReview:nextConfidence < 0.8, rationale:text(row.notes) || original.classification?.rationale},
      review:{reviewed:true, reviewer:'natural-file-review', notes:text(row.notes)}
    });
  }
  const assets = analysis.assets.map(asset => accepted.get(asset.assetId) || {...asset});
  const output = {...analysis, assets, review:{kind:review.kind || 'kelo-asset-review-result', version:review.version || ASSET_REVIEW_PACKET_VERSION, accepted:accepted.size, warnings}};
  for (const property of ['alphaMask','sourcePixels','sourceName']) if (analysis[property] !== undefined) Object.defineProperty(output, property, {value:analysis[property], enumerable:false, configurable:false});
  return output;
}

export function buildReviewedAssetManifest(analysis, review, options = {}) {
  const merged = review ? applyAssetReviewPacket(analysis, review) : analysis;
  return buildAssetSheetManifest(merged, options.source || {sourceName:merged.sourceName || 'asset-sheet.png'});
}

export function serializeAssetReview(value) {
  if (!value || !Array.isArray(value.assets)) throw new Error('ASSET_REVIEW_RESULT_INVALID');
  return JSON.stringify(copy(value), null, 2);
}

