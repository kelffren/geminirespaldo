#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createBugObserver } from '../src/core/bug-observability.mjs';
import { sanitizeBugText } from './lib/bug-fingerprint.mjs';

const root=process.cwd();
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const name of ['bug:scan','bug:candidate','bug:triage','bug:impact','bug:culprit','bug:risk','bug:health','audit:bugs','audit:bug-reports','audit:bug-regressions','audit:bug-close','audit:bug-recurrence']){
  if(!pkg.scripts?.[name])throw new Error(`missing package script ${name}`);
}
const risk=JSON.parse(fs.readFileSync(path.join(root,'bugs','RISK_MAP.json'),'utf8'));
if(!Array.isArray(risk.rules)||risk.rules.length<3)throw new Error('risk map missing rules');
for(const rule of risk.rules){
  if(!rule.id||!Array.isArray(rule.patterns)||!rule.patterns.length||!Number.isFinite(Number(rule.score)))throw new Error(`invalid risk rule ${rule.id||'unknown'}`);
}
execFileSync(process.execPath,['scripts/bug-health.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-report-audit.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-regression-audit.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-close-gate.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-recurrence-gate.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-triage.mjs'],{cwd:root,stdio:'pipe'});
const impact=execFileSync(process.execPath,['scripts/bug-impact.mjs','src/studio/integration/live-studio-controller.mjs','--depth=2'],{cwd:root,encoding:'utf8'});
if(!/BUG IMPACT/.test(impact)||!/world-studio-ios/.test(impact))throw new Error('bug:impact did not expose World/Studio blast radius risk');
const culprit=execFileSync(process.execPath,['scripts/bug-culprit.mjs','BUG-0003','--limit=10'],{cwd:root,encoding:'utf8'});
if(!/BUG CULPRIT — BUG-0003/.test(culprit)||!/correlation is not causation/i.test(culprit))throw new Error('bug:culprit correlation report failed');
const tmp=path.join(os.tmpdir(),`kelo-bug-scan-${process.pid}.log`);
fs.writeFileSync(tmp,'Authorization: Bearer secret-token\nuser@example.com\nSafari World Editor failed after loading shell: CREATOR_WORLD_STUDIO_MOUNT_FAILED at world-workspace.mjs:123:4\n');
try{
  const scan=execFileSync(process.execPath,['scripts/bug-scan.mjs',tmp],{cwd:root,encoding:'utf8'});
  if(!/fingerprint=[0-9a-f]{16}/.test(scan))throw new Error('bug:scan did not produce a fingerprint');
  if(!/BUG-0003/.test(scan))throw new Error('bug:scan did not surface the known World bug in top matches');
  const candidate=execFileSync(process.execPath,['scripts/bug-candidate.mjs',tmp,'--source=test','--dry-run'],{cwd:root,encoding:'utf8'});
  if(!/BUG CANDIDATE/.test(candidate)||!/BUG-0003/.test(candidate)||!/Git HEAD:/.test(candidate))throw new Error('bug:candidate did not correlate the World symptom and stamp git head');
}finally{try{fs.unlinkSync(tmp);}catch{}}
const sanitized=sanitizeBugText('Authorization: Bearer abc123\nmail me at person@example.com\n10.0.0.1');
if(/abc123|person@example\.com|10\.0\.0\.1/.test(sanitized))throw new Error('bug sanitization leaked sensitive sample data');
const mem=new Map();
const storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
const fakeRoot={sessionStorage:storage,dispatchEvent(){}};
const obs=createBugObserver({root:fakeRoot,flow:'selftest',bugId:'BUG-TEST',version:'selftest'});
obs.mark('START');
obs.fail(new Error('synthetic'),'SELFTEST');
const events=obs.read();
if(events.length!==2||events[0].milestone!=='START'||events[1].milestone!=='FAIL')throw new Error('runtime observability timeline failed');
console.log(`BUG INTELLIGENCE SELFTEST PASS — ${risk.rules.length} risk rules, incoming report audit, sanitized fingerprinting/candidates, triage, blast radius, culprit correlation, recurrence/close/regression gates and runtime milestones validated.`);
