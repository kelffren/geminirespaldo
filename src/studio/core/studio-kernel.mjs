/* KELO-INDEX
 * area: STUDIO / KERNEL
 * owns: document, commands, history, selection, registries, spatial index, dirty chunks and tools
 * does-not-own: UI, gameplay implementation, network transport or domain document schema
 * public-api: createStudioKernel()
 * online: adapter mirror is transactional; failed authority writes roll local state back
 * reuse: World is the default documentModel; other Creator workspaces inject only their document semantics
 */

import { createHistoryManager } from './history-manager.mjs';
import { createCommandBus } from './command-bus.mjs';
import { createInputRouter } from './input-router.mjs';
import { createToolRegistry } from './tool-registry.mjs';
import { createSelectionManager } from './selection-manager.mjs';
import { createComponentRegistry } from '../entities/component-registry.mjs';
import { createPrefabRegistry } from '../entities/prefab-registry.mjs';
import { createSpatialChunkIndex } from '../spatial/spatial-chunk-index.mjs';
import { createDirtyChunkManager } from '../spatial/dirty-chunk-manager.mjs';
import { normalizeWorldDocument } from '../document/world-document.mjs';

const entityScale=e=>{const n=Number(e?.transform?.scale);return Math.max(.1,Math.min(8,Number.isFinite(n)?n:1));};
const entityRect=e=>{const s=entityScale(e);return{x:Number(e.transform?.x)||0,y:Number(e.transform?.y)||0,w:Math.max(1,(Number(e.bounds?.w)||1)*s),h:Math.max(1,(Number(e.bounds?.h)||1)*s)};};
function collectEntityIds(command,out=new Set()){if(!command||typeof command!=='object')return out;if(String(command.type||'').startsWith('entity.')){if(command.id)out.add(String(command.id));if(command.entity?.id)out.add(String(command.entity.id));}if(Array.isArray(command.commands))for(const child of command.commands)collectEntityIds(child,out);return out;}
export function syncWorldSpatialCommand({command,document,spatial}){
  const rows=document.entities||[],ids=collectEntityIds(command);
  if(!ids.size)return;
  if(ids.size===1){
    const id=ids.values().next().value,order=rows.findIndex(row=>row.id===id),e=order>=0?rows[order]:null;
    if(e)spatial.upsert({id:e.id,category:'entity',rect:entityRect(e),data:e,order});else spatial.remove(id);
    return;
  }
  const pending=new Set(ids);
  for(let order=0;order<rows.length&&pending.size;order++){
    const e=rows[order],rawId=e?.id,id=rawId==null?'':String(rawId);
    if(!id||!pending.has(id))continue;
    spatial.upsert({id:rawId,category:'entity',rect:entityRect(e),data:e,order});
    pending.delete(id);
  }
  for(const id of pending)spatial.remove(id);
}
const worldDocumentModel=Object.freeze({
  id:'world',normalize:normalizeWorldDocument,chunkSize:document=>Number(document?.settings?.chunkSize)||512,
  rebuildSpatial({document,spatial}){const rows=document.entities||[];spatial.clear();for(let order=0;order<rows.length;order++){const e=rows[order];if(e?.id)spatial.upsert({id:e.id,category:'entity',rect:entityRect(e),data:e,order});}},
  syncCommand:syncWorldSpatialCommand
});
function resolveDocumentModel(model){if(!model)return worldDocumentModel;if(typeof model.normalize!=='function')throw new Error('STUDIO_DOCUMENT_MODEL_NORMALIZE_REQUIRED');return model;}

export function createStudioKernel({document,adapter=null,historyBudgetBytes,documentModel=null}={}){
  const model=resolveDocumentModel(documentModel),normalize=value=>model.normalize(value||{}),chunkSizeOf=value=>Math.max(1,Number(model.chunkSize?.(value))||512);
  let current=normalize(document||{}),spatial=createSpatialChunkIndex({chunkSize:chunkSizeOf(current)}),dirty=createDirtyChunkManager({chunkSize:chunkSizeOf(current)});
  const history=createHistoryManager({budgetBytes:historyBudgetBytes}),input=createInputRouter(),selection=createSelectionManager(),components=createComponentRegistry(),prefabs=createPrefabRegistry();let kernel=null;
  function rebuildSpatial(){spatial.clear();model.rebuildSpatial?.({document:current,spatial,kernel});}
  function syncCommand(command){model.syncCommand?.({command,document:current,spatial,kernel});}
  function markRects(rects,reason){for(const rect of rects||[])if(rect)dirty.markRect(rect,reason||'edit');}
  async function mirror(event){if(typeof adapter?.mirrorStudioEvent==='function')await adapter.mirrorStudioEvent(event,{document:current,kernel});}
  const commandBus=createCommandBus({history,onAfterExecute:async event=>{await mirror(event);const serialized=event.command||{};syncCommand(serialized);markRects(event.affectedRects,serialized.type||'edit');},onRollback:async event=>{rebuildSpatial();markRects(event.affectedRects,'rollback');}});
  const execute=command=>commandBus.execute(command,{document:current,kernel,adapter});
  async function undo(){const entry=await history.undo();if(!entry)return null;const event={type:'undo',command:entry.serialized,affectedRects:entry.affectedRects||[]};try{await mirror(event);}catch(error){await history.redo();rebuildSpatial();throw error;}rebuildSpatial();markRects(event.affectedRects,`undo:${entry.type||'command'}`);commandBus.emit(event);return entry;}
  async function redo(){const entry=await history.redo();if(!entry)return null;const event={type:'redo',command:entry.serialized,affectedRects:entry.affectedRects||[]};try{await mirror(event);}catch(error){await history.undo();rebuildSpatial();throw error;}rebuildSpatial();markRects(event.affectedRects,`redo:${entry.type||'command'}`);commandBus.emit(event);return entry;}
  function setDocument(next){current=normalize(next);spatial=createSpatialChunkIndex({chunkSize:chunkSizeOf(current)});dirty=createDirtyChunkManager({chunkSize:chunkSizeOf(current)});history.clear();selection.clear();rebuildSpatial();return current;}
  kernel={version:'studio-kernel-v1.6.0',domain:String(model.id||'custom'),execute,undo,redo,setDocument,get document(){return current;},get adapter(){return adapter;},get documentModel(){return model;},get history(){return history;},get commands(){return commandBus;},get input(){return input;},get selection(){return selection;},get components(){return components;},get prefabs(){return prefabs;},get spatial(){return spatial;},get dirty(){return dirty;}};
  kernel.tools=createToolRegistry({kernel});rebuildSpatial();return Object.freeze(kernel);
}
