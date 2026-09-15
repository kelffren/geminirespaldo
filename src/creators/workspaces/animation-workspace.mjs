/* KELO-INDEX
 * area: CREATORS / ANIMATION WORKSPACE
 * owner: Animation workspace manifest only
 * owns: descriptor and lazy routing into Animation Creator controller
 * does-not-own: Studio core, animation runtime, projects, permissions, assets or combat
 * reuse: existing Kelo Creators WorkspaceRegistry
 */
export function createAnimationWorkspaceManifest({loader=()=>import('../animation/animation-live-controller.mjs')}={}){
  return Object.freeze({id:'animation',label:'Animation',category:'visual',projectTypes:['ANIMATION'],capability:'animation.edit',availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openAnimationCreator!=='function')throw new Error('CREATOR_ANIMATION_ENTRY_MISSING');return mod.openAnimationCreator(context);}});
}
export function registerAnimationWorkspace(registry,options={}){return registry.register(createAnimationWorkspaceManifest(options));}
