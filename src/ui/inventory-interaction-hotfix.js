(function(){
'use strict';
const VERSION='inventory-interaction-hotfix-v1.0.0';
let rememberedBagScroll=0;

function toast(message){if(typeof showToast==='function')showToast(message);}
function nextFrame(fn){requestAnimationFrame(function(){requestAnimationFrame(fn);});}
function bagScroll(){return document.querySelector('#kelo-bag .kb-scroll');}
function rememberBagScroll(){const scroller=bagScroll();if(scroller)rememberedBagScroll=scroller.scrollTop||0;}
function restoreBagScroll(){nextFrame(function(){const scroller=bagScroll();if(scroller)scroller.scrollTop=rememberedBagScroll;});}

// Backpack UI rebuilds its DOM after every tap. Preserve the user's position so
// selecting an item/action on mobile does not throw the panel back to the top.
document.addEventListener('click',function(event){
  const bag=event.target&&event.target.closest&&event.target.closest('#kelo-bag');
  if(!bag)return;
  rememberBagScroll();
  restoreBagScroll();
},true);

document.addEventListener('pointerdown',function(event){
  if(event.target&&event.target.closest&&event.target.closest('#kelo-bag'))rememberBagScroll();
},true);

function stoneIndexForButton(button){
  const inventory=document.getElementById('kelo-inventory');
  if(!inventory)return-1;
  const row=button.closest('#kelo-inventory > div');
  if(!row)return-1;
  return Array.prototype.indexOf.call(inventory.children,row);
}
function projected(){return window.KeloStones&&typeof STATE!=='undefined'?window.KeloStones.projectLoadout(STATE):null;}
function refreshStonePanel(scrollTop){
  if(window.KeloAbilities&&typeof window.KeloAbilities.syncFromWorldState==='function')window.KeloAbilities.syncFromWorldState(true);
  if(typeof window.renderActionBar==='function')window.renderActionBar();
  const panel=document.getElementById('kelo-builder');
  if(panel&&window.KeloAbilities&&typeof window.KeloAbilities.openStonePanel==='function'){
    panel.style.display='none';
    window.KeloAbilities.openStonePanel();
    nextFrame(function(){const current=document.getElementById('kelo-builder');if(current)current.scrollTop=scrollTop||0;});
  }
}
function equipIntoSlot(inventoryIndex,targetSlot){
  if(typeof STATE==='undefined'||!window.KeloStones)return false;
  inventoryIndex=Number(inventoryIndex);targetSlot=Number(targetSlot);
  if(!Number.isInteger(inventoryIndex)||inventoryIndex<0||inventoryIndex>=STATE.inventory.length)return false;
  const incoming=window.KeloStones.normalizeStone(STATE.inventory[inventoryIndex]);
  if(!incoming)return false;
  const def=window.KeloStones.abilityByKey(incoming.abilityKey);
  if(!def)return false;
  const isUltimate=def.slotType==='ultimate';
  if(isUltimate&&targetSlot!==4)return false;
  if(!isUltimate&&(targetSlot<0||targetSlot>3))return false;

  const slots=projected();
  if(!slots)return false;
  const outgoing=slots[targetSlot]?window.KeloStones.normalizeStone(slots[targetSlot]):null;
  slots[targetSlot]=incoming;

  STATE.inventory.splice(inventoryIndex,1);
  if(outgoing)STATE.inventory.push(outgoing);
  STATE.equipped=slots.filter(Boolean).map(function(stone){return window.KeloStones.normalizeStone(stone);});
  if(typeof saveState==='function')saveState();
  const panel=document.getElementById('kelo-builder');
  const scrollTop=panel?panel.scrollTop:0;
  refreshStonePanel(scrollTop);
  toast(incoming.name+(outgoing?' reemplazó '+outgoing.name:' equipada')+' en slot '+(targetSlot===4?'ULT':targetSlot+1));
  window.KELO_INVENTORY_HOTFIX_AUDIT.lastStoneEquip={abilityKey:incoming.abilityKey,targetSlot:targetSlot,replaced:!!outgoing};
  return true;
}
function removePicker(){document.querySelectorAll('.kelo-slot-picker').forEach(function(node){node.remove();});}
function showSlotPicker(button,index,def){
  removePicker();
  const row=button.closest('#kelo-inventory > div');
  if(!row)return;
  const picker=document.createElement('div');
  picker.className='kelo-slot-picker';
  picker.style.cssText='display:flex;gap:6px;align-items:center;margin-top:7px;padding:7px;border:1px solid rgba(231,197,106,.35);border-radius:9px;background:rgba(231,197,106,.06)';
  const label=document.createElement('span');
  label.textContent=def.slotType==='ultimate'?'Reemplazar ULT:':'Equipar en:';
  label.style.cssText='font-size:9px;color:#d7bd78;margin-right:2px';picker.appendChild(label);
  const targets=def.slotType==='ultimate'?[4]:[0,1,2,3];
  targets.forEach(function(slot){
    const b=document.createElement('button');b.type='button';b.textContent=slot===4?'ULT':String(slot+1);
    b.style.cssText='min-width:36px;min-height:36px;border-radius:8px;border:1px solid rgba(231,197,106,.5);background:#171c25;color:#f3d48b;font-weight:800';
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();equipIntoSlot(index,slot);});picker.appendChild(b);
  });
  row.appendChild(picker);
  nextFrame(function(){picker.scrollIntoView({block:'nearest',behavior:'smooth'});});
}

// The starter loadout fills all 4 normal slots. Intercept "Equipar" only when
// no compatible free slot exists and ask which slot should be replaced.
document.addEventListener('click',function(event){
  const button=event.target&&event.target.closest&&event.target.closest('#kelo-inventory [data-equip]');
  if(!button||typeof STATE==='undefined'||!window.KeloStones)return;
  const index=stoneIndexForButton(button);
  if(index<0||index>=STATE.inventory.length)return;
  const stone=window.KeloStones.normalizeStone(STATE.inventory[index]);
  if(!stone)return;
  const def=window.KeloStones.abilityByKey(stone.abilityKey);
  if(!def)return;
  const slots=projected();if(!slots)return;
  const full=def.slotType==='ultimate'?!!slots[4]:slots.slice(0,4).every(Boolean);
  if(!full)return; // existing equip flow handles free slots normally.
  event.preventDefault();event.stopImmediatePropagation();
  showSlotPicker(button,index,def);
  toast(def.slotType==='ultimate'?'Elige reemplazar tu Ultimate':'Elige qué slot 1–4 quieres reemplazar');
},true);

window.KeloInventoryHotfix=Object.freeze({version:VERSION,equipStoneIntoSlot:equipIntoSlot});
window.KELO_INVENTORY_HOTFIX_AUDIT={version:VERSION,bagScrollPreserved:true,fullLoadoutReplacementPicker:true,lastStoneEquip:null};
})();
