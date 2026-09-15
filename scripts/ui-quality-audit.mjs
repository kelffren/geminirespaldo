#!/usr/bin/env node
/* KELO-INDEX
 * area: TOOLING / UI QUALITY
 * purpose: scan every Kelo source module that constructs UI for hierarchy, accessibility and consistency drift
 * policy: evaluate effective shared overrides; report whole project; fail on any critical UI debt
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const SCAN_ROOTS=['src','index.html'];
const EXTENSIONS=new Set(['.js','.mjs','.css','.html']);
const SKIP_DIRS=new Set(['node_modules','vendor','generated']);
const SHARED_CSS_FILES=['src/ui/kelo-interface-system.css','src/ui/kelo-interface-compat.css'];
const MIN_COMFORTABLE_TARGET_PX=44;
const CRITICAL_TARGET_PX=32;

function walk(rel){
  const abs=path.join(ROOT,rel);
  if(!fs.existsSync(abs))return [];
  const stat=fs.statSync(abs);
  if(stat.isFile())return EXTENSIONS.has(path.extname(abs))?[rel]:[];
  return fs.readdirSync(abs,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isDirectory()&&SKIP_DIRS.has(entry.name))return [];
    return walk(path.join(rel,entry.name));
  });
}

function changedFiles(){
  try{
    const out=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return new Set(out.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
  }catch{return new Set();}
}

const isUiText=text=>/(<button|createElement\(['"]button|\.\w*(?:btn|button|tab|menu|card|panel)|role=['"]dialog|aria-label|position\s*:\s*fixed)/i.test(text);
const hexColors=text=>new Set(text.match(/#[0-9a-f]{3,8}\b/ig)||[]);
const normalizeSelector=s=>String(s||'').replace(/\s+/g,' ').replace(/\s*>\s*/g,'>').trim();
const splitSelectors=s=>String(s||'').split(',').map(normalizeSelector).filter(Boolean);

function cssBlocks(text){
  const blocks=[];
  const rx=/([^{}]+)\{([^{}]*)\}/g;let m;
  while((m=rx.exec(text)))blocks.push({selector:m[1].trim(),body:m[2]});
  return blocks;
}

function hasInteractiveFixedSurface(text){
  const passive=/pointer-events\s*:\s*none/i;
  const interactiveCue=/(pointer-events\s*:\s*(?:auto|all)|overflow(?:-y|-x)?\s*:\s*(?:auto|scroll)|display\s*:\s*(?:grid|flex))/i;
  const surfaceName=/(panel|modal|menu|dialog|sheet|drawer|dock|workspace|lab|overlay|card|profile)/i;
  for(const block of cssBlocks(text)){
    if(!/position\s*:\s*fixed/i.test(block.body)||passive.test(block.body))continue;
    if(interactiveCue.test(block.body)||surfaceName.test(block.selector))return true;
  }
  const inline=/(?:style\.cssText\s*(?:\+?=)\s*)['"`]([^'"`]*position\s*:\s*fixed[^'"`]*)['"`]/ig;
  let m;
  while((m=inline.exec(text))){
    if(!passive.test(m[1]))return true;
  }
  return false;
}

const sharedCss=SHARED_CSS_FILES.filter(file=>fs.existsSync(path.join(ROOT,file))).map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
const sharedBlocks=cssBlocks(sharedCss);

function selectorCovered(sharedSelector,sourceSelector){
  const shared=normalizeSelector(sharedSelector),source=normalizeSelector(sourceSelector);
  return shared===source||shared.endsWith(` ${source}`)||shared.endsWith(`>${source}`);
}

function maxSharedMetric(selector,property){
  let max=0;
  const prop=property.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const rx=new RegExp(`${prop}\\s*:[^;{}]*?(\\d+(?:\\.\\d+)?)px`,'ig');
  for(const block of sharedBlocks){
    const selectors=splitSelectors(block.selector);
    if(!selectors.some(sharedSelector=>selectorCovered(sharedSelector,selector)))continue;
    let m;while((m=rx.exec(block.body)))max=Math.max(max,Number(m[1])||0);
    rx.lastIndex=0;
  }
  return max;
}

function sharedFocusScopeFor(file,text){
  const ids=new Set([...text.matchAll(/#(kelo-[\w-]+)/g)].map(m=>`#${m[1]}`));
  if(file.startsWith('src/studio/'))ids.add('#kelo-studio-live');
  const known={
    'src/ui/account-auth-ui.js':'#kelo-account-auth',
    'src/ui/account-profile-18-ui.js':'#kelo-profile-18',
    'src/ui/commerce-ui.js':'#kelo-commerce-modal',
    'src/ui/luxe-shell.js':'#kelo-luxe'
  };
  if(known[file])ids.add(known[file]);
  for(const id of ids){
    const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(new RegExp(`${escaped}[^,{\\n]*:focus-visible`,'i').test(sharedCss))return id;
  }
  return null;
}

function auditFile(file,text){
  const warnings=[];
  const add=(code,severity,message)=>warnings.push({file,code,severity,message});

  if(/outline\s*:\s*none/i.test(text)&&!/:focus-visible/i.test(text)){
    const scope=sharedFocusScopeFor(file,text);
    if(!scope)add('FOCUS_REPLACEMENT_MISSING','critical','Uses outline:none without an effective shared :focus-visible replacement.');
  }

  const colors=hexColors(text);
  if(colors.size>28)add('PALETTE_SPRAWL','info',`Contains ${colors.size} unique hex colors; prefer shared interface tokens.`);

  const infinite=(text.match(/\binfinite\b/gi)||[]).length;
  if(infinite>2)add('MOTION_SPRAWL','warn',`Contains ${infinite} infinite animations; continuous motion should communicate active state only.`);

  const hasExitRoute=/\b(close|cerrar|back|volver|destroy|logout|signout|sign-out|hide|hidden|minimi[sz]|collaps|dismiss|exit|salir|cancel|remove)\b/i.test(text);
  if(hasInteractiveFixedSurface(text)&&!hasExitRoute)
    add('EXIT_ROUTE_UNCLEAR','warn','Interactive fixed UI surface has no obvious close/back/minimize route in the same module.');

  for(const block of cssBlocks(text)){
    const selectors=splitSelectors(block.selector);
    if(!selectors.some(selector=>/(button|\.\w*(?:btn|button|tab|menu-item|tool|card))/i.test(selector)))continue;

    const heights=[...block.body.matchAll(/(?:min-height|height)\s*:\s*(\d+(?:\.\d+)?)px/ig)].map(m=>Number(m[1]));
    const sizes=[...block.body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/ig)].map(m=>Number(m[1]));

    for(const selector of selectors){
      if(!/(button|\.\w*(?:btn|button|tab|menu-item|tool|card))/i.test(selector))continue;
      const sharedHeight=Math.max(maxSharedMetric(selector,'min-height'),maxSharedMetric(selector,'height'));
      const sharedFont=maxSharedMetric(selector,'font-size');
      const sourceHeight=heights.length?Math.max(...heights):0;
      const effectiveHeight=Math.max(sourceHeight,sharedHeight);
      const sourceTinyText=sizes.some(v=>v<9);

      if(sourceHeight&&effectiveHeight<CRITICAL_TARGET_PX)
        add('TINY_CONTROL_TARGET','critical',`${selector.slice(0,90)} has an effective declared control height below ${CRITICAL_TARGET_PX}px.`);
      else if(sourceHeight&&effectiveHeight<MIN_COMFORTABLE_TARGET_PX)
        add('SMALL_CONTROL_TARGET','warn',`${selector.slice(0,90)} has an effective declared control height below the ${MIN_COMFORTABLE_TARGET_PX}px interaction standard.`);

      if(sourceTinyText&&sharedFont<9)
        add('TINY_CONTROL_TEXT','warn',`${selector.slice(0,90)} has effective control text below 9px.`);

      if(/Georgia|Times New Roman/i.test(block.body)){
        const sharedUsesSystemFont=sharedBlocks.some(sharedBlock=>splitSelectors(sharedBlock.selector).some(sharedSelector=>selectorCovered(sharedSelector,selector))&&/font-family\s*:\s*var\(--kui-font\)/i.test(sharedBlock.body));
        if(!sharedUsesSystemFont)add('ORNAMENTAL_CONTROL_FONT','warn',`${selector.slice(0,90)} uses an ornamental serif font for a software control.`);
      }
    }
  }

  return warnings;
}

const files=[...new Set(SCAN_ROOTS.flatMap(walk))].sort();
const changed=changedFiles();
const warnings=[];
const auditedFiles=[];
for(const file of files){
  const text=fs.readFileSync(path.join(ROOT,file),'utf8');
  if(!isUiText(text))continue;
  auditedFiles.push(file);
  warnings.push(...auditFile(file,text));
}

const uiFiles=auditedFiles.length;
const weight={critical:8,warn:2,info:.5};
const debt=warnings.reduce((sum,w)=>sum+(weight[w.severity]||0),0);
const score=Math.max(0,Math.round(100-debt/Math.max(1,uiFiles)*2));
const counts=warnings.reduce((a,w)=>(a[w.severity]=(a[w.severity]||0)+1,a),{});
const globalCritical=warnings.filter(w=>w.severity==='critical');
const changedCritical=globalCritical.filter(w=>changed.has(w.file));

console.log('Kelo UI Quality Audit');
console.log(`Source files considered: ${files.length}`);
console.log(`UI-producing files audited: ${uiFiles}`);
console.log(`Interaction standard: ${MIN_COMFORTABLE_TARGET_PX}px minimum comfortable target`);
console.log(`Score: ${score}/100`);
console.log(`Warnings: ${warnings.length} (critical ${counts.critical||0}, warn ${counts.warn||0}, info ${counts.info||0})`);
if(changed.size)console.log(`Latest commit changed ${changed.size} file(s); critical UI regressions: ${changedCritical.length}`);

const severityRank={critical:0,warn:1,info:2};
const ordered=[...warnings].sort((a,b)=>(severityRank[a.severity]??9)-(severityRank[b.severity]??9)||a.file.localeCompare(b.file));
for(const w of ordered.slice(0,80))console.log(`[${w.severity.toUpperCase()}] ${w.code} ${w.file}: ${w.message}`);
if(ordered.length>80)console.log(`... ${ordered.length-80} additional warning(s) omitted from console output.`);

const contractFiles=['src/ui/kelo-interface-system.css','src/ui/kelo-interface-compat.css','src/ui/kelo-interface-runtime.js','docs/KELO_INTERFACE_STANDARD.md'];
const missing=contractFiles.filter(file=>!fs.existsSync(path.join(ROOT,file)));
if(missing.length){console.error(`Missing UI contract file(s): ${missing.join(', ')}`);process.exit(2);}

const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
if(!index.includes('src/ui/kelo-interface-system.css')){console.error('index.html does not load the shared Kelo Interface System.');process.exit(3);}
if(!index.includes('src/ui/kelo-interface-compat.css')){console.error('index.html does not load the Kelo Interface compatibility bridge.');process.exit(4);}
if(!index.includes('src/ui/kelo-interface-runtime.js')){console.error('index.html does not load the shared Kelo Interface Runtime.');process.exit(5);}

if(globalCritical.length){
  console.error(`\nCritical UI debt remains anywhere in the product (${globalCritical.length}). Fix before merging.`);
  process.exit(1);
}
