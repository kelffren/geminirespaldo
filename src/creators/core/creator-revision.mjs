/* KELO-INDEX
 * area: CREATORS / REVISION MODEL
 * owner: Creator Revision envelope
 * owns: immutable generic revision metadata
 * does-not-own: workspace snapshots, hashing implementation, World revision storage
 * reused-by: every Creator workspace
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); return value; }
const rid = () => `creator-revision:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

export function createCreatorRevision(input = {}, { now = Date.now() } = {}) {
  if (!input.projectId) throw new Error('CREATOR_REVISION_PROJECT_REQUIRED');
  if (!input.createdBy) throw new Error('CREATOR_REVISION_AUTHOR_REQUIRED');
  if (!input.documentHash) throw new Error('CREATOR_REVISION_HASH_REQUIRED');
  return deepFreeze({
    revisionId: String(input.revisionId || rid()),
    projectId: String(input.projectId),
    parentRevisionId: input.parentRevisionId == null ? null : String(input.parentRevisionId),
    createdBy: String(input.createdBy),
    createdAt: Number(input.createdAt) || now,
    documentHash: String(input.documentHash),
    dependencies: Array.from(new Set((input.dependencies || []).map(String))),
    validationReport: copy(input.validationReport || null),
    performanceReport: copy(input.performanceReport || null)
  });
}
