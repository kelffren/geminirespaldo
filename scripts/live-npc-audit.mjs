import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
let state=null;
for(let attempt=1;attempt<=24;attempt++){
  await page.goto(`${base}?npc-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(1200);
  state=await page.evaluate(()=>({npc:window.KELO_PLAZA_NPC_AUDIT||null,registry:window.KELO_TILE_REGISTRY||null}));
  if(state.npc?.ready&&state.npc?.assetLoaded&&!state.npc?.failed&&state.npc?.fallbackActive===false&&state.npc?.version==='plaza-npcs-v1'&&state.registry?.atlases?.plazaNpcs?.src?.includes('plaza-npcs-v1.svg')&&(!expectedRegistry||state.registry?.version===expectedRegistry))break;
  await page.waitForTimeout(8000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?npc-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
async function captureNpcFrame(name,playerX,playerY,cameraX,cameraY){
  const frame=await page.evaluate(({playerX,playerY,cameraX,cameraY})=>{
    const c=document.getElementById('game-canvas');
    if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
    localPlayer.x=playerX;localPlayer.y=playerY;camera.x=cameraX;camera.y=cameraY;camera.targetX=cameraX;camera.targetY=cameraY;render();
    const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let blue=0,forest=0,burgundy=0;
    for(let i=0;i<px.length;i+=4){
      const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<220)continue;
      if(r===62&&g===111&&b===153)blue++;
      if(r===31&&g===90&&b===73)forest++;
      if(r===127&&g===48&&b===66)burgundy++;
    }
    return{dataUrl:c.toDataURL('image/png'),blue,forest,burgundy,npc:window.KELO_PLAZA_NPC_AUDIT||null,registryVersion:window.KELO_TILE_REGISTRY?.version||null,npcCount:(window.keloNpcs||[]).length,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}};
  },{playerX,playerY,cameraX,cameraY});
  if(frame?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync(`artifacts/${name}`,Buffer.from(frame.dataUrl.split(',')[1],'base64'));
  return frame;
}
const trainingFrame=await captureNpcFrame('live-plaza-npcs.png',1580,1740,1510,1605);
const porteroFrame=await captureNpcFrame('live-plaza-portero.png',1320,1650,1320,1575);
const report={trainingFrame:trainingFrame?{blue:trainingFrame.blue,forest:trainingFrame.forest,burgundy:trainingFrame.burgundy,npc:trainingFrame.npc,registryVersion:trainingFrame.registryVersion,npcCount:trainingFrame.npcCount,canvas:trainingFrame.canvas}:null,porteroFrame:porteroFrame?{blue:porteroFrame.blue,forest:porteroFrame.forest,burgundy:porteroFrame.burgundy}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/npc-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!trainingFrame?.npc?.ready||!trainingFrame.npc.assetLoaded||trainingFrame.npc.failed||trainingFrame.npc.fallbackActive)throw new Error(`Authored NPC visual state invalid: ${JSON.stringify(trainingFrame?.npc)}`);
if(trainingFrame.npc.mode!=='registry-authored-npc-visual-v1'||trainingFrame.npc.labelMode!=='proximity-name-v1')throw new Error(`NPC registry mode invalid: ${JSON.stringify(trainingFrame.npc)}`);
if(trainingFrame.npcCount!==3)throw new Error(`Expected 3 Plaza NPCs, got ${trainingFrame.npcCount}`);
if(expectedRegistry&&trainingFrame.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${trainingFrame.registryVersion} !== ${expectedRegistry}`);
if(trainingFrame.forest<80||trainingFrame.burgundy<80)throw new Error(`Joyero/Maestro authored pixels not visible: ${JSON.stringify({forest:trainingFrame.forest,burgundy:trainingFrame.burgundy})}`);
if(!porteroFrame||porteroFrame.blue<80)throw new Error(`Portero authored pixels not visible: ${JSON.stringify({blue:porteroFrame?.blue||0})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);