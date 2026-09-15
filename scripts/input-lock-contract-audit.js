/* KELO-INDEX
 * area: QA / INPUT
 * owner: FOUNDATION CI
 * keys: INPUT LOCK OWNER TOKEN LEGACY CONTRACT
 * purpose: valida que KeloInputLocks preserve claims independientes y que consumidores migrados no vuelvan al global legacy
 * public-api: CLI
 * consumes: src/core/input-lock-system.js + consumidores Foundation migrados
 * state-owned: ninguno
 * extension-points: añadir invariantes del contrato, no comportamiento UI
 * reuse: Foundation CI
 * legacy: verifica adapter KELO_MODAL_INPUT_LOCK solo dentro del owner core
 * do-not: no simular gameplay aquí
 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.resolve(__dirname,'../src/core/input-lock-system.js'),'utf8');
const events=[];
const context={console,Date,KeloEvents:{emit:(name,payload)=>events.push({name,payload})}};
vm.createContext(context);
vm.runInContext(source,context,{filename:'input-lock-system.js'});
const L=context.KeloInputLocks;
function assert(cond,msg){if(!cond){console.error('INPUT_LOCK_FAIL:',msg);process.exitCode=1;}}
assert(L&&typeof L.acquire==='function','API missing');
const inventory=L.acquire('inventory');
const emotes=L.acquire('emotes');
assert(L.isLocked(),'must lock after claims');
assert(L.snapshot().count===2,'two claims must coexist');
assert(L.has('inventory')&&L.has('emotes'),'owners must be independently tracked');
L.release(inventory);
assert(!L.has('inventory')&&L.has('emotes'),'releasing one owner must not clobber another');
context.KELO_MODAL_INPUT_LOCK='legacy-panel';
assert(L.has('legacy-panel')&&L.has('emotes'),'legacy claim must coexist with token claim');
context.KELO_MODAL_INPUT_LOCK=null;
assert(!L.has('legacy-panel')&&L.has('emotes'),'legacy null must release only legacy adapter claim');
L.release(emotes);
assert(!L.isLocked()&&L.snapshot().count===0,'all explicit claims must release cleanly');
assert(events.some(e=>e.name==='input-locks:changed'),'changes should publish through existing KeloEvents when available');

const backpack=fs.readFileSync(path.resolve(__dirname,'../src/ui/backpack-ui.js'),'utf8');
const pvpGuard=fs.readFileSync(path.resolve(__dirname,'../src/ui/pvp-social-touch-guard.js'),'utf8');
assert(!/\bKELO_MODAL_INPUT_LOCK\s*=/.test(backpack),'backpack must not write legacy modal lock');
assert(backpack.includes("locks.acquire('backpack-ui'"),'backpack must acquire a token from KeloInputLocks');
assert(backpack.includes('locks.release(inputLockToken)'),'backpack must release its own token');
assert(!/\bKELO_MODAL_INPUT_LOCK\s*=/.test(pvpGuard),'PvP social guard must not write legacy modal lock');
assert(pvpGuard.includes("locks.releaseOwner(owner)"),'PvP social guard must release known social lock owners via KeloInputLocks');

if(!process.exitCode)console.log('INPUT_LOCK_OK: owner/token/legacy adapter + migrated UI consumer contract passed');
