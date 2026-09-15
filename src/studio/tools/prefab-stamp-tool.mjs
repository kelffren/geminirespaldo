/* KELO-INDEX
 * area: STUDIO / PREFAB STAMP TOOL
 * owns: local preview and batch placement of creator prefab clusters
 * does-not-own: prefab persistence, authority or asset rendering
 * public-api: createPrefabStampTool()
 * online: cluster commit is one local History action; child placements mirror through authority
 */

import { createPlaceEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
function entityId(){const u=globalThis.crypto?.randomUUID?.();return `entity:${u||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;}

export function createPrefabStampTool(kernel){
  if(!kernel)throw new Error('STUDIO_PREFAB_STAMP_KERNEL_REQUIRED');
  const definitions=new Map();let preview=null;
  function register(def){if(!def?.id||!Array.isArray(def.children)||!def.children.length)throw new Error('STUDIO_CREATOR_PREFAB_INVALID');definitions.set(String(def.id),copy(def));return get(def.id);}
  function unregister(id){definitions.delete(String(id));if(preview?.prefabId===String(id))preview=null;}
  function get(id){const row=definitions.get(String(id));return row?copy(row):null;}
  function list(){return [...definitions.values()].map(copy);}
  function start(id){const def=definitions.get(String(id));if(!def)throw new Error(`STUDIO_CREATOR_PREFAB_UNKNOWN:${id}`);preview={prefabId:String(id),x:0,y:0,w:Math.max(1,Number(def.bounds?.w)||32),h:Math.max(1,Number(def.bounds?.h)||32)};return getPreview();}
  function move(x,y,{snap=32}={}){if(!preview)return null;const s=Math.max(1,Number(snap)||1);preview.x=Math.round((Number(x)||0)/s)*s;preview.y=Math.round((Number(y)||0)/s)*s;return getPreview();}
  function cancel(){preview=null;}
  async function commit(){
    if(!preview)throw new Error('STUDIO_CREATOR_PREFAB_NOT_ACTIVE');const def=definitions.get(preview.prefabId);if(!def)throw new Error('STUDIO_CREATOR_PREFAB_UNKNOWN');
    const rows=def.children.map(child=>({id:entityId(),prefabId:String(child.prefabId),transform:{x:preview.x+(Number(child.dx)||0),y:preview.y+(Number(child.dy)||0),rotation:Number(child.rotation)||0},bounds:copy(child.bounds||{w:32,h:32}),components:copy(child.components||{})}));
    const command=createCompositeCommand(rows.map(row=>createPlaceEntityCommand(row)),{type:'prefab.stamp',label:`Place ${def.label||def.id} · ${rows.length} objects`});
    await kernel.execute(command);kernel.selection.set(rows.map(row=>row.id));const placed=rows.map(copy);preview=null;return placed;
  }
  function getPreview(){return preview?{...preview}:null;}
  return Object.freeze({id:'prefabStamp',register,unregister,get,list,start,move,cancel,commit,getPreview});
}
