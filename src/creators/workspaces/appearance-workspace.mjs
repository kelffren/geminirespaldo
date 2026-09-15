/* KELO-INDEX
 * area: CREATORS / APPEARANCE WORKSPACE
 * owner: Appearance workspace manifest only
 * purpose: descriptor + lazy route into shared Character/Mount Appearance Creator
 * public-api: createAppearanceWorkspaceManifest/registerAppearanceWorkspace
 * consumes: Appearance Creator UI dynamic import
 * online: drafts local; cosmetic ownership/publish authority replaceable
 * do-not: no duplicar Character Outfit Editor y Mount Outfit Editor
 */
export function createAppearanceWorkspaceManifest({loader=()=>import('../ui/appearance-creator.mjs')}={}){return Object.freeze({id:'appearance',label:'Appearance',category:'visual',projectTypes:['APPEARANCE'],capability:null,availability:'active',async open({root=globalThis}={}){const mod=await loader();if(typeof mod.openAppearanceCreator!=='function')throw new Error('CREATOR_APPEARANCE_ENTRY_MISSING');return mod.openAppearanceCreator({root});}});}
export function registerAppearanceWorkspace(registry,options={}){return registry.register(createAppearanceWorkspaceManifest(options));}
