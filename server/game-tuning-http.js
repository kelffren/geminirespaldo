/* KELO-INDEX
 * area: SERVER / AUTH / HTTP
 * owner: KeloGameTuningPublisher HTTP adapter
 * keys: ADMIN TUNING ACCESS PUBLISH AUTH CORS GITHUB UPDATE
 * purpose: expone lectura, access probe y publicación autenticada de tuning sobre el HTTP existente
 * public-api: createGameTuningHttpHandler
 * consumes: OnlineIdentityStore + KeloGameTuningPublisher
 * state-owned: ninguno
 * extension-points: allowed origins por KELO_GAME_TUNING_ALLOWED_ORIGINS
 * reuse: cliente KeloGameTuningAuthority
 * legacy: N/A
 * do-not: NO segundo listen(); NO publicar sin rol/permiso; NO secretos en respuestas
 */
'use strict';
function normalizeOrigin(value){return String(value||'').trim().replace(/\/$/,'');}
function allowedOrigins(value){const defaults=['https://kelffren.github.io','http://localhost:8000','http://localhost:3000','http://127.0.0.1:8000','http://127.0.0.1:3000'];return new Set([...defaults,...String(value||'').split(',').map(normalizeOrigin).filter(Boolean)]);}
function bearer(req){const match=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization||''));return match?match[1].trim():'';}
async function readJson(req,max=64*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max){const e=new Error('GAME_TUNING_BODY_TOO_LARGE');e.status=413;throw e;}chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){const e=new Error('GAME_TUNING_INVALID_JSON');e.status=400;throw e;}}
function writeJson(res,status,payload,origin,extra={}){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra};if(origin){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}res.writeHead(status,headers);res.end(JSON.stringify(payload));}
function accessFlags(access){const roles=new Set((access?.roles||[]).map(v=>String(v).toLowerCase())),permissions=new Set((access?.permissions||[]).map(String)),root=roles.has('owner')||roles.has('admin')||roles.has('developer');return{canEdit:root||permissions.has('game.tuning.edit')||permissions.has('world.edit'),canPublish:root||permissions.has('game.tuning.publish')||permissions.has('world.publish')};}
function createGameTuningHttpHandler(options={}){
  const publisher=options.publisher,identity=options.identity;if(!publisher?.get||!publisher?.publish)throw new Error('GAME_TUNING_PUBLISHER_REQUIRED');if(!identity?.verifyAccessToken||!identity?.getAccountAccess)throw new Error('GAME_TUNING_IDENTITY_REQUIRED');
  const allowed=allowedOrigins(options.allowedOrigins??process.env.KELO_GAME_TUNING_ALLOWED_ORIGINS);
  function cors(req){const origin=normalizeOrigin(req.headers.origin);if(!origin)return null;return allowed.has(origin)?origin:false;}
  async function authenticatedAccess(req){const token=bearer(req);if(!token){const e=new Error('AUTH_TOKEN_REQUIRED');e.status=401;throw e;}const user=await identity.verifyAccessToken(token);if(!user?.id||user.isAnonymous){const e=new Error('GAME_TUNING_AUTH_REQUIRED');e.status=403;throw e;}const access=await identity.getAccountAccess(token);return{token,user,access,flags:accessFlags(access)};}
  return async function handle(req,res){
    const path=String(req.url||'/').split('?')[0];if(!['/api/game-tuning','/api/game-tuning/access','/api/game-tuning/publish'].includes(path))return false;
    const origin=cors(req);if(origin===false){writeJson(res,403,{ok:false,error:'GAME_TUNING_ORIGIN_DENIED'},null);return true;}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'https://kelffren.github.io','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store',Vary:'Origin'});res.end();return true;}
    try{
      if(path==='/api/game-tuning'){
        if(req.method!=='GET'){writeJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'},origin,{Allow:'GET, OPTIONS'});return true;}
        const snapshot=await publisher.get();writeJson(res,200,{ok:true,config:snapshot.config,source:snapshot.source,publishConfigured:publisher.audit().configured},origin);return true;
      }
      if(path==='/api/game-tuning/access'){
        if(req.method!=='GET'){writeJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'},origin,{Allow:'GET, OPTIONS'});return true;}
        const auth=await authenticatedAccess(req);writeJson(res,200,{ok:true,...auth.flags,publishConfigured:publisher.audit().configured},origin);return true;
      }
      if(req.method!=='POST'){writeJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'},origin,{Allow:'POST, OPTIONS'});return true;}
      const auth=await authenticatedAccess(req);if(!auth.flags.canPublish){const e=new Error('GAME_TUNING_PERMISSION_DENIED');e.status=403;throw e;}
      const body=await readJson(req),result=await publisher.publish(body.config,{accountId:auth.user.id});writeJson(res,200,{ok:true,...result},origin);return true;
    }catch(error){const code=String(error?.message||'GAME_TUNING_SERVER_ERROR'),status=Number(error?.status)||(code.includes('NOT_CONFIGURED')?503:500);console.error('[Game Tuning]',code);writeJson(res,status,{ok:false,error:code},origin);return true;}
  };
}
module.exports={createGameTuningHttpHandler,accessFlags};
