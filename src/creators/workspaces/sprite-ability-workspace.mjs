/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY WORKSPACE
 * owner: Sprite Ability workspace manifest only
 * purpose: lazy route to Sprite Ability Builder using existing Creator registry
 * reuse: Kelo Creators WorkspaceRegistry
 */
export function createSpriteAbilityWorkspaceManifest({loader=()=>import('../sprite-ability/sprite-ability-live-controller.mjs')}={}){
  return Object.freeze({id:'sprite-ability',label:'Sprite Ability',category:'gameplay',projectTypes:['SPRITE_ABILITY'],capability:'ability.edit',availability:'active',isSessionAlive(session,{root=globalThis}={}){const shell=root.document?.getElementById?.('kelo-studio-workspace');const title=String(shell?.querySelector?.('.ksw-title')?.textContent||'').toUpperCase();return !!(session&&shell?.isConnected&&title.includes('SPRITE ABILITY'));},async open(context={}){const mod=await loader();if(typeof mod.openSpriteAbilityBuilder!=='function')throw new Error('CREATOR_SPRITE_ABILITY_ENTRY_MISSING');return mod.openSpriteAbilityBuilder(context);}});
}
export function registerSpriteAbilityWorkspace(registry,options={}){return registry.register(createSpriteAbilityWorkspaceManifest(options));}
