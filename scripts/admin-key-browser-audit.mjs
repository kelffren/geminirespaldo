import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});

async function openPage(path){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.addInitScript(()=>{
    localStorage.removeItem('kelo_admin_keys_v1');
    localStorage.removeItem('kelo_property_state_v1');
  });
  await page.goto(base+path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS&&window.KELO_PROPERTY_EDITOR&&window.KELO_PROPERTY_SYSTEM&&window.KeloBackpack,{timeout:20000});
  return{context,page,errors};
}

// Normal player: no key, no world creator tab.
const normal=await openPage('?adminAudit=normal');
const normalState=await normal.page.evaluate(()=>({
  playerId:window.KELO_PROPERTY_SYSTEM.playerId(),
  hasKey:window.KELO_ADMIN_KEYS.hasKey(),
  canEdit:window.KELO_ADMIN_KEYS.can('world.edit'),
  developer:window.KELO_PROPERTY_EDITOR.developer,
  tabsHidden:document.getElementById('pe-tabs').classList.contains('pe-hidden'),
  adminItems:window.KeloBackpack.getSlots().filter(s=>s?.item?.kind==='admin_key').length
}));
assert.equal(normalState.hasKey,false);
assert.equal(normalState.canEdit,false);
assert.equal(normalState.developer,false);
assert.equal(normalState.tabsHidden,true);
assert.equal(normalState.adminItems,0);
assert.deepEqual(normal.errors,[]);
await normal.context.close();

// Offline owner bootstrap: mapEditor creates a bound root Admin Key; editor reads the key, not URL directly.
const root=await openPage('?mapEditor=1&adminAudit=root');
await root.page.waitForFunction(()=>window.KELO_ADMIN_KEYS.hasKey()&&window.KELO_ADMIN_KEYS.can('world.edit'));
await root.page.waitForFunction(()=>window.KeloBackpack.getSlots().some(s=>s?.item?.kind==='admin_key'&&s?.item?.templateId==='admin-key'));
const rootState=await root.page.evaluate(async()=>{
  const A=window.KELO_ADMIN_KEYS,S=window.KELO_PROPERTY_SYSTEM;
  const me=S.playerId();
  const status=await A.request('admin-key:status',{actorId:me});
  const slot=window.KeloBackpack.getSlots().find(s=>s?.item?.kind==='admin_key'&&s?.item?.templateId==='admin-key');
  const item=slot?.item||null;
  const creator=await A.request('admin-key:issue',{actorId:me,ownerId:'creator-a',label:'Llave Admin · Builder'});
  const creatorCanEdit=A.can('world.edit','creator-a');
  const creatorCanPublish=A.can('world.publish','creator-a');
  const creatorCanIssue=A.can('admin.issue','creator-a');
  await A.request('admin-key:revoke',{actorId:me,keyId:creator.keyId});
  const creatorAfterRevoke=A.can('world.edit','creator-a');
  await window.KELO_PROPERTY_EDITOR.open('world');
  return{
    me,
    status,
    item:item?{id:item.id,kind:item.kind,bound:item.bound,scopes:item.scopes,name:item.name}:null,
    creator,
    creatorCanEdit,
    creatorCanPublish,
    creatorCanIssue,
    creatorAfterRevoke,
    developer:window.KELO_PROPERTY_EDITOR.developer,
    mode:window.KELO_PROPERTY_EDITOR.mode,
    tabsHidden:document.getElementById('pe-tabs').classList.contains('pe-hidden'),
    label:document.getElementById('pe-mode').textContent
  };
});
assert.equal(rootState.status.hasKey,true);
assert.ok(rootState.status.scopes.includes('world.edit'));
assert.ok(rootState.status.scopes.includes('world.publish'));
assert.ok(rootState.item);
assert.equal(rootState.item.kind,'admin_key');
assert.equal(rootState.item.bound,true);
assert.equal(rootState.developer,true);
assert.equal(rootState.tabsHidden,false);
assert.equal(rootState.mode,'world');
assert.equal(rootState.label,'LLAVE ADMIN · MUNDO');
assert.equal(rootState.creatorCanEdit,true);
assert.equal(rootState.creatorCanPublish,false);
assert.equal(rootState.creatorCanIssue,false);
assert.equal(rootState.creatorAfterRevoke,false);
assert.deepEqual(root.errors,[]);
await root.page.screenshot({path:'artifacts/admin-key-mobile-world-editor.png',fullPage:true});
await root.context.close();
await browser.close();

const report={ok:true,normal:normalState,root:{playerId:rootState.me,item:rootState.item,mode:rootState.mode,label:rootState.label,creatorScopes:rootState.creator.scopes,creatorRevoked:true}};
fs.writeFileSync('artifacts/admin-key-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));