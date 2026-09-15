#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'bugs','registry');
const bugs=fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
const failures=[],warnings=[];
const looksLikeTest=v=>typeof v==='string'&&(/(^|\/)(tests?|scripts)\//i.test(v)||/\.(spec|test)\.[cm]?[jt]s$/i.test(v));
for(const b of bugs){
 const refs=[...(b.fix?.files||[]),...(b.verification?.evidence||[])];
 const hasRegression=refs.some(looksLikeTest)||Boolean(b.regression?.test||b.regression?.command);
 if(['VERIFIED','CLOSED'].includes(b.status)&&!hasRegression)failures.push(`${b.id}: ${b.status} requires permanent regression evidence/test.`);
 if(b.status==='FIXED_PENDING_VERIFY'&&!hasRegression)warnings.push(`${b.id}: fix exists but no regression test is recorded yet.`);
}
if(warnings.length){console.log('REGRESSION WARNINGS');for(const w of warnings)console.log(`- ${w}`);}
if(failures.length){console.error('REGRESSION AUDIT FAILED');for(const f of failures)console.error(`- ${f}`);process.exit(1);}
console.log(`BUG REGRESSION AUDIT PASS — ${bugs.length} bug(s) checked.`);
