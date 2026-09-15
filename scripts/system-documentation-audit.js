/* KELO-INDEX
 * area: QA / DOCS
 * owner: FOUNDATION CI
 * keys: DOCUMENTATION SYSTEM CATALOG PLAYER GUIDE TECHNICAL DOC
 * purpose: valida que cada sistema registrado tenga documento técnico y, si es visible, sección pública en guide.html
 * public-api: CLI
 * consumes: docs/system-catalog.json
 * state-owned: ninguno
 * extension-points: ampliar invariantes de documentación
 * reuse: Foundation CI
 * legacy: N/A
 * do-not: no inferir gameplay desde nombres de archivos
 */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const catalogPath=path.join(root,'docs/system-catalog.json');
function fail(msg){console.error('SYSTEM_DOC_FAIL:',msg);process.exitCode=1;}
function exists(rel){return fs.existsSync(path.join(root,rel));}
if(!exists('docs/SYSTEM_DOCUMENTATION_STANDARD.md'))fail('missing documentation standard');
if(!fs.existsSync(catalogPath)){fail('missing docs/system-catalog.json');process.exit();}
let catalog=null;
try{catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));}catch(e){fail('catalog is not valid JSON: '+e.message);process.exit();}
const systems=Array.isArray(catalog.systems)?catalog.systems:[];
if(!systems.length)fail('catalog must register at least one system');
const ids=new Set();
const guide=exists('guide.html')?fs.readFileSync(path.join(root,'guide.html'),'utf8'):'';
systems.forEach(function(system,index){
  const label='systems['+index+']';
  if(!system||typeof system!=='object'){fail(label+' invalid');return;}
  ['id','owner','source','technicalDoc','status'].forEach(function(key){if(!String(system[key]||'').trim())fail(label+' missing '+key);});
  if(ids.has(system.id))fail('duplicate system id '+system.id);else ids.add(system.id);
  if(system.source&&!exists(system.source))fail(system.id+' source missing: '+system.source);
  if(system.technicalDoc&&!exists(system.technicalDoc))fail(system.id+' technical doc missing: '+system.technicalDoc);
  if(system.playerVisible===true){
    const anchor=String(system.playerGuideAnchor||'').trim();
    if(!anchor)fail(system.id+' playerVisible requires playerGuideAnchor');
    else if(!guide.includes('id="'+anchor+'"')&&!guide.includes("id='"+anchor+"'"))fail(system.id+' guide anchor missing: '+anchor);
  }
});
if(!process.exitCode)console.log('SYSTEM_DOC_OK:',systems.length,'registered systems validated');
