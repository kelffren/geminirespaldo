#!/usr/bin/env node
/* KELO-INDEX
 * area: CI / PERFORMANCE
 * owner: Boot Budget Audit
 * purpose: cuantificar bytes crudos y cantidad de recursos que index.html obliga a parsear antes de kelo:boot-ready
 * do-not: no intenta medir FPS real; eso pertenece a zero-boot-lab.html
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const INDEX=path.join(ROOT,'index.html');
const HARD_MAX=Number(process.env.KELO_BOOT_HARD_MAX_BYTES||524288); // 512 KiB regression guard
const TARGET=Number(process.env.KELO_BOOT_TARGET_BYTES||163840); // 160 KiB aspirational

function clean(ref){return String(ref||'').split('#')[0].split('?')[0].replace(/^\.\//,'');}
function refs(html){
  const out=[];
  for(const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi))out.push({type:'script',ref:m[1]});
  for(const m of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi))out.push({type:'style',ref:m[1]});
  for(const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi))out.push({type:'style',ref:m[1]});
  return out;
}
function inspect(items){
  return items.map(function(item){
    const rel=clean(item.ref);
    if(!rel||/^(?:https?:)?\/\//i.test(rel)||rel.startsWith('data:'))return {...item,path:rel,bytes:0,external:true,missing:false};
    const file=path.join(ROOT,rel);
    const exists=fs.existsSync(file);
    return {...item,path:rel,bytes:exists?fs.statSync(file).size:0,external:false,missing:!exists};
  });
}
function sum(rows){return rows.reduce((n,r)=>n+r.bytes,0);}
function kib(n){return (n/1024).toFixed(1)+' KiB';}

if(!fs.existsSync(INDEX)){console.error('BOOT_BUDGET_FAIL index.html missing');process.exit(1);}
const html=fs.readFileSync(INDEX,'utf8');
const marker='window.__keloBootReady=true';
const cut=html.indexOf(marker);
if(cut<0){console.error('BOOT_BUDGET_FAIL boot-ready marker missing');process.exit(1);}
const critical=inspect(refs(html.slice(0,cut)));
const after=inspect(refs(html.slice(cut)));
const criticalBytes=sum(critical),afterBytes=sum(after);
const missing=critical.concat(after).filter(r=>r.missing);
const criticalStyles=critical.filter(r=>r.type==='style');
const top=critical.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,15);

console.log('KELO BOOT BUDGET');
console.log('critical resources :',critical.length);
console.log('critical raw bytes :',kib(criticalBytes));
console.log('post-ready direct  :',after.length,'resources /',kib(afterBytes));
console.log('target             :',kib(TARGET));
console.log('hard max           :',kib(HARD_MAX));
console.log('critical styles    :',criticalStyles.length);
console.log('\nTOP CRITICAL FILES');
for(const row of top)console.log(String(kib(row.bytes)).padStart(10),row.type.padEnd(6),row.path);

let fail=false;
if(missing.length){fail=true;for(const row of missing)console.error('BOOT_BUDGET_MISSING',row.path);}
if(criticalStyles.length){console.warn('BOOT_BUDGET_WARN external stylesheet(s) still block first paint:',criticalStyles.map(r=>r.path).join(', '));}
if(criticalBytes>TARGET)console.warn('BOOT_BUDGET_TARGET_NOT_MET',kib(criticalBytes),'>',kib(TARGET));
if(criticalBytes>HARD_MAX){fail=true;console.error('BOOT_BUDGET_FAIL critical boot exceeds hard max');}
const report={criticalResources:critical.length,criticalRawBytes:criticalBytes,postReadyResources:after.length,postReadyRawBytes:afterBytes,targetBytes:TARGET,hardMaxBytes:HARD_MAX,criticalStyles:criticalStyles.length,topCritical:top.map(({type,path,bytes})=>({type,path,bytes}))};
fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'artifacts','boot-budget.json'),JSON.stringify(report,null,2)+'\n');
if(fail)process.exit(1);
