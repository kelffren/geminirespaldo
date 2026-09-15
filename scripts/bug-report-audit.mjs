#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const incomingDir=path.join(root,'bugs','incoming');
const registryDir=path.join(root,'bugs','registry');
const failures=[];
const warnings=[];
const bugIds=new Set();
if(fs.existsSync(registryDir)){
  for(const name of fs.readdirSync(registryDir).filter(n=>/^BUG-\d{4}\.json$/.test(n)))bugIds.add(name.replace(/\.json$/,''));
}
const allowedTriage=new Set(['NEW','NEW_CANDIDATE','MATCH_CANDIDATE','LINKED','DUPLICATE','DISMISSED','NEEDS_INFO']);
const reports=[];
if(fs.existsSync(incomingDir)){
  for(const name of fs.readdirSync(incomingDir).filter(n=>/^REPORT-.*\.json$/.test(n))){
    try{reports.push({name,data:JSON.parse(fs.readFileSync(path.join(incomingDir,name),'utf8'))});}
    catch(error){failures.push(`${name}: invalid JSON (${error.message})`);}
  }
}

function validIso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}
function hasSensitiveText(value){
  const s=String(value||'');
  return /(authorization\s*[:=]\s*bearer\s+(?!<redacted>)[^\s]+)/i.test(s)
    || /(cookie\s*[:=]\s*(?!<redacted>)[^\n]+)/i.test(s)
    || /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/.test(s)
    || /[?&](?:token|access_token|refresh_token|apikey|api_key|secret|password)=(?!<redacted>)[^&\s]+/i.test(s);
}

for(const {name,data:r} of reports){
  if(!r||typeof r!=='object'){failures.push(`${name}: report must be an object.`);continue;}
  if(typeof r.id!=='string'||!/^REPORT-[A-Za-z0-9-]+$/.test(r.id))failures.push(`${name}: invalid report id.`);
  if(!validIso(r.created_at))failures.push(`${name}: created_at must be ISO-like and parseable.`);
  if(typeof r.source!=='string'||!r.source.trim())failures.push(`${name}: source is required.`);
  if(r.sanitized!==true)failures.push(`${name}: sanitized must be true before report enters the repository.`);
  const status=r.triage?.status;
  if(!status||!allowedTriage.has(status))failures.push(`${name}: unsupported triage.status ${status??'missing'}.`);
  if(r.triage?.bug_id&&!bugIds.has(r.triage.bug_id))failures.push(`${name}: triage.bug_id ${r.triage.bug_id} does not exist.`);

  const modern=['NEW_CANDIDATE','MATCH_CANDIDATE'].includes(status);
  if(modern){
    if(!/^[0-9a-f]{16}$/.test(r.diagnostics?.fingerprint||''))failures.push(`${name}: modern candidate requires 16-char hex diagnostics.fingerprint.`);
    if(typeof r.diagnostics?.excerpt!=='string'||!r.diagnostics.excerpt.trim())failures.push(`${name}: modern candidate requires sanitized diagnostics.excerpt.`);
    if(!Array.isArray(r.diagnostics?.closest_known_bugs))failures.push(`${name}: modern candidate requires diagnostics.closest_known_bugs array.`);
    if(status==='MATCH_CANDIDATE'){
      const c=Number(r.triage?.confidence);
      if(!Number.isFinite(c)||c<0||c>1)failures.push(`${name}: MATCH_CANDIDATE requires triage.confidence between 0 and 1.`);
      if(!r.triage?.bug_id)failures.push(`${name}: MATCH_CANDIDATE requires triage.bug_id.`);
    }
  }else if(!r.diagnostics?.fingerprint){
    warnings.push(`${name}: legacy/non-candidate report has no fingerprint; recurrence automation will not use it.`);
  }

  const privacySurface=[r.diagnostics?.excerpt,JSON.stringify(r.diagnostics?.console_errors||[]),JSON.stringify(r.diagnostics?.network_errors||[])].join('\n');
  if(hasSensitiveText(privacySurface))failures.push(`${name}: diagnostics appear to contain an unredacted credential/token.`);
}

if(warnings.length){console.log('BUG REPORT AUDIT WARNINGS');for(const w of warnings)console.log(`- ${w}`);}
if(failures.length){console.error('BUG REPORT AUDIT FAILED');for(const f of failures)console.error(`- ${f}`);process.exit(1);}
console.log(`BUG REPORT AUDIT PASS — ${reports.length} incoming report(s) checked, ${warnings.length} warning(s).`);
