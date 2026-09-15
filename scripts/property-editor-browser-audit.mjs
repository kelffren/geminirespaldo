import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});

async function boot(context,url){
  const page=await context.newPage();
  const errors=[],failed=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('pageerror',e=>errors.push(`PAGEERROR: ${e.stack||e.message}`));
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
  await page.goto(url,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.KELO_PROPERTY_SYSTEM&&window.KELO_PROPERTY_EDITOR&&window.KELO_PROPERTY_CATALOG,{timeout:15000});
  return{page,errors,failed};
}

const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={mobile:null,desktop:null,regularUser:null};

try{
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const m=await boot(mobileCtx,`${base}?mapEditor=1&audit=${Date.now()}`);
  const {page}=m;
  await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('world'));
  await page.waitForSelector('#kelo-property-editor',{state:'visible'});
  await page.waitForSelector('.pe-card');
  const layout=await page.locator('#kelo-property-editor').boundingBox();
  if(!layout||layout.x<0||layout.y<0||layout.x+layout.width>390.5||layout.y+layout.height>844.5)throw new Error(`Mobile editor overflows viewport: ${JSON.stringify(layout)}`);
  const audit=await page.evaluate(()=>({editor:window.KELO_PROPERTY_EDITOR_AUDIT,extras:window.KELO_PROPERTY_EDITOR_EXTRAS,system:window.KELO_PROPERTY_AUDIT,catalog:window.KELO_PROPERTY_CATALOG.list().length}));
  if(!audit.editor?.mobile||!audit.editor?.worldEditor||!audit.editor?.unitAware||!audit.editor?.nativeMove)throw new Error('Editor audit flags missing');
  if(!audit.extras?.thumbnails||!audit.extras?.moveWithoutConsumingUnits)throw new Error('Editor extras missing');
  if(audit.catalog<1)throw new Error('Property catalog empty');
  await page.waitForFunction(()=>document.querySelectorAll('.pe-thumb').length>0,{timeout:10000});
  await page.locator('.pe-card').first().click();
  const beforeWorld=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length);
  await page.mouse.click(195,150);
  await page.waitForFunction(n=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length>n,beforeWorld,{timeout:5000});
  const afterWorld=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length);
  if(afterWorld!==beforeWorld+1)throw new Error('World placement did not add exactly one object');
  await page.screenshot({path:'artifacts/property-editor-mobile-world.png',fullPage:false});

  await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('parcel'));
  await page.waitForTimeout(300);
  await page.waitForSelector('.pe-card');
  const parcelChoice=await page.evaluate(()=>{
    const pid=window.KELO_PROPERTY_EDITOR.parcelId,p=window.KELO_PROPERTY_SYSTEM.parcel(pid),list=window.KELO_PROPERTY_CATALOG.list();
    const index=list.findIndex(t=>t.width<=p.bounds.w-64&&t.height<=p.bounds.h-64);
    if(index<0)return null;
    const t=list[index],z=CONFIG.zoom||1;
    const wx=p.bounds.x+(p.bounds.w-t.width)/2,wy=p.bounds.y+(p.bounds.h-t.height)/2;
    return{pid,index,assetId:t.id,screen:{x:screenW/2+(wx-camera.x)*z,y:screenH/2+(wy-camera.y)*z},template:{w:t.width,h:t.height},bounds:p.bounds};
  });
  if(!parcelChoice)throw new Error('No catalog asset fits legacy parcel');
  await page.evaluate(async aid=>{await window.KELO_PROPERTY_SYSTEM.request('grantUnits',{ownerId:window.KELO_PROPERTY_SYSTEM.playerId(),assetId:aid,quantity:2,developer:true});},parcelChoice.assetId);
  await page.locator('.pe-card').nth(parcelChoice.index).click();
  const parcelId=parcelChoice.pid;
  const beforeParcel=await page.evaluate(pid=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).length,parcelId);
  if(parcelChoice.screen.y>=350||parcelChoice.screen.y<0)throw new Error(`Safe parcel click is covered by mobile editor: ${JSON.stringify(parcelChoice)}`);
  await page.mouse.click(parcelChoice.screen.x,parcelChoice.screen.y);
  await page.waitForFunction(({pid,n})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).length>n,{pid:parcelId,n:beforeParcel},{timeout:5000});
  const placement=await page.evaluate(pid=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).at(-1),parcelId);
  const unitsBeforeMove=await page.evaluate(aid=>({owned:window.KELO_PROPERTY_SYSTEM.getOwnedUnits(aid),available:window.KELO_PROPERTY_SYSTEM.getAvailableUnits(aid),deployed:window.KELO_PROPERTY_SYSTEM.getDeployedUnits(aid)}),parcelChoice.assetId);
  const selectPoint=await page.evaluate(({pid,id})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id);const b=window.KELO_PROPERTY_SYSTEM.placementBounds(r);const z=CONFIG.zoom||1;return{x:screenW/2+(b.x+b.w/2-camera.x)*z,y:screenH/2+(b.y+b.h/2-camera.y)*z};},{pid:parcelId,id:placement.placementId});
  if(selectPoint.y>=350||selectPoint.y<0)throw new Error(`Placement selection point covered by editor: ${JSON.stringify(selectPoint)}`);
  await page.mouse.click(selectPoint.x,selectPoint.y);
  await page.waitForFunction(id=>window.KELO_PROPERTY_EDITOR.selectedPlacementId===id,placement.placementId,{timeout:5000});
  if(await page.locator('#pe-move').isDisabled())throw new Error('Move button did not bind selected placement');
  await page.locator('#pe-move').click();
  if(await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.movingPlacementId)!==placement.placementId)throw new Error('Move mode did not arm selected placement');
  const moveTarget=await page.evaluate(({pid,id})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id);const t=window.KELO_PROPERTY_CATALOG.get(r.assetId),p=window.KELO_PROPERTY_SYSTEM.parcel(pid),z=CONFIG.zoom||1;let wx=Math.min(p.bounds.x+p.bounds.w-t.width-16,r.x+32),wy=r.y;if(wx===r.x)wx=Math.max(p.bounds.x+16,r.x-32);return{x:screenW/2+(wx-camera.x)*z,y:screenH/2+(wy-camera.y)*z,wx,wy};},{pid:parcelId,id:placement.placementId});
  const posBefore=await page.evaluate(({pid,id})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id);return{x:r.x,y:r.y};},{pid:parcelId,id:placement.placementId});
  if(moveTarget.y>=350||moveTarget.y<0)throw new Error(`Move target covered by editor: ${JSON.stringify(moveTarget)}`);
  await page.mouse.click(moveTarget.x,moveTarget.y);
  await page.waitForFunction(({pid,id,x,y})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(v=>v.placementId===id);return r&&(r.x!==x||r.y!==y);},{pid:parcelId,id:placement.placementId,x:posBefore.x,y:posBefore.y},{timeout:5000});
  const moved=await page.evaluate(({pid,id})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id),{pid:parcelId,id:placement.placementId});
  const unitsAfterMove=await page.evaluate(aid=>({owned:window.KELO_PROPERTY_SYSTEM.getOwnedUnits(aid),available:window.KELO_PROPERTY_SYSTEM.getAvailableUnits(aid),deployed:window.KELO_PROPERTY_SYSTEM.getDeployedUnits(aid)}),parcelChoice.assetId);
  if(JSON.stringify(unitsBeforeMove)!==JSON.stringify(unitsAfterMove))throw new Error(`Moving changed units: ${JSON.stringify({unitsBeforeMove,unitsAfterMove})}`);
  await page.locator('#pe-rotate').click();
  await page.waitForTimeout(120);
  const rotated=await page.evaluate(({pid,id})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id),{pid:parcelId,id:placement.placementId});
  if(rotated.rotation===moved.rotation)throw new Error('Rotate button did not change rotation');
  await page.screenshot({path:'artifacts/property-editor-mobile-parcel.png',fullPage:false});
  report.mobile={layout,audit,beforeWorld,afterWorld,parcelChoice,parcelId,unitsBeforeMove,unitsAfterMove,moved:{from:posBefore,to:{x:moved.x,y:moved.y}},rotation:rotated.rotation,errors:m.errors,failed:m.failed};
  if(m.errors.some(x=>/Kelo property|PAGEERROR/i.test(x)))throw new Error(`Property console errors: ${m.errors.join(' | ')}`);
  await mobileCtx.close();

  const desktopCtx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const d=await boot(desktopCtx,`${base}?mapEditor=1&desktop-audit=${Date.now()}`);
  await d.page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('world'));
  await d.page.waitForSelector('#kelo-property-editor',{state:'visible'});
  const desktopBox=await d.page.locator('#kelo-property-editor').boundingBox();
  if(!desktopBox||desktopBox.width>400||desktopBox.height>900||desktopBox.x<0||desktopBox.y<0)throw new Error(`Desktop editor layout invalid: ${JSON.stringify(desktopBox)}`);
  await d.page.waitForFunction(()=>document.querySelectorAll('.pe-thumb').length>0,{timeout:10000});
  await d.page.screenshot({path:'artifacts/property-editor-desktop.png',fullPage:false});
  report.desktop={layout:desktopBox,thumbs:await d.page.locator('.pe-thumb').count(),errors:d.errors,failed:d.failed};
  await desktopCtx.close();

  const userCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const u=await boot(userCtx,`${base}?user-audit=${Date.now()}`);
  await u.page.evaluate(()=>openSocialTool('properties'));
  await u.page.waitForSelector('#kelo-property-editor',{state:'visible'});
  const regular=await u.page.evaluate(()=>({mode:window.KELO_PROPERTY_EDITOR.mode,tabsHidden:document.getElementById('pe-tabs')?.classList.contains('pe-hidden'),fab:!!document.getElementById('pe-fab'),parcelId:window.KELO_PROPERTY_EDITOR.parcelId}));
  if(regular.mode!=='parcel'||!regular.tabsHidden||regular.fab)throw new Error(`Regular user exposed developer editor: ${JSON.stringify(regular)}`);
  await u.page.screenshot({path:'artifacts/property-editor-regular-user.png',fullPage:false});
  report.regularUser={...regular,errors:u.errors,failed:u.failed};
  await userCtx.close();

  fs.writeFileSync('artifacts/property-editor-browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();
}
