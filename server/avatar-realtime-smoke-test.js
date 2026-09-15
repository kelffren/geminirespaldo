/* KELO-INDEX
 * area: TEST / AVATAR REALTIME
 * owner: Avatar realtime contract proof
 * purpose: prove two-player refresh, late join hydration and spoof rejection over the real WebSocket server
 */
'use strict';
const assert=require('assert');
const path=require('path');
const {spawn}=require('child_process');
const {WebSocket}=require('ws');

const PORT=27861,URL=`ws://127.0.0.1:${PORT}`;
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222';
const charA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',charB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
function inbox(ws){const rows=[];const waiters=[];ws.on('message',buf=>{let msg;try{msg=JSON.parse(String(buf));}catch{return;}rows.push(msg);for(let i=waiters.length-1;i>=0;i--){const w=waiters[i];if(w.pred(msg)){waiters.splice(i,1);clearTimeout(w.timer);w.resolve(msg);}}});return{rows,wait(pred,ms=5000){const hit=rows.find(pred);if(hit)return Promise.resolve(hit);return new Promise((resolve,reject)=>{const w={pred,resolve,reject,timer:null};w.timer=setTimeout(()=>{const i=waiters.indexOf(w);if(i>=0)waiters.splice(i,1);reject(new Error('MESSAGE_TIMEOUT'));},ms);waiters.push(w);});}};}
async function connect(){const ws=new WebSocket(URL),box=inbox(ws);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});const welcome=await box.wait(m=>m.t==='welcome');return{ws,box,welcome};}
async function waitServer(child){let ready=false;child.stdout.on('data',b=>{if(String(b).includes('Kelo room'))ready=true;});for(let i=0;i<80&&!ready;i++)await delay(50);if(!ready)throw new Error('SERVER_NOT_READY');}
(async()=>{
  const child=spawn(process.execPath,['-r',path.join(__dirname,'avatar-realtime-fetch-stub.js'),path.join(__dirname,'index.js')],{env:{...process.env,PORT:String(PORT),SUPABASE_URL:'https://supabase.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',KELO_REQUIRE_AUTH:'1'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',b=>stderr+=String(b));
  try{
    await waitServer(child);
    const A=await connect(),B=await connect();
    const idA=A.welcome.id;
    A.ws.send(JSON.stringify({t:'hello',name:'A',accessToken:'tokenA',characterId:charA}));
    B.ws.send(JSON.stringify({t:'hello',name:'B',accessToken:'tokenB',characterId:charB}));
    await A.box.wait(m=>m.t==='identity'&&m.characterId===charA);
    await B.box.wait(m=>m.t==='identity'&&m.characterId===charB);
    const first=await B.box.wait(m=>m.t==='state'&&m.players?.[idA]?.avatarManifest?.contentId==='avatar-a-v1');
    assert.equal(first.players[idA].avatarManifest.payload.avatarRuntime.publicUrl,'https://supabase.test/storage/v1/object/public/avatars/11111111-1111-4111-8111-111111111111/characters/a-v1.webp');
    A.ws.send(JSON.stringify({t:'avatar:refresh',requestId:'r_avatar',accessToken:'tokenA',characterId:charA}));
    const refreshed=await A.box.wait(m=>m.t==='avatar:refreshed'&&m.requestId==='r_avatar');
    assert.equal(refreshed.avatarManifest.contentId,'avatar-a-v2');
    const remote=await B.box.wait(m=>m.t==='state'&&m.players?.[idA]?.avatarManifest?.contentId==='avatar-a-v2');
    assert.equal(remote.players[idA].avatarManifest.payload.avatarRuntime.columns,4);
    A.ws.send(JSON.stringify({t:'avatar:refresh',requestId:'spoof',accessToken:'tokenB',characterId:charA,avatarManifest:{publicUrl:'https://evil.example/hack.png'}}));
    const rejected=await A.box.wait(m=>m.t==='error'&&m.requestId==='spoof');
    assert.equal(rejected.code,'CHARACTER_NOT_OWNED');
    const C=await connect();
    assert.equal(C.welcome.players?.[idA]?.avatarManifest?.contentId,'avatar-a-v2','late joiner must receive persisted authoritative avatar');
    A.ws.close();B.ws.close();C.ws.close();
    console.log('AVATAR_REALTIME_SMOKE_OK');
    console.log(JSON.stringify({twoPlayers:true,refreshBroadcast:true,lateJoin:true,spoofRejected:true,serverBuiltPublicUrl:true}));
  }finally{
    child.kill('SIGTERM');await delay(150);
    if(child.exitCode&&child.exitCode!==0)throw new Error(`SERVER_EXIT_${child.exitCode}:${stderr.slice(-500)}`);
  }
})().catch(err=>{console.error(err);process.exit(1);});
