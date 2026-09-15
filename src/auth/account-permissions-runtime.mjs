/* KELO-INDEX
 * area: AUTH / AUTHORIZATION
 * owner: KeloAccountPermissions
 * keys: ROLES PERMISSIONS CREATOR ADMIN MODERATOR BAN SUSPENSION SUPABASE RLS
 * purpose: carga permisos efectivos del usuario autenticado y los expone a UI/Creator sin usar metadata del cliente
 * online: autoridad = RPC get_my_account_access(); el navegador solo cachea una proyección efímera
 * do-not: NO service_role, NO confiar localStorage para permisos, NO inventar scopes offline
 */
const VERSION='account-permissions-v1.0.0';
const EMPTY=Object.freeze({loaded:false,authenticated:false,accountId:null,status:'active',reason:null,expiresAt:null,roles:[],permissions:[]});

export async function installAccountPermissions({root=window}={}){
  if(root.KeloAccountPermissions)return root.KeloAccountPermissions;
  let state={...EMPTY},refreshing=null;
  const listeners=new Set();
  const clone=()=>Object.freeze({...state,roles:[...state.roles],permissions:[...state.permissions]});
  const emit=()=>{const snap=clone();listeners.forEach(fn=>{try{fn(snap);}catch(error){console.warn('[KeloPermissions listener]',error);}});try{root.dispatchEvent(new CustomEvent('kelo:permissions-changed',{detail:snap}));}catch(_){}};
  const normalizeArray=value=>Array.isArray(value)?value.map(String):[];
  const activeStatus=row=>{
    const status=String(row?.status||'active');
    if(status==='suspended'&&row?.expires_at&&Date.parse(row.expires_at)<=Date.now())return'active';
    return status;
  };
  async function refresh(){
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      try{
        const auth=root.KeloOnlineAuth;
        if(!auth){state={...EMPTY};emit();return clone();}
        const credentials=await auth.ready?.(7000);
        if(!credentials?.accountId){state={...EMPTY};emit();return clone();}
        const client=auth.getClient?.();
        if(!client){state={...EMPTY,authenticated:true,accountId:credentials.accountId};emit();return clone();}
        const result=await client.rpc('get_my_account_access');
        if(result.error){
          const code=String(result.error.code||'');
          if(code==='PGRST202'||code==='42883'){
            state={...EMPTY,authenticated:true,accountId:credentials.accountId};emit();return clone();
          }
          throw result.error;
        }
        const row=Array.isArray(result.data)?result.data[0]:result.data||{};
        state={loaded:true,authenticated:true,accountId:String(row.user_id||credentials.accountId),status:activeStatus(row),reason:row.reason||null,expiresAt:row.expires_at||null,roles:normalizeArray(row.roles),permissions:normalizeArray(row.permissions)};
        emit();
        return clone();
      }catch(error){
        console.warn('[KeloPermissions refresh]',error);
        const accountId=root.KeloOnlineAuth?.state?.()?.accountId||null;
        state={...EMPTY,authenticated:!!accountId,accountId};emit();
        return clone();
      }finally{refreshing=null;}
    })();
    return refreshing;
  }
  function hasRole(role){return state.roles.includes(String(role||''));}
  function can(permission){const p=String(permission||'');return hasRole('admin')||state.permissions.includes(p);}
  function hasAny(values){return (values||[]).some(v=>hasRole(v)||can(v));}
  function isRestricted(){return state.status==='banned'||state.status==='suspended';}
  const api=Object.freeze({version:VERSION,refresh,state:clone,hasRole,can,hasAny,isRestricted,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  root.KeloAccountPermissions=api;
  root.KeloPermissions=api;
  try{root.KELO_ADMIN_KEYS?.installScopeProvider?.({can});}catch(error){console.warn('[KeloPermissions scope bridge]',error);}
  ['kelo:online-auth-ready','kelo:account-signed-in','kelo:profile-complete','kelo:account-created'].forEach(name=>root.addEventListener(name,()=>void refresh()));
  root.addEventListener('kelo:account-signed-out',()=>{state={...EMPTY};emit();});
  await refresh();
  return api;
}
