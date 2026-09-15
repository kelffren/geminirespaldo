/* KELO-INDEX
 * area: CREATORS / CONTENT STUDIO WORKSPACE
 * owner: Universal Content Studio workspace manifest only
 * owns: lazy route into spreadsheet/mobile content ingestion UI
 * does-not-own: upload, schemas, runtime systems or publish authority
 */
export function createContentStudioWorkspaceManifest({loader=()=>import('../ui/content-studio-workspace.mjs')}={}){return Object.freeze({id:'content-studio',label:'Content Studio',category:'content',projectTypes:['CONTENT'],capability:null,availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openContentStudio!=='function')throw new Error('CREATOR_CONTENT_STUDIO_ENTRY_MISSING');return mod.openContentStudio(context);}});}
export function registerContentStudioWorkspace(registry,options={}){return registry.register(createContentStudioWorkspaceManifest(options));}
