/* KELO-INDEX
 * area: AUTH / ONLINE IDENTITY
 * owner: KeloOnlineAuth
 * keys: SUPABASE SESSION JWT CHARACTER ACCOUNT LOGIN REGISTER GOOGLE OAUTH GUEST MAGIC LINK PASSWORD PROFILE AGE 18 SEX
 * purpose: resolver identidad durable de cuenta/personaje y exigir perfil 18+ antes de activar una cuenta permanente
 * online: accessToken solo viaja al server en hello; nunca se envía refresh token ni credenciales backend
 * do-not: NO service_role/sb_secret, NO segundo WebSocket, NO confiar metadata para autorización, NO crear invitados sin acción explícita
 */
(function(){
'use strict';
const VERSION='kelo-online-auth-v6-profile-18-redirect-guard';
const SUPABASE_URL='https://iapxdbitjdwvtbpjghct.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_t0RI7co82Rh1wOAWUIo4Zg_rZK5EQ9S';
const PRODUCTION_APP_URL='https://kelffren.github.io/gemini/';
const LOCAL_AUTH_HOST_RE=/^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i;
const CHARACTER_STORAGE_KEY='kelo_character_id_v1',LEGACY_PLAYER_KEY='kelo_player_key_v1',PLAYER_NAME_KEY='kelo_player_name_v1';
const NET_CHARACTER_STORAGE_KEY='kelo.active.character.v1',NET_SESSION_STORAGE_KEY='kelo.supabase.session.v1';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEX_VALUES=new Set(['male','female','other']);
let client=null,current=null,state='booting',lastError=null,bootPromise=null;
function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
function stored(key){try{return localStorage.getItem(key)}catch(_){return null}}
function store(key,value){try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}catch(_){}}
function syncNetSession(session,characterId){
  try{
    if(session?.access_token&&UUID_RE.test(String(characterId||''))){
      localStorage.setItem(NET_CHARACTER_STORAGE_KEY,String(characterId).toLowerCase());
      localStorage.setItem(NET_SESSION_STORAGE_KEY,JSON.stringify({access_token:String(session.access_token),expires_at:Number(session.expires_at)||0}));
      return true;
    }
    localStorage.removeItem(NET_CHARACTER_STORAGE_KEY);localStorage.removeItem(NET_SESSION_STORAGE_KEY);
  }catch(_){}
  return false;
}
function cleanEmail(value){return String(value||'').trim().toLowerCase()}
function cleanPassword(value){return String(value||'')}
function cleanDisplayName(value){const raw=String(value||'').trim().replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,24);return raw.length>=3?raw:null}
function cleanSex(value){const sex=String(value||'').trim().toLowerCase();return SEX_VALUES.has(sex)?sex:null}
function parseBirthDate(value){
  const raw=String(value||'').trim();const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);if(!m)return null;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),date=new Date(y,mo-1,d);
  if(date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d)return null;
  return{raw,y,mo,d};
}
function adultCutoffParts(now){
  const date=now instanceof Date?now:new Date();const y=date.getFullYear()-18,mo=date.getMonth()+1;
  const last=new Date(y,mo,0).getDate(),d=Math.min(date.getDate(),last);return{y,mo,d};
}
function isAdultBirthDate(value,now){
  const birth=parseBirthDate(value);if(!birth)return false;const cutoff=adultCutoffParts(now);
  if(birth.y!==cutoff.y)return birth.y<cutoff.y;if(birth.mo!==cutoff.mo)return birth.mo<cutoff.mo;return birth.d<=cutoff.d;
}
function profileMeta(user){
  const meta=user?.user_metadata||{},sex=cleanSex(meta.sex),birthDate=parseBirthDate(meta.birth_date)?.raw||null;
  const complete=meta.kelo_profile_complete===true&&!!cleanDisplayName(meta.display_name)&&!!sex&&!!birthDate&&isAdultBirthDate(birthDate);
  return{nameChosen:meta.kelo_name_chosen===true,displayName:cleanDisplayName(meta.display_name),sex,birthDate,complete};
}
function publicState(){return Object.freeze({version:VERSION,state,authenticated:!!current,accountId:current?.accountId||null,characterId:current?.characterId||null,characterName:current?.profileComplete===false&&!current?.isAnonymous?null:(current?.characterName||null),email:current?.email||null,isAnonymous:!!current?.isAnonymous,profileComplete:current?.profileComplete!==false,profileRequired:state==='profile-required',sex:current?.profileComplete?current?.sex||null:null,birthDate:current?.profileComplete?current?.birthDate||null:null,confirmationRequired:state==='confirmation-required',error:lastError?String(lastError.message||lastError):null});}
function preferredCharacterName(user){
  const meta=user?.user_metadata||{};
  return (meta.kelo_name_chosen===true?cleanDisplayName(meta.display_name):null)||cleanDisplayName(stored(PLAYER_NAME_KEY))||'Kelo';
}
function appRedirectUrl(){
  try{
    const params=new URLSearchParams(location.search||'');
    const explicitLocal=params.get('authLocal')==='1';
    const localHost=LOCAL_AUTH_HOST_RE.test(String(location.hostname||''));
    if(explicitLocal&&localHost)return location.origin+location.pathname;
  }catch(_){}
  return PRODUCTION_APP_URL;
}
function setState(next,error){state=next;lastError=error||null;const snapshot=publicState();emit('kelo:online-auth-state',snapshot);return snapshot}
function initClient(){
  if(client)return client;
  if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('SUPABASE_JS_UNAVAILABLE');
  client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{try{emit('kelo:online-auth-event',{event,hasSession:!!session,isAnonymous:!!session?.user?.is_anonymous})}catch(_){}});
  return client;
}
async function ensureCharacter(session){
  const token=session?.access_token,user=session?.user;if(!token||!user?.id)throw new Error('AUTH_SESSION_REQUIRED');
  const verified=await initClient().auth.getUser(token);if(verified.error||!verified.data?.user?.id)throw verified.error||new Error('AUTH_USER_INVALID');
  const verifiedUser=verified.data.user,accountId=String(verifiedUser.id).toLowerCase(),isAnonymous=Boolean(verifiedUser.is_anonymous),profile=profileMeta(verifiedUser),initialName=preferredCharacterName(verifiedUser);
  const query=await client.from('characters').select('id,name,legacy_player_key,status').eq('status','active').limit(3);if(query.error)throw query.error;
  const rows=Array.isArray(query.data)?query.data:[],storedId=String(stored(CHARACTER_STORAGE_KEY)||'').toLowerCase();let character=rows.find(row=>String(row.id).toLowerCase()===storedId)||rows[0]||null;
  if(!isAnonymous&&!profile.complete){
    syncNetSession(null,null);
    return{accessToken:token,accountId,characterId:character?.id&&UUID_RE.test(String(character.id))?String(character.id).toLowerCase():null,characterName:character?.name?String(character.name).slice(0,24):null,email:verifiedUser.email||null,isAnonymous:false,profileComplete:false,nameChosen:profile.nameChosen,sex:null,birthDate:null};
  }
  if(!character){const created=await client.rpc('create_character',{p_name:initialName});if(created.error)throw created.error;character=Array.isArray(created.data)?created.data[0]:created.data;}
  if(!character?.id||!UUID_RE.test(String(character.id)))throw new Error('CHARACTER_RESOLUTION_FAILED');
  const characterId=String(character.id).toLowerCase();store(CHARACTER_STORAGE_KEY,characterId);syncNetSession(session,characterId);
  const legacy=String(stored(LEGACY_PLAYER_KEY)||'').toLowerCase();if(UUID_RE.test(legacy)&&!character.legacy_player_key){const claimed=await client.rpc('claim_legacy_player_key',{p_character_id:characterId,p_player_key:legacy});if(!claimed.error){const row=Array.isArray(claimed.data)?claimed.data[0]:claimed.data;if(row)character=row;}}
  return{accessToken:token,accountId,characterId,characterName:String(character.name||initialName).slice(0,24),email:verifiedUser.email||null,isAnonymous,profileComplete:isAnonymous?true:profile.complete,nameChosen:isAnonymous||profile.nameChosen,sex:profile.sex,birthDate:profile.birthDate};
}
async function resolveSession(){
  initClient();const result=await client.auth.getSession();if(result.error)throw result.error;const session=result.data?.session||null;
  if(!session){current=null;syncNetSession(null,null);setState('signed-out');emit('kelo:online-auth-required',publicState());return null;}
  current=await ensureCharacter(session);setState(current&&!current.isAnonymous&&current.profileComplete===false?'profile-required':'ready');emit(current?.profileComplete===false?'kelo:profile-required':'kelo:online-auth-ready',publicState());return current;
}
function ensureBoot(){if(!bootPromise)bootPromise=resolveSession().catch(error=>{current=null;syncNetSession(null,null);setState('transition',error);emit('kelo:online-auth-error',publicState());return null;});return bootPromise;}
async function credentials(){
  initClient();const result=await client.auth.getSession();if(result.error||!result.data?.session)return current;
  try{current=await ensureCharacter(result.data.session);setState(current&&!current.isAnonymous&&current.profileComplete===false?'profile-required':'ready');return current}catch(error){setState('transition',error);return current;}
}
async function ready(timeoutMs){const ms=Math.max(500,Math.min(10000,Number(timeoutMs)||5000));return Promise.race([ensureBoot(),new Promise(resolve=>setTimeout(()=>resolve(current),ms))]);}
async function signInWithPassword(email,password){
  initClient();const normalized=cleanEmail(email),secret=cleanPassword(password);if(!normalized||secret.length<6)throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  const result=await client.auth.signInWithPassword({email:normalized,password:secret});if(result.error)throw result.error;
  current=await ensureCharacter(result.data.session);setState(current.profileComplete===false?'profile-required':'ready');emit('kelo:account-signed-in',publicState());return publicState();
}
async function signInWithGoogle(){
  initClient();const existing=await client.auth.getSession();if(existing.error)throw existing.error;
  if(existing.data?.session?.user?.is_anonymous)throw new Error('GUEST_GOOGLE_ACCOUNT_SEPARATE_REQUIRED');
  setState('oauth-redirect');
  const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:appRedirectUrl(),queryParams:{prompt:'select_account'}}});
  if(result.error){setState('signed-out',result.error);throw result.error;}
  emit('kelo:google-auth-redirect',{provider:'google',url:result.data?.url||null});return{ok:true,provider:'google'};
}
function validateProfile(displayName,sex,birthDate){
  const name=cleanDisplayName(displayName),normalizedSex=cleanSex(sex),birth=parseBirthDate(birthDate)?.raw||null;
  if(!name)throw new Error('INVALID_CHARACTER_NAME');if(!normalizedSex)throw new Error('SEX_REQUIRED');if(!birth)throw new Error('INVALID_BIRTH_DATE');if(!isAdultBirthDate(birth))throw new Error('AGE_RESTRICTED_18_PLUS');
  return{name,sex:normalizedSex,birthDate:birth};
}
async function signUp(email,password,displayName,sex,birthDate){
  initClient();const normalized=cleanEmail(email),secret=cleanPassword(password);if(!normalized||secret.length<6)throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  const profile=validateProfile(displayName,sex,birthDate),existing=await client.auth.getSession();if(existing.data?.session?.user?.is_anonymous)throw new Error('GUEST_ACCOUNT_MUST_BE_PROTECTED_OR_SEPARATED');
  store(PLAYER_NAME_KEY,profile.name);
  const result=await client.auth.signUp({email:normalized,password:secret,options:{data:{display_name:profile.name,sex:profile.sex,birth_date:profile.birthDate,kelo_name_chosen:true,kelo_profile_complete:true},emailRedirectTo:appRedirectUrl()}});if(result.error)throw result.error;
  if(result.data?.session){current=await ensureCharacter(result.data.session);setState('ready');emit('kelo:account-created',publicState());return publicState();}
  current=null;syncNetSession(null,null);setState('confirmation-required');emit('kelo:account-confirmation-required',{email:normalized});return publicState();
}
async function completeProfile(displayName,sex,birthDate){
  initClient();const profile=validateProfile(displayName,sex,birthDate),sessionResult=await client.auth.getSession(),session=sessionResult.data?.session;
  if(sessionResult.error||!session?.user||session.user.is_anonymous)throw sessionResult.error||new Error('PERMANENT_ACCOUNT_REQUIRED');
  let character=null,characterId=current?.characterId&&UUID_RE.test(String(current.characterId))?String(current.characterId).toLowerCase():null;
  if(characterId){const renamed=await client.from('characters').update({name:profile.name}).eq('id',characterId).select('id,name,legacy_player_key,status').single();if(renamed.error)throw renamed.error;character=renamed.data;}
  else{const created=await client.rpc('create_character',{p_name:profile.name});if(created.error)throw created.error;character=Array.isArray(created.data)?created.data[0]:created.data;characterId=String(character?.id||'').toLowerCase();}
  if(!characterId||!UUID_RE.test(characterId))throw new Error('CHARACTER_RESOLUTION_FAILED');
  const updated=await client.auth.updateUser({data:{display_name:profile.name,sex:profile.sex,birth_date:profile.birthDate,kelo_name_chosen:true,kelo_profile_complete:true}});if(updated.error)throw updated.error;
  store(PLAYER_NAME_KEY,profile.name);
  await client.from('profiles').update({display_name:profile.name}).eq('user_id',session.user.id);
  store(CHARACTER_STORAGE_KEY,characterId);syncNetSession(session,characterId);
  current={accessToken:session.access_token,accountId:String(session.user.id).toLowerCase(),characterId,characterName:profile.name,email:session.user.email||null,isAnonymous:false,profileComplete:true,nameChosen:true,sex:profile.sex,birthDate:profile.birthDate};
  setState('ready');emit('kelo:profile-complete',publicState());return publicState();
}
async function signInWithOtp(email){
  initClient();const normalized=cleanEmail(email);if(!normalized)throw new Error('EMAIL_REQUIRED');
  const result=await client.auth.signInWithOtp({email:normalized,options:{emailRedirectTo:appRedirectUrl(),shouldCreateUser:false}});if(result.error)throw result.error;return{ok:true,email:normalized};
}
async function resetPassword(email){
  initClient();const normalized=cleanEmail(email);if(!normalized)throw new Error('EMAIL_REQUIRED');
  const result=await client.auth.resetPasswordForEmail(normalized,{redirectTo:appRedirectUrl()});if(result.error)throw result.error;return{ok:true,email:normalized};
}
async function signInAsGuest(){
  initClient();const existing=await client.auth.getSession();if(existing.data?.session){current=await ensureCharacter(existing.data.session);setState(current.profileComplete===false?'profile-required':'ready');return publicState();}
  const guest=await client.auth.signInAnonymously();if(guest.error)throw guest.error;if(!guest.data?.session)throw new Error('GUEST_SESSION_MISSING');
  current=await ensureCharacter(guest.data.session);setState('ready');emit('kelo:guest-created',publicState());return publicState();
}
async function protectGuestWithEmail(email,displayName){
  initClient();const normalized=cleanEmail(email),name=cleanDisplayName(displayName)||preferredCharacterName();if(!normalized)throw new Error('EMAIL_REQUIRED');
  const existing=await client.auth.getSession(),session=existing.data?.session;if(!session?.user?.is_anonymous)throw new Error('ANONYMOUS_SESSION_REQUIRED');
  store(PLAYER_NAME_KEY,name);
  const result=await client.auth.updateUser({email:normalized,data:{display_name:name,kelo_name_chosen:true,kelo_profile_complete:false}},{emailRedirectTo:appRedirectUrl()});if(result.error)throw result.error;
  setState('confirmation-required');emit('kelo:guest-protection-pending',{email:normalized,characterId:current?.characterId||null});return{ok:true,email:normalized,confirmationRequired:true};
}
async function setPassword(password){
  initClient();const secret=cleanPassword(password);if(secret.length<6)throw new Error('PASSWORD_TOO_SHORT');const result=await client.auth.updateUser({password:secret});if(result.error)throw result.error;await credentials();return publicState();
}
async function signOut(){if(client)await client.auth.signOut();current=null;store(CHARACTER_STORAGE_KEY,null);syncNetSession(null,null);setState('signed-out');emit('kelo:account-signed-out',publicState());return publicState();}
const api=Object.freeze({version:VERSION,ready,credentials,state:publicState,signInWithPassword,signInWithGoogle,signUp,completeProfile,signInWithOtp,resetPassword,signInAsGuest,protectGuestWithEmail,setPassword,signOut,getClient:()=>client,isAdultBirthDate});window.KeloOnlineAuth=api;ensureBoot();

// Compatibility bridge for the existing KeloNetAuthority. It modifies only the existing hello payload; it never creates a socket.
(function installHelloInjector(){
  const Native=window.WebSocket;if(!Native||!Native.prototype||typeof Native.prototype.send!=='function'||Native.prototype.send.__keloAuthWrapped)return;
  const nativeSend=Native.prototype.send;
  function send(data){
    let msg=null;try{if(typeof data==='string')msg=JSON.parse(data)}catch(_){}
    if(!msg||msg.t!=='hello'||msg.accessToken||msg.characterId)return nativeSend.call(this,data);
    const socket=this,sendHello=auth=>{if(!auth?.accessToken||!auth?.characterId||auth?.profileComplete===false||socket.readyState!==Native.OPEN)return false;const out={...msg,accessToken:auth.accessToken,characterId:auth.characterId};if(auth.characterName)out.name=auth.characterName;nativeSend.call(socket,JSON.stringify(out));return true;};
    if(current){sendHello(current);return;}
    ready(9000).then(auth=>{if(auth)sendHello(auth)}).catch(()=>{});
  }
  Object.defineProperty(send,'__keloAuthWrapped',{value:true});Native.prototype.send=send;
})();
})();