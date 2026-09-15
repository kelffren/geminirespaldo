/* KELO-INDEX
 * area: SERVER / TEST
 * owner: Kelo server authority verification
 * keys: HEALTH READINESS WEBSOCKET HELLO SIGTERM SMOKE
 * purpose: levanta el server real y verifica readiness, handshake WebSocket, identidad de transición y shutdown limpio
 * online: prueba el mismo server/index.js usado por Render sin sustituir autoridad
 */
'use strict';
const assert=require('assert');
const {spawn}=require('child_process');
const {randomUUID}=require('crypto');
const WebSocket=require('ws');

const port=31000+(process.pid%10000);
const base=`http://127.0.0.1:${port}`;
const wsUrl=`ws://127.0.0.1:${port}`;
const child=spawn(process.execPath,['index.js'],{
  cwd:__dirname,
  env:{...process.env,PORT:String(port),KELO_REQUIRE_AUTH:'0',KELO_TITLES_SUPABASE:'0',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',chunk=>{output+=String(chunk);process.stdout.write(chunk);});
child.stderr.on('data',chunk=>{output+=String(chunk);process.stderr.write(chunk);});

function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitFor(fn,timeout=10000){
  const start=Date.now();
  while(Date.now()-start<timeout){if(await fn())return true;await delay(50);}
  throw new Error(`timeout after ${timeout}ms`);
}
function waitMessage(ws,predicate,timeout=8000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('websocket message timeout'));},timeout);
    function cleanup(){clearTimeout(timer);ws.off('message',onMessage);ws.off('error',onError);}
    function onError(err){cleanup();reject(err);}
    function onMessage(buf){let msg;try{msg=JSON.parse(String(buf));}catch(_){return;}if(predicate(msg)){cleanup();resolve(msg);}}
    ws.on('message',onMessage);ws.on('error',onError);
  });
}
function waitOpen(ws,timeout=8000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('websocket open timeout')),timeout);ws.once('open',()=>{clearTimeout(timer);resolve();});ws.once('error',err=>{clearTimeout(timer);reject(err);});});}
function waitClose(ws,timeout=4000){return new Promise(resolve=>{const timer=setTimeout(resolve,timeout);ws.once('close',()=>{clearTimeout(timer);resolve();});});}
function waitExit(proc,timeout=10000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('server shutdown timeout')),timeout);proc.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});});}

(async()=>{
  try{
    await waitFor(()=>output.includes('Kelo room ws://0.0.0.0:'));
    const readyRes=await fetch(`${base}/readyz`,{cache:'no-store'});
    assert.strictEqual(readyRes.status,200);
    const ready=await readyRes.json();
    assert.strictEqual(ready.ok,true);
    assert.strictEqual(ready.ready,true);
    assert.strictEqual(ready.service,'kelo-world-server');
    assert.strictEqual(ready.shuttingDown,false);
    assert.ok(ready.pvp);

    const ws=new WebSocket(wsUrl);
    const welcomePromise=waitMessage(ws,msg=>msg.t==='welcome');
    await waitOpen(ws);
    const welcome=await welcomePromise;
    assert.ok(welcome.id);
    const identityPromise=waitMessage(ws,msg=>msg.t==='identity');
    ws.send(JSON.stringify({t:'hello',name:'Smoke',playerKey:randomUUID()}));
    const identity=await identityPromise;
    assert.ok(identity.playerKey);
    assert.strictEqual(identity.authSource,'legacy-local');
    ws.close(1000,'smoke complete');
    await waitClose(ws);

    const exitPromise=waitExit(child);
    child.kill('SIGTERM');
    const exit=await exitPromise;
    assert.strictEqual(exit.code,0);
    console.log('✅ Kelo server smoke: readiness + websocket + hello + graceful shutdown');
  }catch(err){
    console.error('❌ Kelo server smoke failed:',err);
    try{child.kill('SIGKILL');}catch(_){}
    process.exitCode=1;
  }
})();
