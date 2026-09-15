#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const bugId=process.argv.find(a=>/^BUG-\d{4}$/.test(a));
const limitArg=process.argv.find(a=>a.startsWith('--limit='));
const limit=Math.max(5,Math.min(100,Number(limitArg?.split('=')[1]||30)));
if(!bugId){console.error('Usage: npm run bug:culprit -- BUG-0003 [--limit=30]');process.exit(1);}
const file=path.join(root,'bugs','registry',`${bugId}.json`);
if(!fs.existsSync(file)){console.error(`Unknown bug ${bugId}`);process.exit(1);}
const bug=JSON.parse(fs.readFileSync(file,'utf8'));
const related=new Set([...(bug.suspected_files||[]),...(bug.fix?.files||[])]);
for(const attempt of bug.attempt_history||[])for(const f of attempt.change?.files||[])related.add(f);
const files=[...related].filter(Boolean).filter(f=>fs.existsSync(path.join(root,f)));
if(!files.length){console.log(`# BUG CULPRIT — ${bugId}\nNo related files currently exist in the working tree.`);process.exit(0);}

let raw='';
try{
  raw=execFileSync('git',['log',`-n${limit}`,'--date=iso-strict','--pretty=format:%H%x09%ad%x09%s','--',...files],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
}catch(error){console.error(`git log failed: ${error.message}`);process.exit(1);}
const knownFixes=new Set(bug.fix?.commits||[]);
const rows=[];
for(const line of raw.split(/\r?\n/).filter(Boolean)){
  const [sha,date,...subjectParts]=line.split('\t');
  const subject=subjectParts.join('\t');
  let changed=[];
  try{changed=execFileSync('git',['show','--pretty=format:','--name-only',sha,'--',...files],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);}catch{}
  const historicalHits=changed.filter(f=>related.has(f));
  let score=historicalHits.length*10;
  if(knownFixes.has(sha)||[...knownFixes].some(f=>sha.startsWith(f)||f.startsWith(sha)))score-=30;
  if(/fix|bug|revert|hotfix/i.test(subject))score+=3;
  rows.push({sha,date,subject,changed:historicalHits,score,knownFix:score<0});
}
rows.sort((a,b)=>b.score-a.score||String(b.date).localeCompare(String(a.date)));
console.log(`# BUG CULPRIT — ${bugId}`);
console.log(`Historical files: ${files.length}`);
for(const f of files)console.log(`- ${f}`);
console.log('\nRecent commits touching this surface:');
if(!rows.length)console.log('- none in available git history');
for(const row of rows.slice(0,15)){
  const label=row.knownFix?'KNOWN_FIX':'CANDIDATE';
  console.log(`- ${label} score=${row.score} ${row.sha.slice(0,12)} ${row.date} ${row.subject}`);
  if(row.changed.length)console.log(`  files: ${row.changed.join(', ')}`);
}
console.log('\nPolicy: correlation is not causation. Reproduce/bisect before naming a commit as root cause. Known fix commits are demoted, not deleted from history.');
