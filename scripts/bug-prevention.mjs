/* KELO-INDEX
 * area: QA / BUGS / PREVENTION
 * owner: Bug Intelligence prevention runner
 * purpose: use static risk rules + learned hotspots to choose and execute bounded preventive audits for a diff
 * public-api: CLI <base> <head> [--plan] [--strict-manual]
 * consumes: bugs/RISK_MAP.json, bugs/learning/STATE.json, package.json, git diff
 * state-owned: none
 * online: N/A
 * do-not: never execute arbitrary commands from learned state; only allowlisted npm audit scripts are runnable
 */

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {evolutionFingerprint} from '../src/creators/evolution/evolution-engine.mjs';

const root=process.cwd();
const args=process.argv.slice(2);
const planOnly=args.includes('--plan');
const strictManual=args.includes('--strict-manual');
const positional=args.filter(value=>!value.startsWith('--'));
const base=positional[0]||'HEAD~1';
const head=positional[1]||'HEAD';
const riskMap=JSON.parse(fs.readFileSync(path.join(root,'bugs','RISK_MAP.json'),'utf8'));
const statePath=path.join(root,'bugs','learning','STATE.json');
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):null;
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const unique=list=>[...new Set(list.filter(Boolean))];

function changedFiles(){
  try{return execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).split(/\r?\n/).map(value=>value.trim()).filter(Boolean);}
  catch(error){console.error(`BUG PREVENTION FAILED — cannot diff ${base}..${head}: ${error.message}`);process.exit(1);}
}
function ruleMatches(rule,file){return (rule.patterns||[]).some(pattern=>String(file).toLowerCase().includes(String(pattern).toLowerCase()));}
function parseRunnable(test){
  const text=String(test||'').trim();
  const match=text.match(/^npm run ([A-Za-z0-9:_-]+)$/);
  if(!match)return null;
  const script=match[1];
  if(!/^audit:/.test(script))return null;
  if(!pkg.scripts?.[script])return null;
  return {script,label:text};
}

const files=changedFiles();
const currentRiskFingerprint=evolutionFingerprint(riskMap);
const learningFresh=Boolean(state?.risk_map_fingerprint&&state.risk_map_fingerprint===currentRiskFingerprint);
const matchedRules=[];
const learnedHotspots=[];
const tests=[];

for(const rule of riskMap.rules||[]){
  const hits=files.filter(file=>ruleMatches(rule,file));
  if(!hits.length)continue;
  matchedRules.push({id:rule.id,hits,score:Number(rule.score)||0});
  tests.push(...(rule.tests||[]));
}
if(learningFresh){
  const byFile=new Map((state.hotspots||[]).map(row=>[row.file,row]));
  for(const file of files){const hotspot=byFile.get(file);if(!hotspot)continue;learnedHotspots.push(hotspot);tests.push(...(hotspot.recommended_tests||[]));}
}

const dedupedTests=unique(tests);
const runnable=[];
const manual=[];
for(const test of dedupedTests){const parsed=parseRunnable(test);if(parsed)runnable.push(parsed);else manual.push(test);}
const runnableUnique=[...new Map(runnable.map(row=>[row.script,row])).values()].slice(0,8);

console.log(`# BUG PREVENTION — ${base}..${head}`);
console.log(`Changed files: ${files.length}`);for(const file of files)console.log(`- ${file}`);
console.log(`Learning state: ${learningFresh?'fresh':'missing/stale; learned policy ignored'}`);
console.log('\nStatic risk rules:');
if(!matchedRules.length)console.log('- none');for(const row of matchedRules)console.log(`- ${row.id} score=${row.score}: ${row.hits.join(', ')}`);
console.log('\nLearned hotspots:');
if(!learnedHotspots.length)console.log('- none');for(const row of learnedHotspots)console.log(`- ${row.confidence} +${row.risk_bonus} ${row.file} evidence=${row.evidence_count} bugs=${(row.bug_ids||[]).join(',')||'-'}`);
console.log('\nAutomatic preventive audits:');
if(!runnableUnique.length)console.log('- none');for(const row of runnableUnique)console.log(`- npm run ${row.script}`);
console.log('\nManual/non-executable obligations:');
if(!manual.length)console.log('- none');for(const item of manual)console.log(`- ${item}`);

if(planOnly){console.log('\nPlan only: no audits executed.');process.exit(0);}
let failed=false;
for(const row of runnableUnique){
  console.log(`\n>>> PREVENTIVE AUDIT: npm run ${row.script}`);
  const result=spawnSync('npm',['run',row.script],{cwd:root,stdio:'inherit',shell:false});
  if(result.status!==0){failed=true;console.error(`Preventive audit failed: npm run ${row.script} (exit ${result.status})`);break;}
}
if(failed)process.exit(1);
if(strictManual&&manual.length){console.error(`BUG PREVENTION BLOCKED — ${manual.length} manual obligation(s) remain.`);process.exit(2);}
console.log(`\nBUG PREVENTION PASS — automatic=${runnableUnique.length}, manual=${manual.length}, learned_hotspots=${learnedHotspots.length}.`);
