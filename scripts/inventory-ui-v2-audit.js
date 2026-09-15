/* KELO-INDEX
 * area: QA / INVENTORY UI
 * owner: Backpack CI
 * keys: BACKPACK INVENTORY INPUT LOCK OWNER FOUNDATION
 * purpose: valida el contrato visual de mochila y su integración con los owners centrales de input
 * public-api: CLI
 * consumes: backpack UI/CSS, KeloInputLocks, KeloInput, index.html
 * state-owned: ninguno
 * extension-points: invariantes de UI/ownership, no implementación gameplay
 * reuse: Backpack CI
 * legacy: aliases públicos de inventory pueden permanecer, pero la UI no escribe el modal-lock global
 * do-not: no exigir wrappers antiguos de processInput ni congelar patch versions anteriores
 */
'use strict';
const fs=require('fs');
const js=fs.readFileSync('src/ui/backpack-ui.js','utf8');
const css=fs.readFileSync('src/ui/backpack-fantasy-v1.css','utf8');
const locks=fs.readFileSync('src/core/input-lock-system.js','utf8');
const inputSystem=fs.readFileSync('src/core/input-system.js','utf8');
const retiredGate=fs.readFileSync('src/core/input-gate.js','utf8');
const compat=fs.readFileSync('src/ui/modal-input-lock.js','utf8');
const html=fs.readFileSync('index.html','utf8');
function ok(cond,msg){if(!cond)throw new Error(msg);}
const versionMatch=js.match(/const VERSION='(backpack-ui-v2\.\d+\.\d+)'/);
ok(!!versionMatch,'VERSION');
ok(js.includes("mainTabs:['equipment','appearance']"),'MAIN_TABS');
ok(js.includes('visibleEquipmentSlots:8'),'EQUIPMENT_SLOT_COUNT');
ok(js.includes('inventoryFilters:5'),'FILTER_COUNT');
ok(js.includes("helmet:{actual:'helmet'"),'HELMET_MAPPING');
ok(js.includes("cape:{actual:'accessory'"),'CAPE_ACCESSORY_MAPPING');
ok(js.includes("amulet:{actual:'necklace'"),'AMULET_NECKLACE_MAPPING');
ok(js.includes('window.KeloBackpack.getSlots()'),'REAL_BACKPACK_SOURCE');
ok(js.includes('window.KeloEquipment.equipItem'),'REAL_EQUIP_ACTION');
ok(js.includes('window.KeloEquipment.unequipItem'),'REAL_UNEQUIP_ACTION');
ok(js.includes("locks.acquire('backpack-ui'")&&js.includes('locks.release(inputLockToken)'),'INPUT_LOCK_TOKEN_LIFECYCLE');
ok(!/\bKELO_MODAL_INPUT_LOCK\s*=/.test(js),'NO_DIRECT_LEGACY_MODAL_WRITE');
ok(js.includes("inputLockOwner:'KeloInputLocks'")&&js.includes('inputLockTokenized:true'),'INPUT_LOCK_AUDIT');
ok(js.includes("window.openInventory=open")&&js.includes('window.closeInventory=close')&&js.includes('window.toggleInventory=toggle'),'PUBLIC_OPEN_CLOSE');
ok(js.includes("appearanceCosmeticOnly:true"),'COSMETIC_BOUNDARY');
ok(js.includes("marketDecoratorCompatible:true"),'MARKET_COMPAT');
ok(js.includes('BASE_PLAYER_STATS')&&js.includes('DEFAULT_CURRENCIES'),'DATA_DRIVEN_VIEWMODEL');
ok(css.includes('height:min(92dvh,880px)')&&css.includes('height:min(94dvh,900px)'),'DYNAMIC_VIEWPORT');
ok(css.includes('@media(max-width:760px)')&&css.includes('@media(max-width:379px)'),'MOBILE_BREAKPOINTS');
ok(css.includes('grid-template-columns:repeat(5,minmax(48px,1fr))'),'MOBILE_5_COLUMNS');
ok(css.includes('grid-template-columns:repeat(4,minmax(50px,1fr))'),'NARROW_4_COLUMNS');
ok(css.includes('min-height:48px'),'TOUCH_TARGET');
ok(locks.includes('root.KeloInputLocks=Object.freeze')&&locks.includes("Object.defineProperty(root,'KELO_MODAL_INPUT_LOCK'"),'INPUT_LOCK_OWNER');
ok(inputSystem.includes('root.KeloInput=Object.freeze')&&inputSystem.includes("owner: KeloInput"),'INPUT_PIPELINE_OWNER');
ok(retiredGate.includes('RETIRED into KeloInput')&&!/\bprocessInput\s*=\s*function\b/.test(retiredGate),'OLD_GATE_RETIRED');
ok(compat.includes('processInputWrapper:false')&&compat.includes("replacementOwner:'KeloInputLocks'"),'LEGACY_MODAL_GATE_RETIRED');
ok(html.includes('src/ui/backpack-fantasy-v1.css?v=1'),'CSS_LOADED');
ok(html.includes('src/core/input-lock-system.js?v=1'),'INPUT_LOCK_OWNER_LOADED');
ok(html.includes('src/core/input-system.js?v=1'),'INPUT_PIPELINE_LOADED');
ok(!html.includes('src/core/input-gate.js'),'OLD_GATE_NOT_LOADED');
ok(html.includes('src/ui/backpack-ui.js?v=4'),'UI_CACHE_BUST');
ok(!js.includes('action-bar-container')&&!css.includes('action-bar-container'),'NO_SKILL_BAR_UI');
console.log(JSON.stringify({ok:true,version:versionMatch[1],equipmentSlots:8,filters:5,mobileColumns:[4,5],movementLockOwner:'KeloInputLocks',inputOwner:'KeloInput',tokenizedInputLock:true,marketCompatible:true,noSkillBar:true}));
