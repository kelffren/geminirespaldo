/* KELO-INDEX
 * area: CREATORS / ABILITY WORKSPACE
 * owner: Ability workspace manifest only
 * owns: descriptor and lazy routing into Ability Creator controller
 * does-not-own: Studio core, ability runtime, projects, permissions, assets or combat
 * reuse: existing Kelo Creators WorkspaceRegistry
 */
export function createAbilityWorkspaceManifest({loader=()=>import('../ability/ability-live-controller.mjs')}={}){
  return Object.freeze({id:'ability',label:'Ability',category:'gameplay',projectTypes:['ABILITY'],capability:'ability.edit',availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openAbilityCreator!=='function')throw new Error('CREATOR_ABILITY_ENTRY_MISSING');const session=await mod.openAbilityCreator(context);const root=context.root||globalThis;try{const tuner=await import('../ability/ability-touch-tuner-v2.mjs');tuner.installAbilityTouchTuner?.(session,{root});}catch(error){console.warn('[Ability Workspace] direct tuner unavailable',error);}try{const timing=await import('../ability/ability-timeline-direct-editor.mjs');timing.installAbilityTimelineDirectEditor?.(session,{root});}catch(error){console.warn('[Ability Workspace] direct timeline editor unavailable',error);}return session;}});
}
export function registerAbilityWorkspace(registry,options={}){return registry.register(createAbilityWorkspaceManifest(options));}
