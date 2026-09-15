/* KELO-INDEX
 * area: AUTH / ADMIN LIVE CONTROL
 * owner: KeloAccountLiveControl
 * keys: ADMIN KILL KICK SUSPEND REALTIME RPC MOBILE LAZY NO-RAF
 * purpose: recibir órdenes GM autorizadas por Supabase después del boot; no participa en gameLoop ni carga gameplay pesado
 * online: account_runtime_commands + RLS/RPC son autoridad de entrega; kick temporal queda además protegido por account_moderation en servidor
 * do-not: NO requestAnimationFrame, NO segundo socket de juego, NO writes directos a tablas admin
 */
const VERSION='account-live-control-v1.0.1';

export async function installAccountLiveControl({root=window}={}){
  if(root.KeloAccountLiveControl)return root.KeloAccountLiveControl;
  const auth=root.KeloOnlineAuth;
  if(!auth)return null;
  await auth.ready?.(5000);
  const snapshot=auth.state?.()||{};
  const client=auth.getClient?.();
  const userId=String(snapshot.accountId||'');
  if(!client||!userId||snapshot.authenticated===false)return null;

  const processing=new Set();
  let channel=null,pollTimer=0,stopped=false;
  const toast=m=>typeof root.showToast==='function'?root.showToast(m):console.info('[Kelo GM]',m);
  async function rpc(name,args={}){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
  function overlay(title,message){
    let el=document.getElementById('kelo-admin-session-lock');
    if(!el){el=document.createElement('div');el.id='kelo-admin-session-lock';el.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,6,10,.985);color:#eef4ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;pointer-events:auto';document.body.appendChild(el);}
    el.textContent='';
    const card=document.createElement('div');card.style.cssText='max-width:430px;border:1px solid rgba(230,190,90,.4);border-radius:22px;padding:24px;background:#0c1420;box-shadow:0 24px 80px rgba(0,0,0,.7)';
    const heading=document.createElement('div');heading.style.cssText='font-size:13px;font-weight:950;letter-spacing:.08em;color:#f0d47f';heading.textContent=String(title||'SESIÓN CERRADA');
    const copy=document.createElement('div');copy.style.cssText='margin-top:10px;font-size:12px;line-height:1.5;color:#aebfd1';copy.textContent=String(message||'La sesión fue cerrada por un administrador.');
    card.append(heading,copy);el.appendChild(card);
  }
  function closeGameConnection(){
    const candidates=[root.keloNet?.ws,root.keloNet?.socket,root.KeloNetAuthority?.socket,root.KeloNetAuthority?.ws];
    for(const ws of candidates){try{if(ws&&typeof ws.close==='function')ws.close(4001,'admin kick');}catch(_){}}
    try{root.KeloNetAuthority?.disconnect?.('admin-kick');}catch(_){}
  }
  function forceDeath(command){
    const detail={source:'admin-live-control',commandId:command.id,reason:command.reason||'Acción administrativa'};
    let applied=false;
    try{
      if(root.localPlayer){root.localPlayer.hp=0;root.localPlayer._adminDead=true;applied=true;}
      const schema=root.KeloCombatSchema,events=root.KeloEvents;
      if(schema?.events?.ENTITY_KILLED&&events?.emit){events.emit(schema.events.ENTITY_KILLED,{targetActor:root.localPlayer||null,target:root.localPlayer||null,actor:null,source:'admin-live-control',admin:true});applied=true;}
      root.dispatchEvent(new CustomEvent('kelo:admin-force-death',{detail}));
    }catch(error){console.warn('[Kelo GM kill]',error);}
    toast(applied?'Un administrador eliminó a tu personaje.':'Orden de muerte administrativa recibida.');
    return applied;
  }
  async function forceKick(command){
    const seconds=Math.max(0,Number(command.payload?.duration_seconds)||0),until=command.payload?.suspended_until||null;
    overlay('EXPULSADO POR ADMINISTRADOR',seconds>0?`Acceso bloqueado temporalmente${until?' hasta '+new Date(until).toLocaleString():''}. ${command.reason||''}`:`Tu sesión fue cerrada. ${command.reason||''}`);
    closeGameConnection();
    try{await auth.signOut?.();}catch(error){console.warn('[Kelo GM signout]',error);try{await client.auth.signOut();}catch(_){}}
    root.dispatchEvent(new CustomEvent('kelo:admin-kicked',{detail:{commandId:command.id,durationSeconds:seconds,until,reason:command.reason||null}}));
  }
  async function consume(command){
    if(!command?.id||processing.has(command.id)||stopped)return;
    processing.add(command.id);
    try{
      if(command.action==='kick'){
        // Consume while the authenticated session still exists, then terminate it.
        await rpc('consume_my_runtime_command',{p_command_id:command.id});
        await forceKick(command);
        return;
      }
      if(command.action==='kill'){
        forceDeath(command);
        await rpc('consume_my_runtime_command',{p_command_id:command.id});
      }
    }catch(error){console.warn('[Kelo GM command]',error);}
    finally{processing.delete(command.id);}
  }
  async function drain(){
    if(stopped)return;
    try{const rows=await rpc('get_my_runtime_commands');for(const row of Array.isArray(rows)?rows:[])await consume(row);}catch(error){console.warn('[Kelo GM drain]',error);}
  }
  function startFallback(){if(pollTimer||stopped)return;pollTimer=root.setInterval(()=>void drain(),15000);}
  function stopFallback(){if(pollTimer){root.clearInterval(pollTimer);pollTimer=0;}}
  function subscribe(){
    if(typeof client.channel!=='function'){startFallback();return;}
    try{
      channel=client.channel('kelo-admin-runtime-'+userId)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'account_runtime_commands',filter:'target_user_id=eq.'+userId},payload=>void consume(payload.new))
        .subscribe(status=>{if(status==='SUBSCRIBED')stopFallback();else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')startFallback();});
    }catch(error){console.warn('[Kelo GM realtime]',error);startFallback();}
  }
  function stop(){stopped=true;stopFallback();if(channel){try{client.removeChannel(channel);}catch(_){}channel=null;}return true;}
  const api=Object.freeze({version:VERSION,drain,stop,get userId(){return userId;}});
  root.KeloAccountLiveControl=api;
  subscribe();
  void drain();
  return api;
}
