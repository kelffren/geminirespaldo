/* KELO-INDEX
 * area: TEST / AVATAR REALTIME
 * owner: Avatar realtime contract proof
 * keys: SUPABASE FETCH STUB AUTH CHARACTER AVATAR
 * purpose: deterministic Supabase transport stub for authoritative avatar sync smoke tests
 * online: test-only; production keeps Supabase/Auth and Kelo server authority unchanged
 * do-not: NO production network changes, NO secrets, NO runtime authority
 */
'use strict';
const userByToken={tokenA:'11111111-1111-4111-8111-111111111111',tokenB:'22222222-2222-4222-8222-222222222222'};
const charByUser={'11111111-1111-4111-8111-111111111111':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const avatarReads=new Map();
function tokenFrom(headers){const h=headers||{};const raw=h.Authorization||h.authorization||'';return String(raw).replace(/^Bearer\s+/i,'');}
function json(data,status=200){return Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));}
function manifest(contentId,user){const suffix=contentId.endsWith('v2')?'v2':'v1';return{contentId,displayName:`Avatar ${suffix}`,payload:{avatarRuntime:{bucket:'avatars',path:`${user}/characters/a-${suffix}.webp`,publicUrl:'https://evil.example/client-or-db-url-must-not-pass.webp',columns:4,rows:4,rowMap:{down:0,left:1,right:2,up:3},frameMs:140,renderHeight:82}}};}
global.fetch=async function(url,opts={}){
  const u=new URL(String(url)),token=tokenFrom(opts.headers),user=userByToken[token]||null;
  if(u.hostname!=='supabase.test')return json({error:'unexpected host'},500);
  if(u.pathname==='/auth/v1/user')return user?json({id:user,email:null,is_anonymous:true}):json({message:'invalid token'},401);
  if(u.pathname==='/rest/v1/characters'){
    if(!user)return json([],200);
    const requested=String(u.searchParams.get('id')||'').replace(/^eq\./,''),account=String(u.searchParams.get('account_id')||'').replace(/^eq\./,''),allowed=charByUser[user];
    if(requested!==allowed||(account&&account!==user))return json([],200);
    const select=String(u.searchParams.get('select')||'');
    if(select.includes('active_avatar_content_id')){
      const n=(avatarReads.get(user)||0)+1;avatarReads.set(user,n);
      const active=user.startsWith('1111')?(n===1?'avatar-a-v1':'avatar-a-v2'):null;
      return json([{id:allowed,active_avatar_content_id:active}]);
    }
    return json([{id:allowed,account_id:user,name:user.startsWith('1111')?'A':'B',legacy_player_key:null,status:'active'}]);
  }
  if(u.pathname==='/rest/v1/rpc/get_avatar_manifest'){
    if(!user)return json(null,401);let body={};try{body=JSON.parse(String(opts.body||'{}'));}catch{}
    const id=String(body.p_content_id||'');if(user.startsWith('1111')&&/^avatar-a-v[12]$/.test(id))return json(manifest(id,user));return json(null,200);
  }
  return json({error:`unhandled ${u.pathname}`},404);
};
