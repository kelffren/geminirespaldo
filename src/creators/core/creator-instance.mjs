/* KELO-INDEX
 * area: CREATORS / INSTANCE MODEL
 * owner: Creator Instance envelope
 * owns: ephemeral edit/test/review session identity
 * does-not-own: project persistence, canonical revisions, LIVE authority
 * reused-by: every collaborative/testable Creator workspace
 */
const modes = new Set(['EDIT','TEST','REVIEW']);
const authorities = new Set(['LOCAL','HOST','SERVER']);
const iid = () => `creator-instance:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
export function createCreatorInstance(input = {}, { now = Date.now() } = {}) {
  const mode=String(input.mode||'EDIT').toUpperCase(), authorityMode=String(input.authorityMode||'LOCAL').toUpperCase();
  if(!input.projectId)throw new Error('CREATOR_INSTANCE_PROJECT_REQUIRED');
  if(!modes.has(mode))throw new Error(`CREATOR_INSTANCE_MODE_INVALID:${mode}`);
  if(!authorities.has(authorityMode))throw new Error(`CREATOR_INSTANCE_AUTHORITY_INVALID:${authorityMode}`);
  return Object.freeze({instanceId:String(input.instanceId||iid()),projectId:String(input.projectId),revisionId:input.revisionId==null?null:String(input.revisionId),mode,hostId:input.hostId==null?null:String(input.hostId),participants:Array.from(new Set((input.participants||[]).map(String))),authorityMode,createdAt:Number(input.createdAt)||now});
}
