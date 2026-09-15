#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const srcRoot=path.join(root,'src');
const args=process.argv.slice(2);
const maxDepthArg=args.find(x=>x.startsWith('--depth='));
const maxDepth=Math.max(1,Math.min(6,Number(maxDepthArg?.split('=')[1]||3)));

function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())walk(p,out);
    else if(/\.(?:m?js)$/.test(ent.name))out.push(p);
  }
  return out;
}
function rel(p){return path.relative(root,p).replace(/\\/g,'/');}
function resolveImport(from,spec){
  if(!spec.startsWith('.'))return null;
  const base=path.resolve(path.dirname(from),spec.split(/[?#]/)[0]);
  for(const candidate of [base,`${base}.js`,`${base}.mjs`,path.join(base,'index.js'),path.join(base,'index.mjs')]){
    if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return path.normalize(candidate);
  }
  return null;
}
function importsOf(file){
  let text=''; try{text=fs.readFileSync(file,'utf8');}catch{return [];}
  const specs=[];
  const re=/(?:import\s+(?:[^'";]*?\sfrom\s*)?|import\s*\(|export\s+[^'";]*?\sfrom\s*)['"]([^'"]+)['"]/g;
  for(const m of text.matchAll(re))specs.push(m[1]);
  return specs.map(s=>resolveImport(file,s)).filter(Boolean);
}
function seedFiles(){
  const diffIndex=args.indexOf('--diff');
  if(diffIndex>=0){
    const base=args[diffIndex+1]||'HEAD~1',head=args[diffIndex+2]||'HEAD';
    return execFileSync('git',['diff','--name-only',base,head],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean).map(p=>path.join(root,p)).filter(p=>fs.existsSync(p));
  }
  return args.filter(a=>!a.startsWith('--')&&a!==String(maxDepth)).map(p=>path.resolve(root,p)).filter(p=>fs.existsSync(p));
}

const files=walk(srcRoot);
const reverse=new Map();
const forward=new Map();
for(const file of files){
  const deps=importsOf(file);
  forward.set(file,deps);
  for(const dep of deps){if(!reverse.has(dep))reverse.set(dep,new Set());reverse.get(dep).add(file);}
}
const seeds=seedFiles();
if(!seeds.length){console.error('Usage: npm run bug:impact -- <file...> [--depth=3] OR npm run bug:impact -- --diff <base> <head>');process.exit(1);}

const impacted=new Map();
const queue=seeds.map(s=>[path.normalize(s),0]);
for(const s of seeds)impacted.set(path.normalize(s),0);
while(queue.length){
  const [cur,depth]=queue.shift();
  if(depth>=maxDepth)continue;
  for(const parent of reverse.get(cur)||[]){
    if(!impacted.has(parent)||impacted.get(parent)>depth+1){impacted.set(parent,depth+1);queue.push([parent,depth+1]);}
  }
}

const registryDir=path.join(root,'bugs','registry');
const bugs=fs.existsSync(registryDir)?fs.readdirSync(registryDir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(registryDir,n),'utf8'))):[];
const impactedRel=new Set([...impacted.keys()].map(rel));
const related=[];
for(const bug of bugs){
  const hist=new Set([...(bug.suspected_files||[]),...(bug.fix?.files||[])]);
  for(const attempt of bug.attempt_history||[])for(const f of attempt.change?.files||[])hist.add(f);
  const hits=[...hist].filter(f=>impactedRel.has(f));
  if(hits.length)related.push({id:bug.id,status:bug.status,severity:bug.severity,hits});
}
const riskMap=JSON.parse(fs.readFileSync(path.join(root,'bugs','RISK_MAP.json'),'utf8'));
const tests=new Set();
const rules=[];
for(const rule of riskMap.rules||[]){
  const hits=[...impactedRel].filter(file=>(rule.patterns||[]).some(p=>file.toLowerCase().includes(String(p).toLowerCase())));
  if(hits.length){rules.push({id:rule.id,hits});for(const t of rule.tests||[])tests.add(t);}
}

console.log(`# BUG IMPACT — depth ${maxDepth}`);
console.log('Seeds:'); for(const s of seeds)console.log(`- ${rel(s)}`);
console.log(`\nReverse dependency blast radius: ${impacted.size-seeds.length} dependent modules`);
for(const [file,depth] of [...impacted.entries()].sort((a,b)=>a[1]-b[1]||rel(a[0]).localeCompare(rel(b[0])))){
  if(depth===0)continue;
  console.log(`- d${depth} ${rel(file)}`);
}
console.log('\nHistorical bugs intersecting blast radius:');
if(!related.length)console.log('- none found');
for(const b of related)console.log(`- ${b.id} [${b.status}/${b.severity}] ${b.hits.join(', ')}`);
console.log('\nRisk rules touched by blast radius:');
if(!rules.length)console.log('- none');
for(const r of rules)console.log(`- ${r.id}: ${r.hits.slice(0,8).join(', ')}${r.hits.length>8?' …':''}`);
console.log('\nRecommended verification:');
if(!tests.size)console.log('- npm test');
for(const t of tests)console.log(`- ${t}`);
