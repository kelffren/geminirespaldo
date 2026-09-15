/* KELO-INDEX
 * area: CREATORS / MOUNT WORKSPACE
 * owner: Mount workspace manifest only
 * purpose: descriptor + lazy route into Mount Creator
 * public-api: createMountWorkspaceManifest/registerMountWorkspace
 * consumes: Mount Creator UI dynamic import
 * online: drafts local; publish authority se añadirá en repository adapter
 * do-not: no implementar editor dentro del Hub
 */
export function createMountWorkspaceManifest({loader=()=>import('../ui/mount-creator.mjs')}={}){return Object.freeze({id:'mount',label:'Mount',category:'gameplay',projectTypes:['MOUNT'],capability:null,availability:'active',async open({root=globalThis}={}){const mod=await loader();if(typeof mod.openMountCreator!=='function')throw new Error('CREATOR_MOUNT_ENTRY_MISSING');return mod.openMountCreator({root});}});}
export function registerMountWorkspace(registry,options={}){return registry.register(createMountWorkspaceManifest(options));}
