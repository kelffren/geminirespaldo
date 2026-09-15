'use strict';
/* KELO-INDEX
 * area: SERVER / PERSISTENCE
 * owner: Kelo server authority
 * keys: SUPABASE EDGE STATE SNAPSHOT NOBILITY BACKEND SECRET SERIALIZATION
 * purpose: único puente server->Supabase Edge; serializa saves por personaje para que stores compartidos no se pisen
 * online: solo el proceso trusted server conoce KELO_SERVER_BRIDGE_KEY; navegador nunca invoca este módulo
 * do-not: NO poner KELO_SERVER_BRIDGE_KEY en respuestas/logs/cliente; NO segundo gameplay authority
 */
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTANCES=new Map();
function clean(value){return String(value||'').trim();}
function createServerStateBridge(opts={}){
  const url=clean(opts.url||process.env.KELO_SERVER_STATE_URL),serverKey=clean(opts.serverKey||process.env.KELO_SERVER_BRIDGE_KEY),instanceKey=url+'|'+serverKey;
  if(INSTANCES.has(instanceKey))return INSTANCES.get(instanceKey);
  const configured=Boolean(url&&serverKey),saveQueues=new Map();let requests=0,failures=0,lastError=null,lastSuccessAt=0;
  async function call(op,characterId,payload={}){
    const id=clean(characterId).toLowerCase();if(!configured)throw new Error('PERSISTENCE_BRIDGE_NOT_CONFIGURED');if(!UUID_RE.test(id))throw new Error('PERSISTENCE_CHARACTER_REQUIRED');requests++;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-kelo-server-key':serverKey},body:JSON.stringify({op,characterId:id,...payload}),signal:controller.signal});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=null;}if(!res.ok||!data?.ok)throw new Error(String(data?.code||`PERSISTENCE_${res.status}`));lastSuccessAt=Date.now();lastError=null;return data;}
    catch(error){failures++;lastError=String(error&&error.message||error);throw error;}finally{clearTimeout(timer);}
  }
  function queuedSave(id,state){
    const key=clean(id).toLowerCase(),previous=saveQueues.get(key)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{const data=await call('save',key,{state});return data.snapshot||null;});
    saveQueues.set(key,task);task.finally(()=>{if(saveQueues.get(key)===task)saveQueues.delete(key);}).catch(()=>{});return task;
  }
  const api=Object.freeze({version:'kelo-server-state-bridge-v2',configured,load:async id=>(await call('load',id)).snapshot||null,save:queuedSave,nobilityEnsure:async(id,name)=>(await call('nobility:ensure',id,{name})).row||null,nobilityGet:async id=>(await call('nobility:get',id)).row||null,nobilityTop:async(id,limit)=>(await call('nobility:top',id,{limit})).rows||[],nobilityDonate:async(id,currency,amount)=>(await call('nobility:donate',id,{currency,amount})).row||null,audit:()=>({version:'kelo-server-state-bridge-v2',configured,requests,failures,pendingSaves:saveQueues.size,lastError,lastSuccessAt})});
  INSTANCES.set(instanceKey,api);return api;
}
module.exports={createServerStateBridge};
