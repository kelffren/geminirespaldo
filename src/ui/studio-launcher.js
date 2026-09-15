/* KELO-INDEX
 * area: UI / CREATORS LAUNCHER
 * owner: Kelo Studio Launcher (compat name retained)
 * keys: CREATORS MENU PREMIUM LAZY ADMIN ANIMATION CAPABILITY AVATAR SPRITE FACTORY ONLINE PERMISSIONS DIRECT URL GM LIVE
 * purpose: añade CREATORS y Sprite Factory al menú Luxe, carga permisos online y permite abrir Creators directamente con ?creators=1
 * public-api: KELO_STUDIO_LAUNCHER + KELO_CREATORS_LAUNCHER alias
 * consumes: KELO_ADMIN_KEYS, KeloAccountPermissions, KELO_LUXE, menú Luxe existente
 * state-owned: solo estado efímero de carga
 * extension-points: Creator Hub / Sprite Factory / WorkspaceRegistry / Account Admin / Account Live Control
 */
(function(){
  'use strict';
  if(window.KELO_STUDIO_LAUNCHER)return;
  let loading=false,factoryLoading=false,directOpenStarted=false;
  const CREATOR_BUILD='world-bridge-20260915-23';
  const params=()=>new URLSearchParams(window.location.search);
  const directRequested=()=>params().get('creators')==='1'||params().get('creator')==='1';
  const actor=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  const allowed=()=>{
    const keys=window.KELO_ADMIN_KEYS,who=actor();
    return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
  };
  const toast=m=>{if(typeof window.showToast==='function')window.showToast(m);else console.info('[Kelo Creators]',m);};
  function friendlyError(error){const code=String(error?.message||error||'');return code||'No se pudo abrir Kelo Creators';}
  function paint(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando herramientas':'Herramientas de creación')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  function paintFactory(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">▦</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Sprite Factory')+'</b><small>'+(busy?'Preparando pipeline':'Sprites 8D · AI · preview · QA')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  async function loadCreatorHub(){
    // BUG-0003 H6: unique nonce specifiers leak module identities in Safari.
    // One stable build URL per launch; retry the same specifier, never a new graph.
    try{return await import(`./../creators/ui/creator-hub.mjs?v=${CREATOR_BUILD}`);}
    catch(firstError){
      console.warn('[Kelo Creators launcher] retrying Creator Hub',firstError);
      return import(`./../creators/ui/creator-hub.mjs?v=${CREATOR_BUILD}`);
    }
  }
  async function open(){
    if(loading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    loading=true;
    const btn=document.getElementById('lx-create-studio');paint(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await loadCreatorHub();
      await mod.openCreatorHub({root:window});
    }catch(e){
      console.error('[Kelo Creators launcher]',e);toast(friendlyError(e));
      throw e;
    }finally{
      loading=false;if(btn?.isConnected)paint(btn,false);
    }
  }
  async function openFactory(){
    if(factoryLoading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    factoryLoading=true;
    const btn=document.getElementById('lx-create-sprite-factory');paintFactory(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import('./../creators/ui/sprite-factory-online.mjs');
      await mod.openSpriteFactoryOnline({root:window});
    }catch(e){
      console.error('[Kelo Sprite Factory launcher]',e);toast(friendlyError(e));
    }finally{
      factoryLoading=false;if(btn?.isConnected)paintFactory(btn,false);
    }
  }
  function sync(){
    const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
    if(!grid)return false;
    let btn=document.getElementById('lx-create-studio'),factoryBtn=document.getElementById('lx-create-sprite-factory');
    if(!allowed()){btn?.remove();factoryBtn?.remove();return true;}
    if(!btn){btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';btn.onclick=e=>{e.preventDefault();e.stopPropagation();void open().catch(()=>{});};grid.appendChild(btn);}
    if(!factoryBtn){factoryBtn=document.createElement('button');factoryBtn.id='lx-create-sprite-factory';factoryBtn.type='button';factoryBtn.className='lx-menu-item';factoryBtn.onclick=e=>{e.preventDefault();e.stopPropagation();void openFactory();};grid.appendChild(factoryBtn);}
    btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,loading);
    factoryBtn.setAttribute('aria-label','Abrir Kelo Sprite Factory');paintFactory(factoryBtn,factoryLoading);
    return true;
  }
  function maybeOpenDirect(){
    if(!directRequested()||directOpenStarted)return;
    let tries=0;
    const attempt=()=>{
      if(directOpenStarted)return;
      tries++;
      sync();
      if(allowed()){
        directOpenStarted=true;
        void open().catch(error=>{
          directOpenStarted=false;
          console.error('[Kelo Creators direct launch]',error);
          if(tries<12)window.setTimeout(attempt,250);
        });
        return;
      }
      if(tries<12)window.setTimeout(attempt,100);
      else toast('No se pudo activar la llave de Kelo Creators');
    };
    attempt();
  }
  async function bootOnlineAuthorization(){
    try{
      const permissionsModule=await import('./../auth/account-permissions-runtime.mjs?v=1');
      await permissionsModule.installAccountPermissions({root:window});
      sync();maybeOpenDirect();
    }catch(error){console.warn('[Kelo online permissions boot]',error);}
    try{
      const adminModule=await import('./account-admin-panel.mjs?v=3');
      await adminModule.installAccountAdminPanel({root:window});
    }catch(error){console.warn('[Kelo admin panel boot]',error);}
    try{
      const liveModule=await import('./../auth/account-live-control-runtime.mjs?v=2');
      await liveModule.installAccountLiveControl({root:window});
    }catch(error){console.warn('[Kelo account live control boot]',error);}
  }
  function bootSurgery(){
    void import('./../studio/diagnostics/world-surgery-runtime.mjs?v=1')
      .then(m=>m.installWorldSurgery({root:window}))
      .catch(error=>console.warn('[Kelo World Surgery boot]',error));
  }
  function boot(){bootSurgery();sync();maybeOpenDirect();void bootOnlineAuthorization();void import('./../characters/creator-avatar-runtime.mjs').then(m=>m.installCreatorAvatarRuntime({root:window})).catch(e=>console.warn('[Kelo Avatar runtime]',e));}
  window.KELO_ADMIN_KEYS?.onChange?.(()=>{sync();maybeOpenDirect();});
  const api=Object.freeze({version:'studio-launcher-v1.19.1-gm-live-control',open,openSpriteFactory:openFactory,sync,get allowed(){return allowed();},get directRequested(){return directRequested();}});
  window.KELO_STUDIO_LAUNCHER=api;
  window.KELO_CREATORS_LAUNCHER=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();