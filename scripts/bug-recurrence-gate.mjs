#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registryDir=path.join(root,'bugs','registry');
const incomingDir=path.join(root,'bugs','incoming');
const strictPending=process.argv.includes('--strict-pending');
const failures=[];
const warnings=[];

function isoTime(value){
  const t=Date.parse(value||'');
  return Number.isFinite(t)?t:null;
}

const bugs=new Map();
if(fs.existsSync(registryDir)){
  for(const name of fs.readdirSync(registryDir).filter(n=>/^BUG-\d{4}\.json$/.test(n))){
    try{const b=JSON.parse(fs.readFileSync(path.join(registryDir,name),'utf8'));bugs.set(b.id,b);}catch{}
  }
}

const reports=[];
if(fs.existsSync(incomingDir)){
  for(const name of fs.readdirSync(incomingDir).filter(n=>/^REPORT-.*\.json$/.test(n))){
    try{reports.push({name,...JSON.parse(fs.readFileSync(path.join(incomingDir,name),'utf8'))});}catch{}
  }
}

for(const report of reports){
  const bugId=report.triage?.bug_id;
  if(!bugId||!bugs.has(bugId))continue;
  const bug=bugs.get(bugId);
  const confidence=Number(report.triage?.confidence||0);
  const hasFingerprint=Boolean(report.diagnostics?.fingerprint);
  const matchCandidate=report.triage?.status==='MATCH_CANDIDATE';
  if(!report.sanitized||!hasFingerprint||!matchCandidate||confidence<0.08)continue;

  const reportAt=isoTime(report.created_at);
  const verifiedAt=isoTime(bug.verification?.verified_at);
  const fixedAt=Math.max(...(bug.attempt_history||[]).filter(a=>a.validation?.result==='PASS').map(a=>isoTime(a.at)).filter(Number.isFinite),0)||null;
  const threshold=verifiedAt||fixedAt||isoTime(bug.updated_at);
  const isLater=reportAt!==null&&threshold!==null&&reportAt>threshold;

  if(['VERIFIED','CLOSED'].includes(bug.status)){
    if(isLater){
      failures.push(`${bug.id}: ${report.name} matches a ${bug.status} bug after verification/closure (confidence=${confidence.toFixed(3)}). REOPEN REVIEW REQUIRED; do not create a new bug ID.`);
    }else if(reportAt===null||threshold===null){
      warnings.push(`${bug.id}: matching report ${report.name} cannot be time-ordered against verification; manual recurrence review required.`);
    }
  }

  if(bug.status==='FIXED_PENDING_VERIFY'){
    if(isLater){
      const msg=`${bug.id}: ${report.name} matches after the candidate fix while status is FIXED_PENDING_VERIFY (confidence=${confidence.toFixed(3)}). Candidate fix may have failed.`;
      if(strictPending)failures.push(msg);else warnings.push(msg);
    }
  }
}

if(warnings.length){console.log('BUG RECURRENCE WARNINGS');for(const w of warnings)console.log(`- ${w}`);}
if(failures.length){console.error('BUG RECURRENCE GATE FAILED');for(const f of failures)console.error(`- ${f}`);process.exit(1);}
console.log(`BUG RECURRENCE GATE PASS — ${reports.length} incoming report(s), ${bugs.size} canonical bug(s) checked${strictPending?' in strict-pending mode':''}.`);
