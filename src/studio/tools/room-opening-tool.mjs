/* KELO-INDEX
 * area: STUDIO / QUICK BUILD ROOM OPENINGS
 * owns: semantic WALL -> DOOR/WINDOW replacement and opening -> WALL restoration for generated rooms
 * does-not-own: document mutation internals, CommandBus, authority, room planning or rendering
 * public-api: createRoomOpeningTool(), resolveRoomOpeningPieces()
 * online: persistent mutation goes through kernel.execute(entity.patch) -> CommandBus -> authority
 */

import { createPatchEntityCommand } from '../document/document-commands.mjs';

const TYPES=Object.freeze([
  Object.freeze({type:'door',label:'DOOR',glyph:'▯',keywords:['door','puerta','entry','entrance']}),
  Object.freeze({type:'window',label:'WINDOW',glyph:'▤',keywords:['window','ventana']})
]);
const norm=v=>String(v||'').trim().toLowerCase();
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));

function scorePrefab(prefab,piece){
  const text=`${norm(prefab?.id)} ${norm(prefab?.label)} ${norm(prefab?.category)}`;
  let score=0;
  for(const word of piece.keywords){
    if(norm(prefab?.id)===word)score+=14;
    if(norm(prefab?.label)===word)score+=12;
    if(text.includes(word))score+=4;
  }
  if(score>0&&(text.includes('building')||text.includes('structure')))score++;
  return score;
}

export function resolveRoomOpeningPieces({prefabs=[],overrides={}}={}){
  const out=[];
  for(const piece of TYPES){
    const forced=overrides?.[piece.type];
    if(forced){out.push({...piece,prefabId:String(forced),source:'override'});continue;}
    let best=null,bestScore=0;
    for(const prefab of prefabs||[]){const score=scorePrefab(prefab,piece);if(score>bestScore){best=prefab;bestScore=score;}}
    if(best)out.push({...piece,prefabId:String(best.id),source:'catalog'});
  }
  return out;
}

export function createRoomOpeningTool(kernel,{root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_ROOM_OPENING_KERNEL_REQUIRED');
  const document=root?.document;
  const pieces=resolveRoomOpeningPieces({prefabs:kernel.prefabs.list?.()||[],overrides:root?.KELO_QUICK_BUILD_CATALOG||{}});
  let destroyed=false,observer=null,unsubSelection=null,buttons=[],restoreButton=null;

  function selectedEntity(){
    const ids=kernel.selection.get();
    if(ids.length!==1)return null;
    const id=String(ids[0]);
    return kernel.spatial.get?.(id)?.data||kernel.document.entities.find(entity=>String(entity.id)===id)||null;
  }

  function selectedWall(){
    const row=selectedEntity(),piece=row?.components?.buildingPiece;
    if(!row||piece?.type!=='wall'||piece?.roomGenerated!==true||!piece?.roomId)return null;
    return row;
  }

  function selectedOpening(){
    const row=selectedEntity(),piece=row?.components?.buildingPiece;
    if(!row||piece?.roomGenerated!==true||piece?.openingGenerated!==true||!piece?.roomId||!piece?.wallPrefabId)return null;
    if(piece.type!=='door'&&piece.type!=='window')return null;
    return row;
  }

  function pieceFor(type){return pieces.find(piece=>piece.type===String(type))||null;}

  async function replaceSelected(type){
    const source=selectedWall(),piece=pieceFor(type);
    if(!source||!piece)return null;
    const original=copy(source.components?.buildingPiece||{});
    const nextBuildingPiece={
      ...original,
      type:piece.type,
      prefabId:piece.prefabId,
      openingGenerated:true,
      openingType:piece.type,
      replacesType:'wall',
      wallPrefabId:original.prefabId||source.prefabId||null,
      // Preserve the original wall endpoint contract so replacing a segment
      // does not break ROOM perimeter connectivity or future semantic edits.
      snapPoints:copy(original.snapPoints||[])
    };
    const patch={
      prefabId:piece.prefabId,
      bounds:copy(source.bounds),
      components:{...(copy(source.components)||{}),buildingPiece:nextBuildingPiece}
    };
    const command=createPatchEntityCommand(source.id,patch);
    command.label=`Replace wall with ${piece.label}`;
    const result=await kernel.execute(command);
    kernel.selection.set(source.id);
    syncUi();
    return result;
  }

  async function restoreSelected(){
    const source=selectedOpening();
    if(!source)return null;
    const original=copy(source.components?.buildingPiece||{});
    const wallPrefabId=String(original.wallPrefabId||'');
    if(!wallPrefabId)return null;
    const nextBuildingPiece={...original,type:'wall',prefabId:wallPrefabId};
    delete nextBuildingPiece.openingGenerated;
    delete nextBuildingPiece.openingType;
    delete nextBuildingPiece.replacesType;
    delete nextBuildingPiece.wallPrefabId;
    const patch={
      prefabId:wallPrefabId,
      bounds:copy(source.bounds),
      components:{...(copy(source.components)||{}),buildingPiece:nextBuildingPiece}
    };
    const command=createPatchEntityCommand(source.id,patch);
    command.label='Restore room wall';
    const result=await kernel.execute(command);
    kernel.selection.set(source.id);
    syncUi();
    return result;
  }

  function syncUi(){
    const wall=selectedWall(),opening=selectedOpening();
    for(const button of buttons){
      const available=!!wall&&!!pieceFor(button.dataset.roomOpening);
      button.disabled=!available;
      button.setAttribute('aria-disabled',available?'false':'true');
      button.title=available?`Replace selected room wall with ${button.dataset.roomOpening}`:'Select one generated ROOM wall';
    }
    if(restoreButton){
      const available=!!opening;
      restoreButton.disabled=!available;
      restoreButton.setAttribute('aria-disabled',available?'false':'true');
      restoreButton.title=available?'Restore selected opening to its original ROOM wall':'Select one generated ROOM door/window';
    }
  }

  function ensureUi(){
    if(destroyed||!document)return;
    const palette=document.querySelector?.('.ks-qb-palette');
    if(!palette)return;
    if(buttons.some(button=>button?.isConnected)&&restoreButton?.isConnected){syncUi();return;}
    for(const button of buttons)button?.remove?.();
    restoreButton?.remove?.();
    buttons=[];restoreButton=null;
    const cancel=palette.querySelector?.('[data-qb-cancel]');
    for(const piece of TYPES){
      const button=document.createElement('button');
      button.type='button';
      button.className='ks-qb-piece';
      button.dataset.roomOpening=piece.type;
      button.textContent=`${piece.glyph} ${piece.label}`;
      button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();void replaceSelected(piece.type).catch(error=>console.warn('[Kelo Studio] Room opening replace failed',error));});
      palette.insertBefore(button,cancel||null);
      buttons.push(button);
    }
    restoreButton=document.createElement('button');
    restoreButton.type='button';
    restoreButton.className='ks-qb-piece';
    restoreButton.dataset.roomOpeningRestore='wall';
    restoreButton.textContent='↶ WALL';
    restoreButton.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();void restoreSelected().catch(error=>console.warn('[Kelo Studio] Room opening restore failed',error));});
    palette.insertBefore(restoreButton,cancel||null);
    syncUi();
  }

  function destroy(){
    if(destroyed)return;
    destroyed=true;
    observer?.disconnect?.();
    unsubSelection?.();
    for(const button of buttons)button?.remove?.();
    restoreButton?.remove?.();
    buttons=[];restoreButton=null;
  }

  unsubSelection=kernel.selection.onChange(()=>syncUi());
  if(document?.documentElement&&root?.MutationObserver){
    observer=new root.MutationObserver(()=>ensureUi());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  ensureUi();

  return Object.freeze({
    id:'roomOpening',
    version:'studio-room-opening-v1.1.0-restore-wall',
    pieces:pieces.map(copy),
    replaceSelected,
    restoreSelected,
    canReplace:()=>!!selectedWall(),
    canRestore:()=>!!selectedOpening(),
    destroy
  });
}
