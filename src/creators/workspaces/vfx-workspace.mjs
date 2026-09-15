/* KELO-INDEX
 * area: CREATORS / VFX WORKSPACE
 * owner: VFX workspace manifest only
 * owns: descriptor and lazy routing into VFX Creator controller
 * does-not-own: Studio core, FX runtime, projects, permissions, assets or gameplay
 * reuse: existing Kelo Creators WorkspaceRegistry
 */
export function createVfxWorkspaceManifest({loader=()=>import('../vfx/vfx-live-controller.mjs')}={}){
  return Object.freeze({id:'vfx',label:'VFX',category:'visual',projectTypes:['VFX'],capability:'vfx.edit',availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openVfxCreator!=='function')throw new Error('CREATOR_VFX_ENTRY_MISSING');return mod.openVfxCreator(context);}});
}
export function registerVfxWorkspace(registry,options={}){return registry.register(createVfxWorkspaceManifest(options));}
