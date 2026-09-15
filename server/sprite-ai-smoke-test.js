'use strict';
const assert=require('assert');
const http=require('http');
const {createSpriteAiService,buildPrompt}=require('./sprite-ai-service');
const {createSpriteAiHttpHandler}=require('./sprite-ai-http');

(async()=>{
  const calls=[];const png=Buffer.from('89504e470d0a1a0a','hex').toString('base64');
  const fakeFetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({data:[{b64_json:png}],usage:{total_tokens:1}}),{status:200,headers:{'content-type':'application/json'}});};
  const service=createSpriteAiService({apiKey:'test-key',model:'gpt-image-test',quality:'low',size:'1024x2048',fetchImpl:fakeFetch,maxSourceBytes:1024*1024});
  assert.equal(service.status().configured,true);assert(buildPrompt({}).includes('exactly 4 equal columns by 8 equal rows'));
  const textOut=await service.generate({action:'walk'});assert(textOut.imageDataUrl.startsWith('data:image/png;base64,'));assert.equal(calls[0].url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(calls[0].options.body).background,'transparent');
  const src='data:image/png;base64,'+Buffer.from('fakepng').toString('base64');await service.generate({sourceImageDataUrl:src});assert.equal(calls[1].url,'https://api.openai.com/v1/images/edits');assert(calls[1].options.body instanceof FormData);

  const identity={verifyAccessToken:async token=>token==='good'?{id:'user-1',isAnonymous:false}:token==='guest'?{id:'guest-1',isAnonymous:true}:Promise.reject(Object.assign(new Error('INVALID_AUTH_USER'),{code:'INVALID_AUTH_USER',status:401}))};
  const handler=createSpriteAiHttpHandler({service,identity,allowedOrigins:'https://example.test',rateLimit:2,maxBodyBytes:1024*1024});
  const server=http.createServer((req,res)=>{handler(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    let r=await fetch(base+'/api/sprite-generate/status',{headers:{Origin:'https://example.test'}});assert.equal(r.status,200);let j=await r.json();assert.equal(j.configured,true);assert.equal(r.headers.get('access-control-allow-origin'),'https://example.test');
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test','content-type':'application/json'},body:'{}'});assert.equal(r.status,401);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer guest','content-type':'application/json'},body:'{}'});assert.equal(r.status,403);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:JSON.stringify({action:'walk'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.ok,true);assert.equal(j.rateLimit.remaining,1);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:'{}'});assert.equal(r.status,200);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:'{}'});assert.equal(r.status,429);
    r=await fetch(base+'/api/sprite-generate/status',{headers:{Origin:'https://evil.test'}});assert.equal(r.status,403);
  }finally{await new Promise(r=>server.close(r));}
  console.log('Sprite AI smoke passed: generation + edit + auth + anonymous deny + CORS + rate limit');
})().catch(error=>{console.error(error);process.exit(1);});
