/* KELO-INDEX
 * area: CREATORS / CONTENT ONLINE
 * owner: Supabase Creator content repository adapter
 * owns: authenticated REST/RPC/Storage transport for Creator content
 * does-not-own: auth UI, schemas, runtime owners, service-role secrets or publish authority
 * security: publishable key is public; every write still requires user JWT + RLS/RPC validation
 */
const trimSlash=v=>String(v||'').replace(/\/+$/,'');
const encPath=p=>String(p||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
function decodeJwt(token){try{const part=String(token||'').split('.')[1];if(!part)return{};const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const json=decodeURIComponent(Array.from(atob(normalized),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));return JSON.parse(json);}catch{return{};}}
async function bodyJson(response){const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!response.ok){const message=data?.message||data?.error_description||data?.error||`HTTP_${response.status}`;const error=new Error(String(message));error.status=response.status;error.data=data;throw error;}return data;}

export function createSupabaseCreatorContentRepository({url,publishableKey,getAccessToken=()=>null,fetchImpl=globalThis.fetch}={}){
  const base=trimSlash(url);if(!base||!publishableKey||typeof fetchImpl!=='function')throw new Error('SUPABASE_CONTENT_CONFIG_REQUIRED');
  const token=()=>String(getAccessToken?.()||'').trim();
  function headers(extra={}){const jwt=token();return Object.assign({'apikey':publishableKey,'Accept':'application/json'},jwt?{'Authorization':`Bearer ${jwt}`}:{},extra);}
  async function rpc(name,payload={}){const r=await fetchImpl(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(payload)});return bodyJson(r);}
  async function select(path){const r=await fetchImpl(`${base}/rest/v1/${path}`,{headers:headers()});return bodyJson(r);}
  async function upload(bucket,path,file,{upsert=false}={}){const r=await fetchImpl(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encPath(path)}`,{method:'POST',headers:headers({'Content-Type':file.type||'application/octet-stream','x-upsert':String(!!upsert)}),body:file});return bodyJson(r);}
  async function remove(bucket,paths){const r=await fetchImpl(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`,{method:'DELETE',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({prefixes:Array.from(paths||[])})});return bodyJson(r);}
  async function signedUrl(bucket,path,expiresIn=3600){const r=await fetchImpl(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encPath(path)}`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({expiresIn:Math.max(60,Number(expiresIn)||3600)})});const data=await bodyJson(r),signed=data?.signedURL||data?.signedUrl;return signed?`${base}/storage/v1${signed.startsWith('/')?'':'/'}${signed}`:null;}
  const publicUrl=(bucket,path)=>`${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encPath(path)}`;
  const userId=()=>decodeJwt(token()).sub||null;
  return Object.freeze({
    version:'supabase-creator-content-repository-v1.1.0',userId,rpc,select,upload,remove,signedUrl,publicUrl,
    createAssetFamily:p=>rpc('create_asset_family',p),registerAssetRevision:p=>rpc('register_asset_revision',p),submitAssetRevision:id=>rpc('submit_asset_revision',{p_revision_id:id}),
    createContentDefinition:p=>rpc('create_content_definition',p),registerContentRevision:p=>rpc('register_content_revision',p),submitContentRevision:id=>rpc('submit_content_revision',{p_revision_id:id}),
    listMyRoles:()=>select('account_roles?select=role_key&order=role_key.asc'),
    listMyContent:()=>select('content_definition_revisions?select=id,definition_id,revision,content_id,schema_version,content_hash,payload,created_at&order=created_at.desc&limit=500'),
    listMyCharacters:()=>select('characters?select=id,name,status,active_avatar_content_id,created_at&status=eq.active&order=created_at.asc&limit=3'),
    createCharacter:name=>rpc('create_character',{p_name:name}),
    setActiveCharacterAvatar:(characterId,contentId)=>rpc('set_active_character_avatar',{p_character_id:characterId,p_content_id:contentId}),
    getAvatarManifest:contentId=>rpc('get_avatar_manifest',{p_content_id:contentId})
  });
}
