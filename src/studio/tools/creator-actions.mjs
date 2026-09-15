/* KELO-INDEX
 * area: STUDIO / CREATOR ACTIONS
 * owns: reusable multi-selection productivity and clipboard actions
 * does-not-own: UI, authority transport, rendering
 * public-api: createCreatorActions(), smartDuplicateOffset(), findClearDuplicateOffset()
 * online: all persistent changes flow through CommandBus as one reversible batch
 */

import { createPlaceEntityCommand, createRemoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function newId() { const uuid = globalThis.crypto?.randomUUID?.(); return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`; }
function newRoomId() { const uuid = globalThis.crypto?.randomUUID?.(); return `room:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`; }
const scaleOf=value=>{const n=Number(value);return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1));};
const snapUp=(value,step)=>Math.max(step,Math.ceil(Math.max(1,Number(value)||1)/step)*step);
const normalizedRotation=value=>((Number(value)||0)%360+360)%360;
const entityRect=(row,tile)=>{
  const t=row?.transform||{},scale=scaleOf(t.scale),x=Number(t.x)||0,y=Number(t.y)||0;
  const w=Math.max(1,Number(row?.bounds?.w)||tile)*scale,h=Math.max(1,Number(row?.bounds?.h)||tile)*scale;
  const angle=normalizedRotation(t.rotation);if(!angle)return{x,y,x2:x+w,y2:y+h};
  const radians=angle*Math.PI/180,cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians));
  const rotatedW=cleanCoord(w*cos+h*sin),rotatedH=cleanCoord(w*sin+h*cos),cx=x+w/2,cy=y+h/2;
  return{x:cleanCoord(cx-rotatedW/2),y:cleanCoord(cy-rotatedH/2),x2:cleanCoord(cx+rotatedW/2),y2:cleanCoord(cy+rotatedH/2)};
};
const rectsOverlap=(a,b)=>a.x<b.x2&&a.x2>b.x&&a.y<b.y2&&a.y2>b.y;
const cleanCoord=value=>Math.abs(value)<1e-9?0:Math.round(value*1e6)/1e6;
const entityCenter=(row,tile)=>{const rect=entityRect(row,tile);return{x:cleanCoord((rect.x+rect.x2)/2),y:cleanCoord((rect.y+rect.y2)/2)};};
const selectionVisualPivot=(rows,tile)=>{
  const rects=rows.map(row=>entityRect(row,tile));
  return{x:cleanCoord((Math.min(...rects.map(r=>r.x))+Math.max(...rects.map(r=>r.x2)))/2),y:cleanCoord((Math.min(...rects.map(r=>r.y))+Math.max(...rects.map(r=>r.y2)))/2)};
};
function rotatePointAround(x,y,cx,cy,delta){
  const angle=normalizedRotation(delta),dx=(Number(x)||0)-cx,dy=(Number(y)||0)-cy;
  if(angle===90)return{x:cleanCoord(cx-dy),y:cleanCoord(cy+dx)};
  if(angle===180)return{x:cleanCoord(cx-dx),y:cleanCoord(cy-dy)};
  if(angle===270)return{x:cleanCoord(cx+dy),y:cleanCoord(cy-dx)};
  const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  return{x:cleanCoord(cx+dx*cos-dy*sin),y:cleanCoord(cy+dx*sin+dy*cos)};
}
function scalePointAround(x,y,cx,cy,factor){
  return{x:cleanCoord(cx+((Number(x)||0)-cx)*factor),y:cleanCoord(cy+((Number(y)||0)-cy)*factor)};
}
function isolateSemanticRooms(rows=[]){
  const roomMap=new Map();
  return rows.map(row=>{
    const piece=row?.components?.buildingPiece,sourceRoomId=piece?.roomId;
    if(!sourceRoomId)return row;
    let roomId=roomMap.get(String(sourceRoomId));
    if(!roomId){roomId=newRoomId();roomMap.set(String(sourceRoomId),roomId);}
    row.components={...(row.components||{}),buildingPiece:{...piece,roomId}};
    return row;
  });
}

export function smartDuplicateOffset(rows=[],tileSize=32){
  const tile=Math.max(1,Number(tileSize)||32),items=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(!items.length)return{dx:tile,dy:0};
  const extents=items.map(row=>entityRect(row,tile));
  const minX=Math.min(...extents.map(r=>r.x)),maxX=Math.max(...extents.map(r=>r.x2));
  return{dx:snapUp(maxX-minX,tile),dy:0};
}

export function findClearDuplicateOffset(rows=[],occupiedRows=[],tileSize=32,{maxRings=8}={}){
  const tile=Math.max(1,Number(tileSize)||32),items=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(!items.length)return{dx:tile,dy:0};
  const sourceRects=items.map(row=>entityRect(row,tile));
  const occupied=(Array.isArray(occupiedRows)?occupiedRows:[]).filter(Boolean).map(row=>entityRect(row,tile));
  const minX=Math.min(...sourceRects.map(r=>r.x)),maxX=Math.max(...sourceRects.map(r=>r.x2));
  const minY=Math.min(...sourceRects.map(r=>r.y)),maxY=Math.max(...sourceRects.map(r=>r.y2));
  const stepX=snapUp(maxX-minX,tile),stepY=snapUp(maxY-minY,tile);
  const clear=(dx,dy)=>sourceRects.every(rect=>{
    const shifted={x:rect.x+dx,y:rect.y+dy,x2:rect.x2+dx,y2:rect.y2+dy};
    return occupied.every(blocker=>!rectsOverlap(shifted,blocker));
  });
  const rings=Math.max(1,Math.min(32,Math.floor(Number(maxRings)||8)));
  for(let ring=1;ring<=rings;ring++){
    const candidates=[
      [stepX*ring,0],[0,stepY*ring],[-stepX*ring,0],[0,-stepY*ring],
      [stepX*ring,stepY*ring],[-stepX*ring,stepY*ring],[-stepX*ring,-stepY*ring],[stepX*ring,-stepY*ring]
    ];
    for(const [dx,dy] of candidates)if(clear(dx,dy))return{dx,dy};
  }
  return smartDuplicateOffset(items,tile);
}

export function createCreatorActions(kernel) {
  if (!kernel) throw new Error('STUDIO_CREATOR_ACTIONS_KERNEL_REQUIRED');
  let clipboard = [], pasteCount = 0;
  const selectedEntities = () => kernel.selection.get().map(id => kernel.document.entities.find(e => e.id === id)).filter(Boolean);
  const sanitizeClone = row => { const clone=copy(row); clone.id=newId(); if(clone.source)clone.source={...clone.source,authorityPlacementId:undefined}; return clone; };

  async function removeSelection() {
    const rows = selectedEntities(); if (!rows.length) return [];
    await kernel.execute(createCompositeCommand(rows.map(row => createRemoveEntityCommand(row.id)), { type: 'entity.batch.remove', label: `Delete ${rows.length} object${rows.length === 1 ? '' : 's'}` }));
    kernel.selection.clear(); return rows.map(row => row.id);
  }

  async function duplicateSelection({ offsetX, offsetY, armGrab = true } = {}) {
    const rows = selectedEntities(); if (!rows.length) return [];
    const tile = Math.max(1, Number(kernel.document.settings?.tileSize) || 32),smart=findClearDuplicateOffset(rows,kernel.document.entities,tile);
    const dx = Number.isFinite(Number(offsetX)) ? Number(offsetX) : smart.dx, dy = Number.isFinite(Number(offsetY)) ? Number(offsetY) : smart.dy;
    const clones = isolateSemanticRooms(rows.map(row => { const clone=sanitizeClone(row); clone.transform={...(clone.transform||{}),x:(Number(clone.transform?.x)||0)+dx,y:(Number(clone.transform?.y)||0)+dy}; return clone; }));
    await kernel.execute(createCompositeCommand(clones.map(row => createPlaceEntityCommand(row)), { type: 'entity.batch.duplicate', label: `Duplicate ${clones.length} object${clones.length === 1 ? '' : 's'}` }));
    const ids=clones.map(row => row.id);kernel.selection.set(ids);
    if(armGrab)kernel.tools.get?.('select')?.armGrab?.(ids);
    return clones;
  }

  function copySelection() {
    const rows=selectedEntities(); clipboard=rows.map(copy); pasteCount=0; return clipboard.length;
  }

  async function pasteClipboard({ offsetX, offsetY } = {}) {
    if(!clipboard.length)return [];
    const tile=Math.max(1,Number(kernel.document.settings?.tileSize)||32);pasteCount++;
    const hasX=Number.isFinite(Number(offsetX)),hasY=Number.isFinite(Number(offsetY));
    const smart=!hasX&&!hasY?findClearDuplicateOffset(clipboard,kernel.document.entities,tile):null;
    const dx=hasX?Number(offsetX):(smart?.dx??tile*pasteCount),dy=hasY?Number(offsetY):(smart?.dy??tile*pasteCount);
    const clones=isolateSemanticRooms(clipboard.map(row=>{const clone=sanitizeClone(row);clone.transform={...(clone.transform||{}),x:(Number(clone.transform?.x)||0)+dx,y:(Number(clone.transform?.y)||0)+dy};return clone;}));
    await kernel.execute(createCompositeCommand(clones.map(row=>createPlaceEntityCommand(row)),{type:'entity.batch.paste',label:`Paste ${clones.length} object${clones.length===1?'':'s'}`}));
    kernel.selection.set(clones.map(row=>row.id));return clones;
  }

  async function rotateSelection(delta = 90) {
    const rows = selectedEntities(); if (!rows.length) return [];
    const angle=Number(delta)||0,tile=Math.max(1,Number(kernel.document.settings?.tileSize)||32);
    const pivot=rows.length>1?selectionVisualPivot(rows,tile):null;
    const commands = rows.map(row => {
      const transform={...(row.transform||{}),rotation:normalizedRotation((Number(row.transform?.rotation)||0)+angle)};
      if(pivot){
        const center=entityCenter(row,tile),point=rotatePointAround(center.x,center.y,pivot.x,pivot.y,angle),scale=scaleOf(row.transform?.scale);
        const width=Math.max(1,Number(row?.bounds?.w)||tile)*scale,height=Math.max(1,Number(row?.bounds?.h)||tile)*scale;
        transform.x=cleanCoord(point.x-width/2);transform.y=cleanCoord(point.y-height/2);
      }
      return createPatchEntityCommand(row.id, { transform });
    });
    await kernel.execute(createCompositeCommand(commands, { type: 'entity.batch.rotate', label: `Rotate ${rows.length} object${rows.length === 1 ? '' : 's'}` }));
    return selectedEntities();
  }

  async function scaleSelection({delta=0,value=null}={}) {
    const rows=selectedEntities(); if(!rows.length)return [];
    const plans=rows.map(row=>{const current=scaleOf(row.transform?.scale),next=scaleOf(value==null?current+(Number(delta)||0):value);return{row,current,next};});
    const changed=plans.filter(plan=>plan.next!==plan.current);if(!changed.length)return rows;
    const tile=Math.max(1,Number(kernel.document.settings?.tileSize)||32);
    let cx=0,cy=0;
    if(rows.length>1){const pivot=selectionVisualPivot(rows,tile);cx=pivot.x;cy=pivot.y;}
    const commands=changed.map(({row,current,next})=>{
      const transform={...(row.transform||{}),scale:next};
      if(rows.length>1){
        const factor=next/current,center=entityCenter(row,tile),point=scalePointAround(center.x,center.y,cx,cy,factor);
        const width=Math.max(1,Number(row?.bounds?.w)||tile)*next,height=Math.max(1,Number(row?.bounds?.h)||tile)*next;
        transform.x=cleanCoord(point.x-width/2);transform.y=cleanCoord(point.y-height/2);
      }
      return createPatchEntityCommand(row.id,{transform});
    });
    await kernel.execute(createCompositeCommand(commands,{type:'entity.batch.scale',label:`Scale ${rows.length} object${rows.length===1?'':'s'}`}));
    return selectedEntities();
  }

  async function patchPrimary(patch) {
    const id = kernel.selection.get()[0]; if (!id) return null;
    await kernel.execute(createPatchEntityCommand(id, patch));
    return kernel.document.entities.find(e => e.id === id) || null;
  }

  return Object.freeze({ selectedEntities, removeSelection, duplicateSelection, copySelection, pasteClipboard, rotateSelection, scaleSelection, patchPrimary, get clipboardSize(){return clipboard.length;} });
}
