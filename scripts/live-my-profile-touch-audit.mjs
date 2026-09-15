import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const artifacts=path.resolve('artifacts');fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-profile-touch-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
let nextId=1,buffer='';const pending=new Map(),listeners=new Map();
function on(method,fn){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);}
chrome.stdio[4].setEncoding('utf8');chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;let msg;try{msg=JSON.parse(raw);}catch{continue;}if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'CDP error')):p.resolve(msg.result||{});}else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;chrome.stdio[3].write(JSON.stringify(msg)+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error(`CDP timeout: ${method}`));}},30000).unref();});}
async function evalJs(expression,sid){const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sid);if(out.exceptionDetails)throw new Error(out.exceptionDetails.text||'runtime exception');return out.result?.value;}
async function navigate(url,sid){await send('Page.navigate',{url},sid);for(let i=0;i<60;i++){if(await evalJs(`document.readyState==='complete'`,sid))return;await sleep(500);}throw new Error('document load timeout');}
async function touch(x,y,sid){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:1,radiusY:1,force:1,id:1}]},sid);await sleep(80);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sid);}

const target=await send('Target.createTarget',{url:'about:blank'});const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);
const consoleErrors=[],failedRequests=[],httpErrors=[];
on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push((p.args||[]).map(a=>a.value??a.description??'').join(' '));});on('Runtime.exceptionThrown',p=>consoleErrors.push(`EXCEPTION: ${p.exceptionDetails?.text||'unknown'}`));on('Network.loadingFailed',p=>{if(!p.canceled)failedRequests.push(p.errorText||'failed');});on('Network.responseReceived',p=>{const s=Number(p.response?.status)||0;if(s>=400)httpErrors.push({status:s,url:p.response?.url||''});});

let ready=false;
for(let attempt=1;attempt<=36;attempt++){
  await navigate(`${base}?my-profile-touch=${Date.now()}-${attempt}`,sid);
  ready=!!await evalJs(`document.title==='Kelo World — V6.23'&&window.KeloSelfInteractionUI?.version==='self-interaction-ui-v1.0.0'&&window.KeloBackpackUI?.version==='backpack-ui-v2.0.0'&&window.KeloSelfProfileTouchFix?.version==='self-profile-touch-hotfix-v1.0.0'&&window.KELO_SELF_PROFILE_TOUCH_AUDIT?.physicalTouchBridge===true`,sid);
  if(ready)break;await sleep(5000);
}
if(!ready)throw new Error('LIVE never reached MY PROFILE touch fix');
await evalJs(`localStorage.clear();true`,sid);await navigate(`${base}?my-profile-touch=clean-${Date.now()}`,sid);await sleep(700);consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
const menu=await evalJs(`(()=>{const z=CONFIG.zoom||1;const sx=screenW/2+(localPlayer.x-camera.x)*z;const sy=screenH/2+(localPlayer.y-camera.y)*z;checkSocialTouch(sx,sy);const b=document.querySelector('#kelo-self-actions .ksi-profile');const r=b?.getBoundingClientRect();return {visible:!!b&&getComputedStyle(b).display!=='none',center:r?{x:r.left+r.width/2,y:r.top+r.height/2}:null,label:(b?.textContent||'').trim(),bound:b?.dataset.keloProfileTouchFixed||null};})()`,sid);
if(!menu.center||menu.label!=='MY PROFILE'||menu.bound!=='1')throw new Error(`Profile button not touch-ready ${JSON.stringify(menu)}`);
await touch(menu.center.x,menu.center.y,sid);await sleep(450);
const result=await evalJs(`(()=>{const bag=document.getElementById('kelo-bag');const actions=document.getElementById('kelo-self-actions');const legacy=document.getElementById('inspect-sheet');return {isOpen:!!window.KeloBackpackUI?.isOpen?.(),visible:!!bag&&getComputedStyle(bag).display!=='none',equipment:/EQUIPO/.test(bag?.textContent||''),attributes:/ATRIBUTOS/.test(bag?.textContent||''),actionsHidden:!actions||getComputedStyle(actions).display==='none',legacyHidden:!legacy||getComputedStyle(legacy).display==='none',lock:window.KELO_MODAL_INPUT_LOCK||null};})()`,sid);
if(!result.isOpen||!result.visible||!result.equipment||!result.attributes||!result.actionsHidden||!result.legacyHidden||result.lock!=='inventory')throw new Error(`Physical MY PROFILE touch failed ${JSON.stringify(result)}`);
const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);fs.writeFileSync(path.join(artifacts,'my-profile-touch-mobile.png'),Buffer.from(shot.data,'base64'));
const report={ready,menu,result,consoleErrors,failedRequests,httpErrors};fs.writeFileSync(path.join(artifacts,'my-profile-touch-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
