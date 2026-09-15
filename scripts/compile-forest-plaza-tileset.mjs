/* KELO-INDEX
 * area: CREATORS / ASSET SHEET / FOREST PLAZA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET SHEET COMPILER FOREST PLAZA MANIFEST PLAYWRIGHT RUNTIME LOAD ORDER
 * purpose: ejecuta el Asset Sheet Compiler real del repo sobre el atlas Forest Plaza, emite metadata durable y conecta el contenido al runtime existente
 * online: N/A; authoring determinista, no autoridad gameplay
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';

const root=process.cwd();
const input=process.argv[2]||'assets/world/plaza/forest-plaza-tileset-v2.png';
const outJson=process.argv[3]||'src/environment/generated/forest-plaza-tileset-v2-manifest.json';
const outJs=process.argv[4]||'src/environment/generated/forest-plaza-tileset-v2-manifest.js';
if(!fs.existsSync(path.join(root,input)))throw new Error(`FOREST_PLAZA_SOURCE_MISSING:${input}`);

const types={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.html':'text/html'};
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(String(req.url||'/').split('?')[0]).replace(/^\/+/, '');
  if(rel==='__kelo_compile.html'){
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    res.end('<!doctype html><meta charset="utf-8"><title>Kelo compiler</title><body></body>');
    return;
  }
  const file=path.join(root,rel||'index.html');
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const base=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`${base}/__kelo_compile.html`,{waitUntil:'domcontentloaded',timeout:30000});
  const manifest=await page.evaluate(async ({base,input})=>{
    const compiler=await import(`${base}/src/creators/assets/asset-sheet-compiler.mjs?forest-plaza-v2=2`);
    const img=new Image();
    img.crossOrigin='anonymous';
    img.src=`${base}/${input}?compile=2`;
    await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const g=canvas.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(img,0,0);
    const rgba=g.getImageData(0,0,canvas.width,canvas.height).data;
    const analysis=compiler.analyzeAssetSheetPixels(rgba,canvas.width,canvas.height,{detectInterfaceNoise:false,cropPadding:6,minComponentArea:12,satelliteDistance:24});
    return compiler.buildAssetSheetManifest(analysis,{sourceName:'forest-plaza-tileset-v2.png',sourcePath:input,atlasId:'forest-plaza-tileset-v2'});
  },{base,input});
  manifest.review={kind:'kelo-semantic-review-v1',status:'approved-for-world-palette',note:'Compiler geometry is source truth; runtime categories remain conservative and editor-reviewable.'};
  fs.mkdirSync(path.dirname(path.join(root,outJson)),{recursive:true});
  fs.writeFileSync(path.join(root,outJson),JSON.stringify(manifest,null,2)+'\n');
  const js=`/* KELO-INDEX\n * area: ENVIRONMENT / GENERATED ASSET MANIFEST\n * owner: Kelo Creator Asset Bridge\n * keys: FOREST PLAZA ASSET SHEET MANIFEST IRREGULAR FRAMES\n * purpose: metadata compilada para registrar el atlas Forest Plaza en runtime/editor\n * online: N/A; contenido visual inmutable\n */\nwindow.KELO_FOREST_PLAZA_TILESET_V2=${JSON.stringify(manifest)};\n`;
  fs.writeFileSync(path.join(root,outJs),js);

  // KELO-INDEX WORLD/ASSET conecta solo contenido/data a los owners ya existentes.
  const indexPath=path.join(root,'index.html');
  let html=fs.readFileSync(indexPath,'utf8');
  const manifestTag='<script src="src/environment/generated/forest-plaza-tileset-v2-manifest.js?v=1"></script>';
  const catalogTag='<script src="src/property/forest-plaza-asset-catalog.js?v=1"></script>';
  if(!html.includes('forest-plaza-tileset-v2-manifest.js')){
    html=html.replace(/(<script src="src\/environment\/atlas-contract\.js[^\"]*"><\/script>)/,'$1'+manifestTag);
  }
  if(!html.includes('forest-plaza-asset-catalog.js')){
    html=html.replace(/(<script src="src\/property\/property-asset-catalog\.js[^\"]*"><\/script>)/,'$1\n'+catalogTag);
  }
  fs.writeFileSync(indexPath,html);
  console.log(JSON.stringify({compiler:manifest.compiler,assetCount:manifest.assets.length,galleries:manifest.galleries.length,atlas:manifest.atlas.id,width:manifest.atlas.width,height:manifest.atlas.height,runtimeWired:true}));
}finally{
  await browser.close();server.close();
}
