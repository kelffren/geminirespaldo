/* KELO-INDEX
 * area: CREATORS / DEFINITION SESSION
 * owner: shared definition-authoring session for data-driven Creator workspaces
 * purpose: CRUD/import/undo/redo/checkpoint reutilizando Studio history + store sin forzar WorldDocument
 * public-api: createDefinitionWorkspaceSession()
 * consumes: Studio createHistoryManager + createStudioStore
 * state-owned: draft document only; runtime registries remain read-only consumers
 * extension-points: validate/normalize hooks supplied by workspace
 * online: local draft/recovery only; publish authority remains replaceable
 * do-not: no mutate runtime catalog as editing source of truth; no separate undo implementation per workspace
 */
import { createHistoryManager } from '../../studio/core/history-manager.mjs';
import { createStudioStore } from '../../studio/storage/indexeddb-studio-store.mjs';
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
export function createDefinitionWorkspaceSession({id,type,rows=[],validate=()=>({ok:true,errors:[]}),normalize=v=>copy(v),store=null,historyBudgetBytes=4*1024*1024}={}){
  if(!id||!type)throw new Error('CREATOR_DEFINITION_SESSION_ID_TYPE_REQUIRED');
  const history=createHistoryManager({budgetBytes:historyBudgetBytes}),storage=store||createStudioStore(),listeners=new Set();
  const doc={schemaVersion:1,id:String(id),type:String(type).toUpperCase(),revision:1,rows:new Map(),selectedId:null};
  for(const row of rows){const n=normalize(row);if(n?.id)doc.rows.set(String(n.id),copy(n));}
  function emit(reason){const snap=snapshot();for(const fn of [...listeners])try{fn({reason,snapshot:snap});}catch(e){console.error(e);}return snap;}
  function snapshot(){return{schemaVersion:doc.schemaVersion,id:doc.id,type:doc.type,revision:doc.revision,selectedId:doc.selectedId,rows:[...doc.rows.values()].map(copy)};}
  function get(id){const row=doc.rows.get(String(id));return row?copy(row):null;}
  function list(){return[...doc.rows.values()].map(copy);}
  function select(id){doc.selectedId=id&&doc.rows.has(String(id))?String(id):null;return emit('select');}
  async function commit(label,serialized,apply,revert){await apply();doc.revision++;history.push({type:'definition.command',label,serialized,undo:async()=>{await revert();doc.revision++;emit('undo:'+label);},redo:async()=>{await apply();doc.revision++;emit('redo:'+label);}});await storage.appendCommand(doc.id,{label,serialized,revision:doc.revision});emit(label);return snapshot();}
  async function upsert(raw,{label='upsert'}={}){const next=normalize(raw),check=validate(next);if(!next?.id)return{ok:false,errors:['ID_REQUIRED']};if(!check?.ok)return{ok:false,errors:check.errors||['INVALID']};const id=String(next.id),before=doc.rows.has(id)?copy(doc.rows.get(id)):null;await commit(label,{op:'upsert',id},async()=>{doc.rows.set(id,copy(next));doc.selectedId=id;},async()=>{if(before)doc.rows.set(id,copy(before));else doc.rows.delete(id);doc.selectedId=before?id:null;});return{ok:true,row:get(id)};}
  async function remove(id){id=String(id||'');const before=get(id);if(!before)return{ok:false,error:'NOT_FOUND'};await commit('remove',{op:'remove',id},async()=>{doc.rows.delete(id);if(doc.selectedId===id)doc.selectedId=null;},async()=>{doc.rows.set(id,copy(before));doc.selectedId=id;});return{ok:true,id};}
  async function importRows(incoming,{replace=false}={}){const normalized=[],errors=[];for(let i=0;i<(incoming||[]).length;i++){let row;try{row=normalize(incoming[i]);}catch(e){errors.push({index:i,error:e.message});continue;}const check=validate(row);if(!row?.id||!check?.ok){errors.push({index:i,id:row?.id||null,errors:check?.errors||['INVALID']});continue;}normalized.push(row);}if(errors.length)return{ok:false,errors,valid:normalized.length,total:(incoming||[]).length};const before=list(),beforeSelected=doc.selectedId;await commit('import',{op:'import',count:normalized.length,replace},async()=>{if(replace)doc.rows.clear();for(const row of normalized)doc.rows.set(String(row.id),copy(row));},async()=>{doc.rows.clear();for(const row of before)doc.rows.set(String(row.id),copy(row));doc.selectedId=beforeSelected;});return{ok:true,count:normalized.length};}
  async function undo(){const e=await history.undo();return e?{ok:true,label:e.label}: {ok:false,error:'EMPTY'};}
  async function redo(){const e=await history.redo();return e?{ok:true,label:e.label}: {ok:false,error:'EMPTY'};}
  async function save(){return storage.saveCheckpoint(doc.id,snapshot());}
  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  async function close(){await save();if(!store)await storage.close();listeners.clear();}
  return Object.freeze({version:'definition-session-v1.0.0',snapshot,get,list,select,upsert,remove,importRows,undo,redo,save,onChange,close,get selectedId(){return doc.selectedId;},get canUndo(){return history.canUndo;},get canRedo(){return history.canRedo;}});
}
