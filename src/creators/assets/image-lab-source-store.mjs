/* KELO-INDEX
 * area: CREATORS / IMAGE LAB / SOURCE STORE
 * owner: Kelo Creator Assets local binary authoring persistence
 * keys: IMAGE LAB ORIGINAL IMMUTABLE BLOB INDEXEDDB PROJECT MANIFEST LOCAL STORE
 * purpose: persist one immutable original Blob per sourceId plus lightweight project manifests
 * public-api: createImageLabSourceStore
 * state-owned: local Image Lab source blobs and project manifests only
 * online: replace this adapter with creator-private asset revision storage without changing project/converter APIs
 * do-not: overwrite an existing sourceId, publish assets, store runtime state or become the generic CreatorProject repository
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const timeout=value=>Math.max(300,Number(value)||1500);

export function createImageLabSourceStore({indexedDBFactory=globalThis.indexedDB,dbName='kelo-image-lab-v1',openTimeoutMs=1500,transactionTimeoutMs=1800}={}){
  const memorySources=new Map(),memoryProjects=new Map();let dbPromise=null;
  function open(){
    if(!indexedDBFactory)return Promise.resolve(null);if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{let request=null,settled=false,timer=null;const finish=db=>{if(settled){try{db?.close?.();}catch{}return;}settled=true;if(timer)clearTimeout(timer);resolve(db||null);};
      try{request=indexedDBFactory.open(dbName,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources',{keyPath:'sourceId'});if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'projectId'});};request.onsuccess=()=>finish(request.result);request.onerror=()=>finish(null);request.onblocked=()=>finish(null);timer=setTimeout(()=>finish(null),timeout(openTimeoutMs));}catch{finish(null);}
    });return dbPromise;
  }
  async function get(store,key){
    const db=await open();if(!db)return null;return new Promise(resolve=>{let done=false,timer=null,tx=null;const finish=value=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(value??null);};try{tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>finish(req.result||null);req.onerror=()=>finish(null);tx.onabort=()=>finish(null);timer=setTimeout(()=>{try{tx.abort();}catch{}finish(null);},timeout(transactionTimeoutMs));}catch{finish(null);}});
  }
  async function put(store,value){
    const db=await open();if(!db)return false;return new Promise(resolve=>{let done=false,timer=null,tx=null;const finish=value=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(!!value);};try{tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>finish(true);tx.onerror=()=>finish(false);tx.onabort=()=>finish(false);timer=setTimeout(()=>{try{tx.abort();}catch{}finish(false);},timeout(transactionTimeoutMs));}catch{finish(false);}});
  }
  async function remove(store,key){const db=await open();if(!db)return false;return new Promise(resolve=>{let done=false,timer=null,tx=null;const finish=value=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(!!value);};try{tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>finish(true);tx.onerror=()=>finish(false);tx.onabort=()=>finish(false);timer=setTimeout(()=>{try{tx.abort();}catch{}finish(false);},timeout(transactionTimeoutMs));}catch{finish(false);}});}
  async function all(store){const db=await open();if(!db)return [];return new Promise(resolve=>{let done=false,timer=null,tx=null;const finish=value=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(Array.isArray(value)?value:[]);};try{tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>finish(req.result||[]);req.onerror=()=>finish([]);tx.onabort=()=>finish([]);timer=setTimeout(()=>{try{tx.abort();}catch{}finish([]);},timeout(transactionTimeoutMs));}catch{finish([]);}});}

  async function saveOriginal(sourceId,blob,metadata={}){
    const key=String(sourceId||'').trim();if(!key)throw new Error('IMAGE_LAB_SOURCE_ID_REQUIRED');if(!(blob instanceof Blob))throw new Error('IMAGE_LAB_SOURCE_BLOB_REQUIRED');
    const mem=memorySources.get(key);if(mem)throw new Error(`IMAGE_LAB_SOURCE_IMMUTABLE:${key}`);const existing=await get('sources',key);if(existing)throw new Error(`IMAGE_LAB_SOURCE_IMMUTABLE:${key}`);
    const row={sourceId:key,blob,metadata:copy(metadata),createdAt:new Date().toISOString(),immutable:true};memorySources.set(key,row);const saved=await put('sources',row);return copy({...row,blob:saved?undefined:blob,persisted:saved});
  }
  async function loadOriginal(sourceId){const key=String(sourceId||'').trim();const local=memorySources.get(key);if(local)return local;const row=await get('sources',key);if(row)memorySources.set(key,row);return row||null;}
  async function saveProject(project){
    if(!project?.projectId||project.schema!=='kelo-image-lab-project-v1')throw new Error('IMAGE_LAB_PROJECT_INVALID');const row={projectId:project.projectId,sourceId:project.source.sourceId,manifest:copy(project),updatedAt:new Date().toISOString()};memoryProjects.set(row.projectId,row);await put('projects',row);return copy(row.manifest);
  }
  async function loadProject(projectId){const key=String(projectId||'').trim(),local=memoryProjects.get(key);if(local)return copy(local.manifest);const row=await get('projects',key);if(row){memoryProjects.set(key,row);return copy(row.manifest);}return null;}
  async function listProjects(){const rows=await all('projects'),merged=new Map(rows.map(row=>[row.projectId,row]));for(const [key,row] of memoryProjects)merged.set(key,row);return [...merged.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).map(row=>copy(row.manifest));}
  async function deleteProject(projectId,{deleteOriginal=false}={}){const key=String(projectId||'').trim(),project=await loadProject(key);memoryProjects.delete(key);await remove('projects',key);if(deleteOriginal&&project?.source?.sourceId){memorySources.delete(project.source.sourceId);await remove('sources',project.source.sourceId);}return true;}
  async function close(){const db=await open();try{db?.close?.();}catch{}dbPromise=null;}
  return Object.freeze({version:'kelo-image-lab-source-store-v1',saveOriginal,loadOriginal,saveProject,loadProject,listProjects,deleteProject,close});
}
