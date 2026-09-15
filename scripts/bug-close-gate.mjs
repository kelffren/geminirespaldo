#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'bugs','registry');
const strictPending=process.argv.includes('--strict-pending');
const bugs=fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
const failures=[],warnings=[];
const looksLikeTest=v=>typeof v==='string'&&(/(^|\/)(tests?|scripts)\//i.test(v)||/\.(spec|test)\.[cm]?[jt]s$/i.test(v));

for(const b of bugs){
  const final=['VERIFIED','CLOSED'].includes(b.status);
  const duplicate=Boolean(b.duplicate_of);
  const verification=b.verification||{};
  const regressionRefs=[...(b.fix?.files||[]),...(verification.evidence||[])];
  const hasRegression=regressionRefs.some(looksLikeTest)||Boolean(b.regression?.test||b.regression?.command);
  const hasFix=Boolean((b.fix?.commits||[]).length||(b.fix?.files||[]).length||b.fix?.summary);
  const hasEvidence=Array.isArray(verification.evidence)&&verification.evidence.length>0;
  const highImpact=['critical','high'].includes(String(b.severity).toLowerCase());

  if(final&&!duplicate){
    if(!hasFix)failures.push(`${b.id}: ${b.status} has no identifiable fix commit/file/summary.`);
    if(verification.status!=='PASS')failures.push(`${b.id}: ${b.status} requires verification.status=PASS.`);
    if(!hasEvidence)failures.push(`${b.id}: ${b.status} requires reproducible verification evidence.`);
    if(!verification.method)failures.push(`${b.id}: ${b.status} requires verification.method.`);
    if(!hasRegression)failures.push(`${b.id}: ${b.status} requires permanent regression protection.`);
    if(highImpact&&!verification.verified_by)failures.push(`${b.id}: ${b.severity} closure requires verified_by.`);
    if(highImpact&&!verification.verified_at)failures.push(`${b.id}: ${b.severity} closure requires verified_at.`);
  }
  if(b.status==='CLOSED'&&(b.blocked_by||[]).length)failures.push(`${b.id}: CLOSED still has blocked_by entries.`);
  if(b.status==='FIXED_PENDING_VERIFY'){
    if(!hasFix)failures.push(`${b.id}: FIXED_PENDING_VERIFY has no identifiable fix.`);
    if(!hasRegression){
      const msg=`${b.id}: pending verification without recorded regression protection.`;
      if(strictPending&&highImpact)failures.push(msg); else warnings.push(msg);
    }
    if(!(b.next_best_actions||[]).length)warnings.push(`${b.id}: pending verification has no next_best_actions.`);
  }
}

if(warnings.length){console.log('BUG CLOSE GATE WARNINGS');for(const w of warnings)console.log(`- ${w}`);}
if(failures.length){console.error('BUG CLOSE GATE FAILED');for(const f of failures)console.error(`- ${f}`);process.exit(1);}
console.log(`BUG CLOSE GATE PASS — ${bugs.length} bug(s) checked${strictPending?' in strict-pending mode':''}.`);
