#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const incomingDir=path.join(root,'bugs','incoming');
if(!fs.existsSync(incomingDir)){console.log('# BUG TRIAGE — no incoming directory');process.exit(0);}
const reports=[];
for(const name of fs.readdirSync(incomingDir).filter(n=>/^REPORT-.*\.json$/.test(n))){
  try{reports.push({name,...JSON.parse(fs.readFileSync(path.join(incomingDir,name),'utf8'))});}catch{}
}
const clusters=new Map();
for(const report of reports){
  const fp=report?.diagnostics?.fingerprint||`no-fingerprint:${report.name}`;
  const cluster=clusters.get(fp)||{fingerprint:fp,count:0,first:null,last:null,categories:new Set(),bugIds:new Set(),statuses:new Set(),reports:[]};
  cluster.count++;
  cluster.reports.push(report.name);
  if(report.category)cluster.categories.add(report.category);
  if(report.triage?.bug_id)cluster.bugIds.add(report.triage.bug_id);
  if(report.triage?.status)cluster.statuses.add(report.triage.status);
  const at=report.created_at||null;
  if(at&&(!cluster.first||at<cluster.first))cluster.first=at;
  if(at&&(!cluster.last||at>cluster.last))cluster.last=at;
  clusters.set(fp,cluster);
}
const ranked=[...clusters.values()].sort((a,b)=>b.count-a.count||String(b.last||'').localeCompare(String(a.last||'')));
console.log(`# BUG TRIAGE — ${reports.length} reports / ${ranked.length} fingerprints`);
if(!ranked.length){console.log('No incoming reports.');process.exit(0);}
for(const c of ranked){
  const recurrence=c.count>=3?'RECURRENT':c.count===2?'REPEATED':'SINGLE';
  console.log(`\n- ${c.fingerprint} ${recurrence} x${c.count}`);
  console.log(`  bugs: ${[...c.bugIds].join(', ')||'unassigned'}`);
  console.log(`  categories: ${[...c.categories].join(', ')||'unknown'}`);
  console.log(`  triage: ${[...c.statuses].join(', ')||'unknown'}`);
  console.log(`  window: ${c.first||'?'} -> ${c.last||'?'}`);
  console.log(`  reports: ${c.reports.slice(-5).join(', ')}${c.reports.length>5?' …':''}`);
}
console.log('\nPolicy: repeated fingerprints should update/reopen the canonical bug before creating a new bug ID.');
