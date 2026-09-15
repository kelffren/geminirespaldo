(function(){
'use strict';

const VERSION='emote-loadout-v1.0.0';
const LOADOUT_TYPE='emote_loadout';
const MAX_SLOTS=4;

function save(){if(typeof saveState==='function')saveState();}
function ensure(){
  if(typeof STATE==='undefined')return null;
  if(!window.KeloContainers||typeof window.KeloContainers.ensure!=='function')return null;
  window.KeloContainers.ensure();
  return STATE.emoteLoadout||null;
}
function inventoryEmotes(){
  ensure();
  return Array.isArray(STATE.inventory)?STATE.inventory.filter(function(item){return item&&item.kind==='emote';}):[];
}
function equippedItems(){
  ensure();
  if(!STATE.emoteLoadout||!Array.isArray(STATE.emoteLoadout.items))return [];
  const order=new Map();
  (STATE.emoteLoadout.slots||[]).forEach(function(key,index){if(key)order.set(key,index);});
  return STATE.emoteLoadout.items.slice().sort(function(a,b){
    const ak=window.KeloContainers.keyForItem(a,0),bk=window.KeloContainers.keyForItem(b,0);
    return (order.get(ak)??999)-(order.get(bk)??999);
  });
}
function findInventory(itemId){return inventoryEmotes().find(function(item){return String(item.id||item.uid||'')===String(itemId);})||null;}
function findEquipped(itemId){return equippedItems().find(function(item){return String(item.id||item.uid||'')===String(itemId);})||null;}
function isEquipped(itemId){return !!findEquipped(itemId);}
function emitChanged(detail){
  try{window.dispatchEvent(new CustomEvent('kelo:emotes-changed',{detail:detail||{}}));}catch(e){}
}
function equip(itemId){
  const state=ensure();
  if(!state)return {ok:false,error:'EMOTE_SYSTEM_NOT_READY'};
  const item=findInventory(itemId);
  if(!item)return {ok:false,error:'EMOTE_NOT_IN_BACKPACK'};
  if(item.kind!=='emote')return {ok:false,error:'NOT_AN_EMOTE'};
  const index=STATE.inventory.indexOf(item);
  const key=window.KeloContainers.keyForItem(item,index);
  const out=window.KeloContainers.transferItem('backpack',LOADOUT_TYPE,key,1,{allowMerge:false});
  if(!out||!out.ok)return out||{ok:false,error:'TRANSFER_FAILED'};
  save();
  emitChanged({action:'equip',itemId:String(item.id||item.uid||''),result:out});
  return {ok:true,item,result:out};
}
function unequip(itemId){
  const state=ensure();
  if(!state)return {ok:false,error:'EMOTE_SYSTEM_NOT_READY'};
  const item=findEquipped(itemId);
  if(!item)return {ok:false,error:'EMOTE_NOT_EQUIPPED'};
  const index=STATE.emoteLoadout.items.indexOf(item);
  const key=window.KeloContainers.keyForItem(item,index);
  const out=window.KeloContainers.transferItem(LOADOUT_TYPE,'backpack',key,1,{allowMerge:false});
  if(!out||!out.ok)return out||{ok:false,error:'TRANSFER_FAILED'};
  save();
  emitChanged({action:'unequip',itemId:String(item.id||item.uid||''),result:out});
  return {ok:true,item,result:out};
}
function slots(){
  ensure();
  if(!STATE.emoteLoadout)return [];
  const items=new Map();
  STATE.emoteLoadout.items.forEach(function(item,index){items.set(window.KeloContainers.keyForItem(item,index),item);});
  return STATE.emoteLoadout.slots.map(function(key,index){return {index,key:key||null,item:key?items.get(key)||null:null};});
}

ensure();
window.KeloEmotes=Object.freeze({version:VERSION,maxSlots:MAX_SLOTS,ensure,getInventoryEmotes:inventoryEmotes,getEquipped:equippedItems,getSlots:slots,isEquipped,equip,unequip});
window.KELO_EMOTE_AUDIT=Object.freeze({
  version:VERSION,
  containerType:LOADOUT_TYPE,
  maxSlots:MAX_SLOTS,
  inventorySource:'STATE.inventory',
  equippedSource:'STATE.emoteLoadout.items',
  equipContract:'backpack-to-emote-loadout-transfer-v1',
  unequipContract:'emote-loadout-to-backpack-transfer-v1',
  identityRule:'one-item-one-container',
  noDuplicateInBackpackWhileEquipped:true,
  persistence:true,
  serverAuthoritative:false
});
})();
