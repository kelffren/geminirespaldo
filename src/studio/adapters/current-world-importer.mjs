/* KELO-INDEX
 * area: STUDIO / IMPORT
 * owns: projection of current Kelo world/property snapshots into WorldDocument
 * does-not-own: runtime state, authority, asset definitions
 * public-api: importCurrentKeloWorld()
 * online: read-only; can import published or an already-authorized mutable draft view
 */

import { createWorldDocument } from '../document/world-document.mjs';
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const scaleOf = value => { const n=Number(value); return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1)); };
function rotatedBounds(template, quarter) { const w = Math.max(1, Number(template?.width) || 32), h = Math.max(1, Number(template?.height) || 32); return Math.abs(Number(quarter) || 0) % 2 ? { w: h, h: w } : { w, h }; }
function placementToEntity(placement, catalog) {
  const template = catalog.get(placement.assetId), quarter = ((Math.floor(Number(placement.rotation) || 0) % 4) + 4) % 4;
  const components = { legacyPlacement: { parcelId: placement.parcelId || null, ownerId: placement.ownerId || null, assetId: placement.assetId } };
  if (template?.parts?.length) components.visual = { source: 'property-catalog', parts: copy(template.parts) };
  if (template?.collision) components.collider = { rect: copy(template.collision), blocksMovement: true };
  return { id: String(placement.placementId), prefabId: String(placement.assetId), transform: { x: Number(placement.x) || 0, y: Number(placement.y) || 0, rotation: quarter * 90, scale: scaleOf(placement.scale) }, bounds: rotatedBounds(template, quarter), components, source: { kind: 'kelo-placement', authorityPlacementId: String(placement.placementId), updatedAt: Number(placement.updatedAt) || 0 } };
}
async function readDraftSnapshot(adapter,payload){
  try{
    return await adapter.worldEditRequest('world:preview:enter',payload);
  }catch(error){
    const message=String(error?.message||error||'');
    if(!/UNKNOWN_WORLD_EDIT_OPERATION|UNSUPPORTED|NOT_IMPLEMENTED/i.test(message))throw error;
    return adapter.worldEditRequest('world:draft:get',payload);
  }
}
export async function importCurrentKeloWorld({ adapter, mode = 'world', actorId = null, parcelId = null, view = 'published', draftId = null, lite = false } = {}) {
  if (!adapter) throw new Error('STUDIO_IMPORT_ADAPTER_REQUIRED');
  let snapshot = null, viewMeta = null, targetParcelId = parcelId;
  if (mode === 'parcel') {
    if (!targetParcelId) { const parcel = await adapter.propertyRequest('ensureLegacyParcel', { ownerId: actorId || undefined }); targetParcelId = parcel?.parcelId || null; }
    const property = await adapter.propertyRequest('snapshot', {}); snapshot = { placements: (property?.placements || []).filter(row => !targetParcelId || row.parcelId === targetParcelId), cells: {}, collisions: {} };
  } else {
    const payload = { actorId: actorId || undefined, ...(view === 'draft' ? { draftId: draftId || undefined } : {}) };
    const result = view === 'draft' ? await readDraftSnapshot(adapter,payload) : await adapter.worldEditRequest('world:published:get',payload);
    snapshot = result?.viewSnapshot || result?.snapshot || result?.revision?.snapshot || { placements: [], cells: {}, collisions: {} }; viewMeta = result?.viewMeta || result?.revision || result?.draft || null;
  }
  const entities = (snapshot?.placements || []).map(row => placementToEntity(row, adapter.assetCatalog));
  // A10 lite: avoid a second structuredClone of the entire terrain/collision maps on iPhone.
  // Entities already carry only the fields Studio needs; cells/collisions stay shallow-owned by the document.
  const terrain = lite ? { ...(snapshot?.cells || {}) } : copy(snapshot?.cells || {});
  const collisions = lite ? { ...(snapshot?.collisions || {}) } : copy(snapshot?.collisions || {});
  return createWorldDocument({ worldId: mode === 'parcel' ? String(targetParcelId || `parcel:${actorId || 'local'}`) : String(snapshot?.worldId || 'world:kelo-main'), metadata: { name: mode === 'parcel' ? 'My Parcel' : 'Kelo World', description: '', tags: [mode, 'imported', view, ...(lite?['lite']:[])], source: 'kelo-runtime-import-v2' }, settings: { tileSize: adapter.tileRegistry?.worldTileSize || 32, chunkSize: adapter.worldRenderer?.chunkSize || 512 }, terrain, entities, navigation: { collisions }, revision: { id: viewMeta?.revisionId || viewMeta?.id || viewMeta?.draftId || null, number: Number(viewMeta?.number || viewMeta?.revisionVersion) || 0 } });
}
