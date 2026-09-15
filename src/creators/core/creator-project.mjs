/* KELO-INDEX
 * area: CREATORS / PROJECT MODEL
 * owner: Creator Project model
 * owns: generic project envelope and lifecycle transitions
 * does-not-own: workspace documents, persistence, permissions, publishing authority
 * reused-by: every Creator workspace
 * online: pure data contract; repositories/authorities are replaceable
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const id = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

export const CREATOR_PROJECT_TYPES = Object.freeze([
  'WORLD','PARCEL','DUNGEON','GAME_MODE','ANIMATION','VFX','ABILITY','SPRITE_ABILITY','NPC','QUEST','ITEM','CRAFTING','CINEMATIC','AUDIO','PREFAB','ENVIRONMENT'
]);
export const CREATOR_PROJECT_STATUSES = Object.freeze([
  'PRIVATE_DRAFT','TEAM_DRAFT','READY_FOR_TEST','IN_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','ARCHIVED'
]);
export const CREATOR_VISIBILITIES = Object.freeze(['PRIVATE','TEAM','TESTABLE','PUBLIC']);

const typeSet = new Set(CREATOR_PROJECT_TYPES), statusSet = new Set(CREATOR_PROJECT_STATUSES), visibilitySet = new Set(CREATOR_VISIBILITIES);
const transitions = Object.freeze({
  PRIVATE_DRAFT: new Set(['TEAM_DRAFT','ARCHIVED']),
  TEAM_DRAFT: new Set(['PRIVATE_DRAFT','READY_FOR_TEST','ARCHIVED']),
  READY_FOR_TEST: new Set(['TEAM_DRAFT','IN_REVIEW','ARCHIVED']),
  IN_REVIEW: new Set(['CHANGES_REQUESTED','APPROVED','ARCHIVED']),
  CHANGES_REQUESTED: new Set(['TEAM_DRAFT','ARCHIVED']),
  APPROVED: new Set(['PUBLISHED','ARCHIVED']),
  PUBLISHED: new Set(['ARCHIVED']),
  ARCHIVED: new Set()
});

export function normalizeCreatorProject(input = {}, { now = Date.now() } = {}) {
  const type = String(input.type || '').toUpperCase();
  const status = String(input.status || 'PRIVATE_DRAFT').toUpperCase();
  const visibility = String(input.visibility || 'PRIVATE').toUpperCase();
  if (!typeSet.has(type)) throw new Error(`CREATOR_PROJECT_TYPE_INVALID:${type}`);
  if (!statusSet.has(status)) throw new Error(`CREATOR_PROJECT_STATUS_INVALID:${status}`);
  if (!visibilitySet.has(visibility)) throw new Error(`CREATOR_PROJECT_VISIBILITY_INVALID:${visibility}`);
  const ownerId = String(input.ownerId || '').trim();
  if (!ownerId) throw new Error('CREATOR_PROJECT_OWNER_REQUIRED');
  const createdAt = Number(input.createdAt) || now;
  return {
    projectId: String(input.projectId || id('creator-project')),
    type,
    name: String(input.name || type.replaceAll('_',' ')).trim(),
    description: String(input.description || ''),
    ownerId,
    status,
    visibility,
    collaborators: Array.isArray(input.collaborators) ? copy(input.collaborators) : [],
    draftRevisionId: input.draftRevisionId == null ? null : String(input.draftRevisionId),
    approvedRevisionId: input.approvedRevisionId == null ? null : String(input.approvedRevisionId),
    publishedRevisionId: input.publishedRevisionId == null ? null : String(input.publishedRevisionId),
    dependencies: Array.from(new Set((input.dependencies || []).map(String))),
    workspaceSettings: copy(input.workspaceSettings || {}),
    createdAt,
    updatedAt: Number(input.updatedAt) || createdAt
  };
}

export const createCreatorProject = normalizeCreatorProject;

export function canTransitionCreatorProject(projectOrStatus, nextStatus) {
  const from = typeof projectOrStatus === 'string' ? projectOrStatus : projectOrStatus?.status;
  const to = String(nextStatus || '').toUpperCase();
  return !!transitions[String(from || '').toUpperCase()]?.has(to);
}

export function transitionCreatorProject(project, nextStatus, { now = Date.now() } = {}) {
  const current = normalizeCreatorProject(project, { now });
  const next = String(nextStatus || '').toUpperCase();
  if (!canTransitionCreatorProject(current, next)) throw new Error(`CREATOR_PROJECT_TRANSITION_INVALID:${current.status}->${next}`);
  const visibility = next === 'PUBLISHED' ? 'PUBLIC' : current.visibility;
  return normalizeCreatorProject({ ...current, status: next, visibility, updatedAt: now }, { now });
}

export function creatorProjectTransitionTargets(projectOrStatus) {
  const status = typeof projectOrStatus === 'string' ? projectOrStatus : projectOrStatus?.status;
  return [...(transitions[String(status || '').toUpperCase()] || [])];
}
