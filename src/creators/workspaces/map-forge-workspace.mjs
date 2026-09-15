/* KELO-INDEX
 * area: CREATORS / MAP FORGE WORKSPACE
 * owner: Map Forge workspace manifest only
 * owns: descriptor + lazy routing to Map Forge UI + World workspace handoff callback
 * does-not-own: generator core, draft import, World Studio, renderer, collision or gameplay
 * public-api: createMapForgeWorkspaceManifest(), registerMapForgeWorkspace()
 * reuse: handoff returns through registered World workspace via openWorkspace()
 */
const MAP_FORGE_UI_BUILD='safari-touch-recovery-20260914-3';
const MAP_FORGE_OPENING_KEY='__KELO_MAP_FORGE_WORKSPACE_OPENING__';

function freshMapForgeUiLoader(){
  // Keep one module identity for the lifetime of the page so Map Forge's module-level `active`
  // remains the single workspace owner. Cache bust between deployments by bumping BUILD, not on
  // every tap: a per-tap nonce creates a fresh ES-module instance with its own `active` singleton
  // and can mount duplicate #kelo-map-forge dialogs on iOS Safari.
  return import(`../ui/map-forge-workspace.mjs?v=${MAP_FORGE_UI_BUILD}`);
}

function existingMapForgeSession(root,mod){
  const mounted=typeof mod?.getMapForgeWorkspace==='function'?mod.getMapForgeWorkspace():null;
  if(mounted?.shell?.isConnected)return mounted;
  const shell=root?.document?.getElementById?.('kelo-map-forge');
  if(!shell?.isConnected)return null;
  // A shell can belong to a previously cached module identity on Pages. Treat that DOM owner as
  // authoritative instead of mounting a second dialog from the current module identity.
  return Object.freeze({
    version:'kelo-map-forge-cross-module-existing-v1',
    shell,
    get suspended(){return !shell.isConnected;},
    close(){shell.querySelector?.('.kmf-head .kmf-btn')?.click?.();}
  });
}

export function createMapForgeWorkspaceManifest({loader=freshMapForgeUiLoader}={}){
  return Object.freeze({
    id:'map-forge',
    label:'Map Forge',
    category:'build',
    projectTypes:['WORLD'],
    capability:'world.edit',
    availability:'active',
    async open({root=globalThis,openWorkspace=null}={}){
      // The normal game URL can transiently execute more than one cached Creator module identity
      // on iOS Safari / Pages. Module-local `active` state cannot coordinate those identities, so
      // coalesce launches on the shared window before the first dynamic import can yield.
      const sharedOpening=root?.[MAP_FORGE_OPENING_KEY];
      if(sharedOpening&&typeof sharedOpening.then==='function')return sharedOpening;

      const launch=(async()=>{
        const mod=await loader();
        if(typeof mod.openMapForgeWorkspace!=='function')throw new Error('CREATOR_MAP_FORGE_ENTRY_MISSING');

        const alreadyMounted=existingMapForgeSession(root,mod);
        if(alreadyMounted)return alreadyMounted;

        const pending=Promise.resolve(mod.openMapForgeWorkspace({
          root,
          onOpenWorld:typeof openWorkspace==='function'
            ?(map,options={})=>openWorkspace('world',{...options,mapDefinition:map,source:'map-forge'})
            :null
        }));

        // openMapForgeWorkspace mounts its shell before awaiting the first best-of generation.
        // The Creator Hub must hand control to that mounted editor immediately instead of
        // waiting up to the worker timeout; generation readiness is editor state, not routing state.
        const mounted=existingMapForgeSession(root,mod);
        if(mounted){
          pending.catch(error=>{
            console.error('[Kelo Creators → Map Forge background bootstrap]',error);
            root.showToast?.(error?.message||'Map Forge generation bootstrap failed');
          });
          return mounted;
        }

        return pending;
      })();

      try{root[MAP_FORGE_OPENING_KEY]=launch;}catch{}
      try{return await launch;}
      finally{
        try{if(root?.[MAP_FORGE_OPENING_KEY]===launch)delete root[MAP_FORGE_OPENING_KEY];}catch{}
      }
    }
  });
}
export function registerMapForgeWorkspace(registry,options={}){return registry.register(createMapForgeWorkspaceManifest(options));}
