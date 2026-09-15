'use strict';
const {serviceError}=require('./sprite-ai-service');

function normalizeOrigin(value){return String(value||'').trim().replace(/\/$/,'');}
function buildAllowedOrigins(value){
  const defaults=['https://kelffren.github.io','http://localhost:8000','http://localhost:3000','http://127.0.0.1:8000','http://127.0.0.1:3000'];
  const extra=String(value||'').split(',').map(normalizeOrigin).filter(Boolean);
  return new Set([...defaults,...extra]);
}
function createRateLimiter({limit=4,windowMs=60*60*1000}={}){
  const buckets=new Map();
  return function take(key){
    const now=Date.now(),id=String(key||'anonymous');let row=buckets.get(id);
    if(!row||now-row.startedAt>=windowMs){row={startedAt:now,count:0};buckets.set(id,row);}
    const resetAt=row.startedAt+windowMs;
    if(row.count>=limit)return{ok:false,limit,remaining:0,resetAt};
    row.count++;return{ok:true,limit,remaining:Math.max(0,limit-row.count),resetAt};
  };
}
function readJson(req,maxBytes){
  return (async()=>{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw serviceError('SPRITE_AI_BODY_TOO_LARGE',413);chunks.push(chunk);}if(!chunks.length)return{};let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw serviceError('SPRITE_AI_INVALID_JSON',400);}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw serviceError('SPRITE_AI_INVALID_BODY',400);return parsed;})();
}
function bearer(req){const raw=String(req.headers.authorization||'');const match=/^Bearer\s+(.+)$/i.exec(raw);return match?match[1].trim():'';}
function writeJson(res,status,payload,origin,extra={}){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra};
  if(origin){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
  res.writeHead(status,headers);res.end(JSON.stringify(payload));
}
function createSpriteAiHttpHandler(options={}){
  const service=options.service;if(!service||typeof service.generate!=='function')throw new Error('SPRITE_AI_SERVICE_REQUIRED');
  const identity=options.identity;if(!identity||typeof identity.verifyAccessToken!=='function')throw new Error('SPRITE_AI_IDENTITY_REQUIRED');
  const maxBodyBytes=Math.max(1024*1024,Number(options.maxBodyBytes||process.env.KELO_SPRITE_AI_MAX_BODY_BYTES||10*1024*1024));
  const rateLimit=Math.max(1,Math.min(60,Number(options.rateLimit||process.env.KELO_SPRITE_AI_RATE_LIMIT_PER_HOUR||4)));
  const allowed=buildAllowedOrigins(options.allowedOrigins??process.env.KELO_SPRITE_AI_ALLOWED_ORIGINS);
  const take=createRateLimiter({limit:rateLimit});
  function corsOrigin(req){const origin=normalizeOrigin(req.headers.origin);if(!origin)return null;if(allowed.has(origin))return origin;return false;}
  return async function handle(req,res){
    const path=String(req.url||'/').split('?')[0];if(path!=='/api/sprite-generate'&&path!=='/api/sprite-generate/status')return false;
    const origin=corsOrigin(req);if(origin===false){writeJson(res,403,{ok:false,error:'SPRITE_AI_ORIGIN_DENIED'},null);return true;}
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Origin':origin||'https://kelffren.github.io','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store',Vary:'Origin'});res.end();return true;
    }
    if(path==='/api/sprite-generate/status'){
      if(req.method!=='GET'){writeJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'},origin,{Allow:'GET, OPTIONS'});return true;}
      writeJson(res,200,{ok:true,service:'kelo-sprite-ai',...service.status(),auth:'supabase-user',anonymousAllowed:false,rateLimitPerHour:rateLimit},origin);return true;
    }
    if(req.method!=='POST'){writeJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'},origin,{Allow:'POST, OPTIONS'});return true;}
    try{
      const token=bearer(req);if(!token)throw serviceError('AUTH_TOKEN_REQUIRED',401);
      const user=await identity.verifyAccessToken(token);if(!user?.id)throw serviceError('INVALID_AUTH_USER',401);if(user.isAnonymous)throw serviceError('SPRITE_AI_ANONYMOUS_DENIED',403);
      const budget=take(user.id);if(!budget.ok)throw serviceError('SPRITE_AI_RATE_LIMITED',429,String(budget.resetAt));
      const input=await readJson(req,maxBodyBytes),result=await service.generate(input);
      writeJson(res,200,{...result,rateLimit:{limit:budget.limit,remaining:budget.remaining,resetAt:budget.resetAt}},origin);return true;
    }catch(error){
      const status=Number(error?.status)||500,code=String(error?.code||error?.message||'SPRITE_AI_SERVER_ERROR');
      console.error('[Sprite AI]',code,error?.detail||'');writeJson(res,status,{ok:false,error:code,detail:error?.detail||null},origin);return true;
    }
  };
}
module.exports={createSpriteAiHttpHandler,createRateLimiter,buildAllowedOrigins,readJson};
