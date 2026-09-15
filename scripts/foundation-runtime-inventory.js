/* KELO-INDEX
 * area: QA / FOUNDATION
 * owner: FOUNDATION CI
 * keys: INVENTORY OWNERSHIP WRAPPERS GLOBALS TIMERS LOCKS STORAGE CAMERA VIEWPORT LIVE RUNTIME
 * purpose: inventaría patrones sensibles en repo completo y separa los archivos cargados directamente por index.html
 * public-api: CLI `node scripts/foundation-runtime-inventory.js`
 * consumes: archivos JS/HTML del repo + script src de index.html
 * state-owned: ninguno
 * extension-points: añadir patrones observables, no inferencias subjetivas
 * reuse: auditoría Foundation y revisión de PR
 * legacy: carga dinámica no declarada en index se reporta en repoTotal hasta que tenga manifest explícito
 * do-not: no falla CI por deuda histórica; los guards de regresión viven en audits contractuales
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name),rel=path.relative(ROOT,abs).replace(/\\/g,'/');
    if(ent.isDirectory()){
      if(ent.name==='.git'||ent.name==='node_modules'||rel.startsWith('docs/archive'))continue;
      walk(abs,out);
    }else if(/\.(js|mjs|html)$/.test(ent.name))out.push({abs,rel});
  }
  return out;
}
function directRuntimeFiles(){
  const set=new Set();
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const re=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while((m=re.exec(html))){
    const src=m[1].split('?')[0].replace(/^\.\//,'');
    if(!/^(https?:)?\/\//.test(src))set.add(src);
  }
  return set;
}
function stripNonCode(text){
  let out='',state='code',quote='',escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(state==='line'){
      if(c==='\n'){state='code';out+='\n';}else out+=' ';
      continue;
    }
    if(state==='block'){
      if(c==='*'&&n==='/'){out+='  ';i++;state='code';}
      else out+=c==='\n'?'\n':' ';
      continue;
    }
    if(state==='string'){
      if(escaped){escaped=false;out+=c==='\n'?'\n':' ';continue;}
      if(c==='\\'){escaped=true;out+=' ';continue;}
      if(c===quote){state='code';quote='';out+=' ';continue;}
      out+=c==='\n'?'\n':' ';
      continue;
    }
    if(c==='/'&&n==='/'){out+='  ';i++;state='line';continue;}
    if(c==='/'&&n==='*'){out+='  ';i++;state='block';continue;}
    if(c==='"'||c==="'"||c==='`'){state='string';quote=c;out+=' ';continue;}
    out+=c;
  }
  return out;
}
function globalAssignment(name){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:\\b(?:window|globalThis|root)\\.'+escaped+'\\s*=)|(?:^|[;{}]|\\))\\s*'+escaped+'\\s*=','gm');
}
const rules=[
  ['modalLockMention',/\bKELO_MODAL_INPUT_LOCK\b/g],
  ['modalLockWrite',globalAssignment('KELO_MODAL_INPUT_LOCK')],
  ['buildMode',/\bisBuildMode\b/g],
  ['processInputWrapper',globalAssignment('processInput')],
  ['movementWrapper',globalAssignment('updateMovement')],
  ['renderWrapper',globalAssignment('render')],
  ['avatarWrapper',globalAssignment('renderAvatar')],
  ['simulationWrapper',globalAssignment('updateSimulation')],
  ['socialToolWrite',globalAssignment('openSocialTool')],
  ['cameraTargetWrite',/\bcamera\.(?:targetX|targetY)\s*=/g],
  ['cameraPositionWrite',/\bcamera\.(?:x|y)\s*=/g],
  ['cameraZoomWrite',/\bCONFIG\.zoom\s*=/g],
  ['canvasSizeWrite',/\bcanvas\.(?:width|height)\s*=/g],
  ['resizeOverride',globalAssignment('resize')],
  ['cycleZoomOverride',globalAssignment('cycleZoom')],
  ['obstaclesPush',/\bobstacles\.push\s*\(/g],
  ['setInterval',/\bsetInterval\s*\(/g],
  ['mutationObserver',/\bnew\s+MutationObserver\b/g],
  ['localStorageWrite',/\blocalStorage\.setItem\s*\(/g]
];
const files=walk(ROOT),runtimeFiles=directRuntimeFiles();
const totals=Object.fromEntries(rules.map(r=>[r[0],0]));
const runtimeTotals=Object.fromEntries(rules.map(r=>[r[0],0]));
const byRule=Object.fromEntries(rules.map(r=>[r[0],[]]));
const runtimeByRule=Object.fromEntries(rules.map(r=>[r[0],[]]));
for(const file of files){
  const raw=fs.readFileSync(file.abs,'utf8');
  const text=stripNonCode(raw);
  const isRuntime=runtimeFiles.has(file.rel);
  for(const [name,re] of rules){
    re.lastIndex=0;let count=0;while(re.exec(text))count+=1;
    if(!count)continue;
    totals[name]+=count;byRule[name].push({file:file.rel,count});
    if(isRuntime){runtimeTotals[name]+=count;runtimeByRule[name].push({file:file.rel,count});}
  }
}
console.log('FOUNDATION_RUNTIME_INVENTORY files='+files.length+' directRuntimeScripts='+runtimeFiles.size);
for(const [name] of rules){
  console.log('\n['+name+'] repoTotal='+totals[name]+' liveDirect='+runtimeTotals[name]);
  runtimeByRule[name].sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)).forEach(x=>console.log('  LIVE '+x.count+'  '+x.file));
  const runtimeNames=new Set(runtimeByRule[name].map(x=>x.file));
  byRule[name].filter(x=>!runtimeNames.has(x.file)).sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)).forEach(x=>console.log('  REPO '+x.count+'  '+x.file));
}
console.log('\nFOUNDATION_RUNTIME_INVENTORY_JSON '+JSON.stringify({totals,runtimeTotals,byRule,runtimeByRule,directRuntimeFiles:[...runtimeFiles].sort()}));
