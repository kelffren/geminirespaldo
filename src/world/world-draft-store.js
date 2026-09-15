/* KELO-INDEX
 * area: WORLD EDIT
 * keys: DRAFT STORE LOCAL STORAGE MIGRATION OFFLINE ONLINE READY
 * hace: encapsula toda persistencia local del sistema Draft/Revision; ningún editor conoce la clave de storage
 * online: RemoteWorldEditAuthority sustituye este store; el contrato de KELO_WORLD_EDIT no cambia
 */
(function(){
'use strict';
if(window.KELO_WORLD_DRAFT_STORE)return;

const VERSION='world-draft-store-v1.0.0';
const SCHEMA=1;
const STORAGE='kelo_world_edit_authority_v1';
const LEGACY_WORLD_BUILDER_STORAGE='kelo_world_builder_state_v1';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(raw&&raw.schema===SCHEMA&&raw.worldId&&raw.revisions&&raw.drafts)return clone(raw);
  }catch(e){}
  return null;
}
function save(state){
  if(!state||state.schema!==SCHEMA)throw new Error('WORLD_EDIT_STORE_INVALID_STATE');
  localStorage.setItem(STORAGE,JSON.stringify(state));
  return true;
}
function clear(){localStorage.removeItem(STORAGE);}
function readLegacyWorldBuilder(){
  try{
    const raw=JSON.parse(localStorage.getItem(LEGACY_WORLD_BUILDER_STORAGE)||'null');
    if(!raw||!raw.cells||!raw.collisions)return null;
    return {
      cells:clone(raw.cells||{}),
      collisions:clone(raw.collisions||{}),
      legacyRevision:Number(raw.revision)||0,
      legacyUpdatedAt:Number(raw.updatedAt)||0
    };
  }catch(e){return null;}
}

window.KELO_WORLD_DRAFT_STORE=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  load,
  save,
  clear,
  readLegacyWorldBuilder
});
window.KELO_WORLD_DRAFT_STORE_AUDIT=Object.freeze({
  version:VERSION,
  storageEncapsulated:true,
  legacyMigrationReadOnly:true,
  uiKnowsStorageKey:false,
  remoteReplaceable:true
});
})();
