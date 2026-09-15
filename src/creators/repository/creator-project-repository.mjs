/* KELO-INDEX
 * area: CREATORS / PROJECT REPOSITORY CONTRACT
 * owner: Creator Project persistence boundary
 * owns: repository capability contract only
 * does-not-own: storage technology or domain-specific authority
 * online: RemoteCreatorProjectRepository can replace local implementation
 */
export const CREATOR_PROJECT_REPOSITORY_METHODS=Object.freeze(['list','get','create','saveDraft','loadDraft','archive']);
export function assertCreatorProjectRepository(repo){for(const key of CREATOR_PROJECT_REPOSITORY_METHODS)if(typeof repo?.[key]!=='function')throw new Error(`CREATOR_PROJECT_REPOSITORY_METHOD_MISSING:${key}`);return repo;}
