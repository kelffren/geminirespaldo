(function(){
'use strict';
const original=window.KeloStones;
if(!original||typeof original.migrateState!=='function')return;
const VERSION='stone-backpack-bridge-v1.1.0';
const SWAP_GRANT_ID='swap-sword-inventory-20260907';
const SWAP_ABILITY_KEY='swap_sword';

function migrateStatePreservingEquipment(state){
  if(!state||typeof state!=='object')return original.migrateState(state);
  const inventory=Array.isArray(state.inventory)?state.inventory:[];
  const equipment=inventory.filter(function(item){return item&&item.kind==='equipment';});
  if(!equipment.length)return original.migrateState(state);
  state.inventory=inventory.filter(function(item){return !(item&&item.kind==='equipment');});
  let report;
  try{
    report=original.migrateState(state);
  }catch(error){
    state.inventory=inventory;
    throw error;
  }
  const stoneInventory=Array.isArray(state.inventory)?state.inventory:[];
  state.inventory=stoneInventory.concat(equipment);
  if(report&&typeof report==='object')report.preservedEquipment=equipment.length;
  return report;
}

function grantSwapSwordOnce(){
  if(typeof STATE==='undefined'||typeof original.createAbilityStone!=='function')return false;
  STATE.inventory=Array.isArray(STATE.inventory)?STATE.inventory:[];
  STATE.equipped=Array.isArray(STATE.equipped)?STATE.equipped:[];
  STATE.playerGrants=Array.isArray(STATE.playerGrants)?STATE.playerGrants:[];
  const ownsSwap=STATE.inventory.concat(STATE.equipped).some(function(item){
    return item&&(item.abilityKey===SWAP_ABILITY_KEY||item.typeId===SWAP_ABILITY_KEY);
  });
  const alreadyGranted=STATE.playerGrants.indexOf(SWAP_GRANT_ID)>=0;
  if(ownsSwap||alreadyGranted)return false;
  STATE.inventory.push(original.createAbilityStone(SWAP_ABILITY_KEY,'Common',{source:'kelo-player-grant',bound:false}));
  STATE.playerGrants.push(SWAP_GRANT_ID);
  if(typeof saveState==='function')saveState();
  return true;
}

window.KeloStones=Object.freeze(Object.assign({},original,{migrateState:migrateStatePreservingEquipment}));
const swapGranted=grantSwapSwordOnce();
window.KELO_STONE_BACKPACK_BRIDGE_AUDIT=Object.freeze({
  version:VERSION,
  mode:'preserve-known-equipment-plus-one-time-swap-grant-v1',
  preservedKind:'equipment',
  changesStoneSemantics:false,
  swapGrantId:SWAP_GRANT_ID,
  swapGranted:swapGranted
});
})();
