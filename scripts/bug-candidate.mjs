#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprintBugText, bugSimilarity, sanitizeBugText } from './lib/bug-fingerprint.mjs';

const args=process.argv.slice(2);
const input=args.find(x=>!x.startsWith('--'));
const dryRun=args.includes('--dry-run');
const sourceArg=args.find(x=>x.startsWith('--source='));
const source=sourceArg?sourceArg.split('=').slice(1).join('='):'monitoring';
if(!input){console.error('Usage: npm run bug:candidate -- <log-file|-> [--source=monitoring] [--dry-run]');process.exit(1);}

const root=process.cwd();
const raw=input==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(input,'utf8');
const sanitized=sanitizeBugText(raw);
const {fingerprint,tokens}=fingerprintBugText(sanitized);
const registryDir=path.join(root,'bugs','registry');
const incomingDir=path.join(root,'bugs','incoming');
const bugs=fs.existsSync(registryDir)?fs.readdirSync(registryDir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(registryDir,n),'utf8'))):[];
const ranked=bugs.map(b=>({id:b.id,title:b.title,status:b.status,severity:b.severity,score:bugSimilarity(tokens,b)})).sort((a,b)=>b.score-a.score);
const best=ranked[0]||null;
let gitHead=null;
try{gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()||null;}catch{}

if(fs.existsSync(incomingDir)){
  for(const name of fs.readdirSync(incomingDir).filter(n=>/^REPORT-.*\.json$/.test(n))){
    try{
      const report=JSON.parse(fs.readFileSync(path.join(incomingDir,name),'utf8'));
      if(report?.diagnostics?.fingerprint===fingerprint){
        console.log(`# BUG CANDIDATE DEDUPED fingerprint=${fingerprint}`);
        console.log(`Existing report: ${name}`);
        console.log(`Triage: ${report.triage?.status||'unknown'} -> ${report.triage?.bug_id||'unassigned'}`);
        process.exit(0);
      }
    }catch{}
  }
}

const now=new Date().toISOString();
const id=`REPORT-${now.replace(/[-:.TZ]/g,'').slice(0,14)}-${fingerprint.slice(0,6)}`;
const likelyClass=/browserstack|playwright|runner|github actions|ci\b/i.test(sanitized)?'INFRA_TEST':/safari|webkit|ios|network|timeout|fetch|cdn/i.test(sanitized)?'PRODUCT_OR_EXTERNAL_ENV':'PRODUCT_OR_UNKNOWN';
const strong=best&&best.score>=0.08;
const report={
  id,
  created_at:now,
  source,
  player_description:null,
  category:likelyClass,
  screenshot_ref:null,
  environment:{raw:'unknown'},
  game_context:{git_head:gitHead},
  diagnostics:{
    fingerprint,
    git_head:gitHead,
    excerpt:sanitized.slice(0,1600),
    closest_known_bugs:ranked.slice(0,5)
  },
  sanitized:true,
  triage:{
    status:strong?'MATCH_CANDIDATE':'NEW_CANDIDATE',
    bug_id:strong?best.id:null,
    confidence:strong?Number(best.score.toFixed(3)):null,
    needs_human_or_agent_review:true
  }
};

console.log(`# BUG CANDIDATE fingerprint=${fingerprint}`);
console.log(`Class: ${likelyClass}`);
console.log(`Git HEAD: ${gitHead||'unknown'}`);
console.log(`Closest: ${best?`${best.id} score=${best.score.toFixed(3)} [${best.status}/${best.severity}]`:'none'}`);
console.log(`Decision: ${report.triage.status}${report.triage.bug_id?` -> ${report.triage.bug_id}`:''}`);
if(dryRun){console.log('Dry run: report not written.');process.exit(0);}
fs.mkdirSync(incomingDir,{recursive:true});
const target=path.join(incomingDir,`${id}.json`);
fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(`Written: ${path.relative(root,target)}`);
