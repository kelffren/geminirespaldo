/* KELO-INDEX
 * area: CREATORS / LOCAL STATE ADAPTER
 * owner: local CreatorProject repository persistence primitive
 * owns: one opaque Creator repository state record for offline/prototype persistence
 * does-not-own: project semantics, workspace documents, Studio recovery, publish authority or networking
 * online: replace the repository/state adapter with remote infrastructure; workspaces remain unchanged
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
export function createIndexedDbCreatorStateAdapter({indexedDBFactory=globalThis.indexedDB,dbName='kelo-creators-v1',openTimeoutMs=1200,transactionTimeoutMs=1200}={}){
  let memory={projects:[],drafts:{}},dbPromise=null;
  const timeoutMs=value=>Math.max(250,Number(value)||1200);
  function open(){
    if(!indexedDBFactory)return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      let request=null,settled=false,timer=null;
      const finish=value=>{if(settled){try{value?.close?.();}catch{}return;}settled=true;if(timer)clearTimeout(timer);resolve(value||null);};
      try{
        request=indexedDBFactory.open(dbName,1);
        request.onupgradeneeded=()=>{try{const db=request.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});}catch{}};
        request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('state')){try{db.close();}catch{}finish(null);return;}finish(db);};
        request.onerror=()=>finish(null);
        request.onblocked=()=>finish(null);
        timer=setTimeout(()=>finish(null),timeoutMs(openTimeoutMs));
      }catch{finish(null);}
    });
    return dbPromise;
  }
  async function load(){
    const db=await open();if(!db)return copy(memory);
    try{
      return await new Promise(resolve=>{
        let settled=false,timer=null,tx=null;
        const finish=value=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);resolve(value);};
        try{
          tx=db.transaction('state','readonly');
          const request=tx.objectStore('state').get('repository');
          request.onsuccess=()=>{const state=request.result?.value||memory;memory=copy(state);finish(copy(memory));};
          request.onerror=()=>finish(copy(memory));
          tx.onabort=()=>finish(copy(memory));
          tx.onerror=()=>finish(copy(memory));
          timer=setTimeout(()=>{try{tx?.abort?.();}catch{}finish(copy(memory));},timeoutMs(transactionTimeoutMs));
        }catch{finish(copy(memory));}
      });
    }catch{return copy(memory);}
  }
  async function save(state){
    memory=copy(state||{projects:[],drafts:{}});const db=await open();if(!db)return copy(memory);
    try{
      await new Promise(resolve=>{
        let settled=false,timer=null,tx=null;
        const finish=()=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);resolve();};
        try{
          tx=db.transaction('state','readwrite');
          tx.objectStore('state').put({key:'repository',updatedAt:Date.now(),value:copy(memory)});
          tx.oncomplete=finish;
          tx.onerror=finish;
          tx.onabort=finish;
          timer=setTimeout(()=>{try{tx?.abort?.();}catch{}finish();},timeoutMs(transactionTimeoutMs));
        }catch{finish();}
      });
    }catch{}
    return copy(memory);
  }
  async function close(){const db=await open();db?.close?.();dbPromise=null;}
  return Object.freeze({version:'creator-indexeddb-state-v1.2.0-bounded-transactions',load,save,close});
}
