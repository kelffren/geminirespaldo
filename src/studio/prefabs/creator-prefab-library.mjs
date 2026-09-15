/* KELO-INDEX
 * area: STUDIO / CREATOR PREFAB LIBRARY
 * owns: capture/list/delete of personal prefab clusters
 * does-not-own: world authority or placement rendering
 * public-api: createCreatorPrefabLibrary()
 * online: definitions are local creator productivity data; placed children remain server-authoritative
 */

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
function prefabId(){const u=globalThis.crypto?.randomUUID?.();return `creator-prefab:${u||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;}

export function createCreatorPrefabLibrary({kernel,store,tool,ownerId='local'}={}){
  if(!kernel||!store||!tool)throw new Error('STUDIO_CREATOR_PREFAB_LIBRARY_DEPS_REQUIRED');
  const rows=new Map();
  const assetRow=def=>({id:def.id,label:def.label,category:'My Prefabs',width:def.bounds.w,height:def.bounds.h,creatorPrefab:true,previewChildren:copy(def.children)});
  async function load(){for(const def of await store.listCreatorPrefabs(ownerId)){rows.set(def.id,copy(def));tool.register(def);}return list();}
  function list(){return [...rows.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label))).map(copy);}
  function assets(){return list().map(assetRow);}
  function get(id){const row=rows.get(String(id));return row?copy(row):null;}
  async function captureSelection({label}={}){
    const selected=kernel.selection.get().map(id=>kernel.document.entities.find(e=>e.id===id)).filter(Boolean);if(!selected.length)throw new Error('STUDIO_PREFAB_SELECTION_REQUIRED');if(selected.length>50)throw new Error('STUDIO_PREFAB_SELECTION_LIMIT:50');
    const minX=Math.min(...selected.map(e=>Number(e.transform?.x)||0)),minY=Math.min(...selected.map(e=>Number(e.transform?.y)||0));
    const maxX=Math.max(...selected.map(e=>(Number(e.transform?.x)||0)+Math.max(1,Number(e.bounds?.w)||32))),maxY=Math.max(...selected.map(e=>(Number(e.transform?.y)||0)+Math.max(1,Number(e.bounds?.h)||32)));
    const id=prefabId(),def={id,version:1,label:String(label||`Prefab ${rows.size+1}`),category:'My Prefabs',bounds:{w:maxX-minX,h:maxY-minY},children:selected.map(e=>({prefabId:e.prefabId,dx:(Number(e.transform?.x)||0)-minX,dy:(Number(e.transform?.y)||0)-minY,rotation:Number(e.transform?.rotation)||0,bounds:copy(e.bounds||{w:32,h:32}),components:copy(e.components||{})})),createdAt:Date.now(),updatedAt:Date.now()};
    rows.set(id,copy(def));tool.register(def);await store.saveCreatorPrefab(ownerId,def);return copy(def);
  }
  async function remove(id){id=String(id);rows.delete(id);tool.unregister(id);await store.deleteCreatorPrefab(ownerId,id);}
  return Object.freeze({load,list,assets,get,captureSelection,remove});
}
