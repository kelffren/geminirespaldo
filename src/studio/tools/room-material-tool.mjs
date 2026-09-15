/* KELO-INDEX
 * area: STUDIO / QUICK BUILD ROOM MATERIAL
 * owns: semantic whole-room WALL/FLOOR material swaps
 * does-not-own: room planning, opening visuals, document mutation internals, authority
 * public-api: createRoomMaterialTool(), resolveRoomMaterialCandidates()
 * online: persistent mutation goes through CompositeCommand -> kernel.execute -> CommandBus -> authority
 */

import { createCompositeCommand, createPatchEntityCommand } from '../document/document-commands.mjs';

const norm=v=>String(v||'').trim().toLowerCase();
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const DEFINITIONS=Object.freeze({
  wall:Object.freeze({label:'WALL STYLE',glyph:'▥',keywords:['wall','muro','pared','fence','barrier'],exclude:['door','window','puerta','ventana']}),
  floor:Object.freeze({label:'FLOOR STYLE',glyph:'▦',keywords:['floor','tile','ground','piso'],exclude:['wall','door','window']})
});

function scorePrefab(prefab,definition){
  const id=norm(prefab?.id),label=norm(prefab?.label),category=norm(prefab?.category),text=`${id} ${label} ${category}`;
  if(definition.exclude.some(word=>text.includes(word)))return 0;
  let score=0;
  for(const word of definition.keywords){
    if(id===word)score+=16;
    if(label===word)score+=14;
    if(id.includes(word))score+=8;
    if(label.includes(word))score+=7;
    if(category.includes(word))score+=3;
  }
  if(score>0&&(text.includes('building')||text.includes('structure')))score++;
  return score;
}

export function resolveRoomMaterialCandidates({prefabs=[]}={}){
  const result={wall:[],floor:[]};
  for(const [kind,definition] of Object.entries(DEFINITIONS)){
    const scored=[];
    for(const prefab of prefabs||[]){
      const score=scorePrefab(prefab,definition);
      if(score>0)scored.push({id:String(prefab.id),label:String(prefab.label||prefab.id),score});
    }
    scored.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
    result[kind]=scored;
  }
  return result;
}

export function createRoomMaterialTool(kernel,{root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_ROOM_MATERIAL_KERNEL_REQUIRED');
  const document=root?.document;
  const candidates=resolveRoomMaterialCandidates({prefabs:kernel.prefabs.list?.()||[]});
  let destroyed=false,observer=null,unsubSelection=null,buttons=[];

  function selectedRoomId(){
    const ids=kernel.selection.get();
    if(!ids.length)return null;
    for(const id of ids){
      const row=kernel.spatial.get?.(String(id))?.data||kernel.document.entities.find(entity=>String(entity.id)===String(id));
      const roomId=row?.components?.buildingPiece?.roomId;
      if(roomId)return String(roomId);
    }
    return null;
  }

  function roomRows(roomId=selectedRoomId()){
    if(!roomId)return[];
    return (kernel.document.entities||[]).filter(row=>String(row?.components?.buildingPiece?.roomId||'')===roomId);
  }

  function currentPrefab(kind,rows=roomRows()){
    const match=rows.find(row=>row?.components?.buildingPiece?.type===kind);
    return match?String(match.prefabId||match.components?.buildingPiece?.prefabId||''):'';
  }

  function candidateFor(kind,prefabId){
    return (candidates[kind]||[]).find(row=>row.id===String(prefabId))||null;
  }

  async function applyRoomMaterial(kind,prefabId){
    kind=String(kind||'');
    if(!DEFINITIONS[kind])return null;
    const roomId=selectedRoomId(),target=candidateFor(kind,prefabId);
    if(!roomId||!target)return null;
    const rows=roomRows(roomId),commands=[];
    for(const row of rows){
      const piece=row?.components?.buildingPiece||{};
      if(kind==='wall'){
        if(piece.type==='wall'){
          if(String(row.prefabId||'')===target.id&&String(piece.prefabId||'')===target.id)continue;
          commands.push(createPatchEntityCommand(row.id,{prefabId:target.id,bounds:copy(row.bounds),components:{...(copy(row.components)||{}),buildingPiece:{...copy(piece),prefabId:target.id}}}));
        }else if((piece.type==='door'||piece.type==='window')&&piece.openingGenerated===true){
          if(String(piece.wallPrefabId||'')===target.id)continue;
          commands.push(createPatchEntityCommand(row.id,{components:{...(copy(row.components)||{}),buildingPiece:{...copy(piece),wallPrefabId:target.id}}}));
        }
      }else if(kind==='floor'&&piece.type==='floor'){
        if(String(row.prefabId||'')===target.id&&String(piece.prefabId||'')===target.id)continue;
        commands.push(createPatchEntityCommand(row.id,{prefabId:target.id,bounds:copy(row.bounds),components:{...(copy(row.components)||{}),buildingPiece:{...copy(piece),prefabId:target.id}}}));
      }
    }
    if(!commands.length)return[];
    const command=createCompositeCommand(commands,{type:`room.material.${kind}`,label:`Change room ${kind} style`});
    const result=await kernel.execute(command);
    syncUi();
    return result;
  }

  async function cycleRoomMaterial(kind){
    kind=String(kind||'');
    const rows=roomRows(),list=candidates[kind]||[];
    if(!rows.length||list.length<2)return null;
    const current=currentPrefab(kind,rows),index=Math.max(-1,list.findIndex(row=>row.id===current));
    const next=list[(index+1)%list.length];
    return applyRoomMaterial(kind,next.id);
  }

  function syncUi(){
    const roomId=selectedRoomId(),rows=roomRows(roomId);
    for(const button of buttons){
      const kind=button.dataset.roomMaterial;
      const list=candidates[kind]||[],available=!!roomId&&list.length>1&&rows.some(row=>row?.components?.buildingPiece?.type===kind);
      button.disabled=!available;
      button.setAttribute('aria-disabled',available?'false':'true');
      const current=currentPrefab(kind,rows),currentRow=list.find(row=>row.id===current);
      button.textContent=`${DEFINITIONS[kind].glyph} ${DEFINITIONS[kind].label}${currentRow?` · ${currentRow.label}`:''}`;
      button.title=available?`Cycle ${kind} material for the selected ROOM`:`Select a ROOM with at least two ${kind} prefabs available`;
    }
  }

  function ensureUi(){
    if(destroyed||!document)return;
    const palette=document.querySelector?.('.ks-qb-palette');
    if(!palette)return;
    if(buttons.length===2&&buttons.every(button=>button?.isConnected)){syncUi();return;}
    for(const button of buttons)button?.remove?.();
    buttons=[];
    const cancel=palette.querySelector?.('[data-qb-cancel]');
    for(const kind of ['wall','floor']){
      const button=document.createElement('button');
      button.type='button';
      button.className='ks-qb-piece';
      button.dataset.roomMaterial=kind;
      button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();void cycleRoomMaterial(kind).catch(error=>console.warn('[Kelo Studio] Room material cycle failed',error));});
      palette.insertBefore(button,cancel||null);
      buttons.push(button);
    }
    syncUi();
  }

  function destroy(){
    if(destroyed)return;
    destroyed=true;
    observer?.disconnect?.();
    unsubSelection?.();
    for(const button of buttons)button?.remove?.();
    buttons=[];
  }

  unsubSelection=kernel.selection.onChange(()=>syncUi());
  if(document?.documentElement&&root?.MutationObserver){observer=new root.MutationObserver(()=>ensureUi());observer.observe(document.documentElement,{childList:true,subtree:true});}
  ensureUi();

  return Object.freeze({
    id:'roomMaterial',version:'studio-room-material-v1.0.0',
    candidates:{wall:candidates.wall.map(copy),floor:candidates.floor.map(copy)},
    applyRoomMaterial,cycleRoomMaterial,
    getSelectedRoomId:selectedRoomId,
    destroy
  });
}
