/* KELO-INDEX
 * area: CREATORS / AVATAR / FRAME PROJECT STORE
 * owner: local draft persistence for 4x4 frame projects and immutable source blobs
 * keys: SPRITE INDEXEDDB AUTOSAVE DRAFT BLOB SAFARI WEBKIT
 * online: local authoring cache only; published content still uses Avatar Quick Import service
 */
const F=Object.freeze;
const DB_NAME='kelo-avatar-frame-projects-v1',DB_VERSION=1,PROJECTS='projects',SOURCES='sources';
const memoryByRoot=new WeakMap();
const clone=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
function memory(root){let state=memoryByRoot.get(root);if(!state){state={projects:new Map(),sources:new Map()};memoryByRoot.set(root,state);}return state;}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('FRAME_PROJECT_IDB_REQUEST_FAILED'));});}
function transactionDone(tx){return new Promise((resolve,reject)=>{let settled=false;const finish=fn=>event=>{if(settled)return;settled=true;fn(event);};tx.oncomplete=finish(()=>resolve());tx.onerror=finish(()=>reject(tx.error||new Error('FRAME_PROJECT_IDB_TX_FAILED')));tx.onabort=finish(()=>reject(tx.error||new Error('FRAME_PROJECT_IDB_TX_ABORTED')));});}
function openDatabase(root){
  if(!root?.indexedDB)return Promise.resolve(null);
  return new Promise((resolve,reject)=>{const req=root.indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'id'});if(!db.objectStoreNames.contains(SOURCES))db.createObjectStore(SOURCES,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('FRAME_PROJECT_IDB_OPEN_FAILED'));req.onblocked=()=>reject(new Error('FRAME_PROJECT_IDB_OPEN_BLOCKED'));});
}
function hydrateSource(root,value){
  if(!value||value.blob||!value.bytes)return value;
  const BlobCtor=root?.Blob||globalThis.Blob;
  if(typeof BlobCtor!=='function')return value;
  return {...value,blob:new BlobCtor([value.bytes],{type:value.blobType||value.metadata?.type||'application/octet-stream'})};
}
export function createAvatarFrameProjectStore({root=globalThis}={}){
  let dbPromise=null,closed=false,writeTail=Promise.resolve();
  async function database(){
    if(closed)throw new Error('FRAME_PROJECT_STORE_CLOSED');
    if(!root?.indexedDB)return null;
    if(!dbPromise){dbPromise=openDatabase(root).then(db=>{if(!db)return null;db.onversionchange=()=>{try{db.close();}catch{}dbPromise=null;};try{db.onclose=()=>{dbPromise=null;};}catch{}return db;}).catch(error=>{dbPromise=null;throw error;});}
    return dbPromise;
  }
  function serializeWrite(operation){const run=writeTail.then(operation,operation);writeTail=run.catch(()=>{});return run;}
  async function read(storeName,key=null,{all=false}={}){
    const db=await database();
    if(!db){const state=memory(root);if(storeName===PROJECTS)return all?[...state.projects.values()].map(clone):clone(state.projects.get(key)||null);return clone(state.sources.get(String(key))||null);}
    const tx=db.transaction(storeName,'readonly'),done=transactionDone(tx),store=tx.objectStore(storeName),req=all?store.getAll():store.get(key);const [value]=await Promise.all([request(req),done]);return value;
  }
  async function saveProject(project){if(!project?.id)throw new Error('FRAME_PROJECT_ID_REQUIRED');const value=clone(project);return serializeWrite(async()=>{const db=await database();if(!db){memory(root).projects.set(project.id,value);return clone(value);}const tx=db.transaction(PROJECTS,'readwrite'),done=transactionDone(tx),req=tx.objectStore(PROJECTS).put(value);await Promise.all([request(req),done]);return clone(value);});}
  async function loadProject(id){const value=await read(PROJECTS,id);return value?clone(value):null;}
  async function listProjects(){const values=await read(PROJECTS,null,{all:true});return (values||[]).map(clone).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));}
  async function deleteProject(id,{deleteSources=false}={}){const existing=deleteSources?await loadProject(id):null;return serializeWrite(async()=>{const db=await database();if(!db){const state=memory(root);state.projects.delete(id);if(deleteSources)for(const slot of existing?.slots||[])if(slot.sourceKey)state.sources.delete(slot.sourceKey);return;}const tx=db.transaction(deleteSources?[PROJECTS,SOURCES]:[PROJECTS],'readwrite'),done=transactionDone(tx),requests=[request(tx.objectStore(PROJECTS).delete(id))];if(deleteSources)for(const slot of existing?.slots||[])if(slot.sourceKey)requests.push(request(tx.objectStore(SOURCES).delete(slot.sourceKey)));await Promise.all([...requests,done]);});}
  async function putSource(key,blob,metadata={}){if(!key||!blob)throw new Error('FRAME_PROJECT_SOURCE_REQUIRED');const value={key:String(key),blob,metadata:{...metadata},updatedAt:Date.now()};return serializeWrite(async()=>{const db=await database();if(!db){memory(root).sources.set(value.key,value);return value;}let stored=value;if(typeof blob.arrayBuffer==='function'){const bytes=await blob.arrayBuffer();stored={key:value.key,bytes,blobType:String(blob.type||metadata.type||''),metadata:value.metadata,updatedAt:value.updatedAt};}const tx=db.transaction(SOURCES,'readwrite'),done=transactionDone(tx),req=tx.objectStore(SOURCES).put(stored);await Promise.all([request(req),done]);return value;});}
  async function getSource(key){const value=await read(SOURCES,String(key));return hydrateSource(root,value)||null;}
  async function removeSource(key){return serializeWrite(async()=>{const db=await database();if(!db){memory(root).sources.delete(String(key));return;}const tx=db.transaction(SOURCES,'readwrite'),done=transactionDone(tx),req=tx.objectStore(SOURCES).delete(String(key));await Promise.all([request(req),done]);});}
  async function close(){closed=true;await writeTail.catch(()=>{});if(dbPromise){try{const db=await dbPromise;db?.close?.();}catch{}dbPromise=null;}}
  return F({version:'avatar-frame-project-store-v1.2.0-webkit-arraybuffer',saveProject,loadProject,listProjects,deleteProject,putSource,getSource,removeSource,close});
}
