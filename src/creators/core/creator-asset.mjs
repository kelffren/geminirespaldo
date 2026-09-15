/* KELO-INDEX
 * area: CREATORS / ASSET MODEL
 * owner: Creator Asset metadata envelope
 * owns: cross-workspace asset identity/version/status metadata only
 * does-not-own: runtime registries or asset payloads
 * reused-by: Animation, VFX, Ability, NPC, Item, Prefab and future workspaces
 */
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
export function createCreatorAsset(input = {}) {
  if (!input.assetId || !input.type || !input.ownerId) throw new Error('CREATOR_ASSET_ID_TYPE_OWNER_REQUIRED');
  return Object.freeze({ assetId:String(input.assetId), type:String(input.type).toUpperCase(), name:String(input.name || input.assetId), ownerId:String(input.ownerId), version:String(input.version || '1'), status:String(input.status || 'PRIVATE_DRAFT'), visibility:String(input.visibility || 'PRIVATE'), dependencies:Array.from(new Set((input.dependencies || []).map(String))), thumbnail:input.thumbnail == null ? null : String(input.thumbnail), metadata:copy(input.metadata || {}) });
}
