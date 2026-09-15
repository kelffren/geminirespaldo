/* KELO-INDEX
 * area: CORE / UPDATE WORKER
 * owner: KeloUpdateVerifierWorker
 * keys: UPDATE VERIFY HASH GIT BLOB SHA1 SYNTAX WORKER OFF-MAIN-THREAD
 * purpose: verify downloaded update bytes away from the gameplay main thread
 * do-not: NO DOM, NO gameplay state, NO network, NO execution of update code
 */
'use strict';

function hex(buffer){
  return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
}

async function gitBlobSha(buffer){
  if(!self.crypto||!self.crypto.subtle)throw new Error('worker_crypto_unavailable');
  const bytes=new Uint8Array(buffer);
  const header=new TextEncoder().encode('blob '+bytes.byteLength+'\0');
  const payload=new Uint8Array(header.byteLength+bytes.byteLength);
  payload.set(header,0);
  payload.set(bytes,header.byteLength);
  return hex(await self.crypto.subtle.digest('SHA-1',payload));
}

function syntaxCheck(buffer,path){
  const p=String(path||'').toLowerCase();
  if(!p.endsWith('.js')||p.endsWith('.mjs'))return {status:'skipped',error:null};
  try{
    const text=new TextDecoder().decode(buffer);
    /* Parse/compile only. The function is intentionally never invoked. */
    new Function(text);
    return {status:'ok',error:null};
  }catch(error){
    const message=String(error&&error.message||error);
    if(error&&error.name==='EvalError'&&/content security|unsafe-eval/i.test(message))return {status:'unsupported',error:message};
    return {status:'error',error:message};
  }
}

self.onmessage=async function(event){
  const data=event&&event.data||{};
  const id=data.id;
  try{
    const buffer=data.buffer;
    if(!(buffer instanceof ArrayBuffer))throw new Error('verify_buffer_missing');
    const sha=await gitBlobSha(buffer);
    const expected=String(data.expectedSha||'').toLowerCase()||null;
    const hashOk=!expected||sha===expected;
    const syntax=data.checkSyntax?syntaxCheck(buffer,data.path):{status:'skipped',error:null};
    self.postMessage({id,ok:hashOk&&syntax.status!=='error',sha,expectedSha:expected,hashOk,syntaxStatus:syntax.status,syntaxError:syntax.error,path:data.path||null,bytes:buffer.byteLength});
  }catch(error){
    self.postMessage({id,ok:false,error:String(error&&error.message||error),path:data.path||null});
  }
};
