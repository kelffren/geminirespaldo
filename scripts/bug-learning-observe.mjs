/* KELO-INDEX
 * area: QA / BUGS / EVOLUTION / FEEDBACK
 * owner: Bug Intelligence learning feedback adapter
 * purpose: append bounded sanitized preventive-CI outcomes to learning memory without granting bug/source authority
 * public-api: CLI --head=<sha> --conclusion=<value> [--at=<iso>] [--base=<sha>] [--success-minutes=<n>]
 * consumes: git commit/diff, bugs/learning/STATE.json
 * state-owned: bugs/learning/STATE.json observations only
 * online: N/A
 * do-not: never persist logs/secrets, mutate bug lifecycle, source code or learned champion policy directly
 */

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const statePath=path.join(root,'bugs','learning','STATE.json');
const args=Object.fromEntries(process.argv.slice(2).filter(v=>v.startsWith('--')&&v.includes('=')).map(v=>{const [key,...rest]=v.slice(2).split('=');return[key,rest.join('=')];}));
const head=String(args.head||'').trim();
const conclusion=String(args.conclusion||'').trim().toLowerCase();
const at=String(args.at||'').trim()||new Date().toISOString();
const successMinutesRaw=args['success-minutes'];
const successMinutes=successMinutesRaw===undefined?60:Number(successMinutesRaw);
const allowedConclusions=new Set(['success','failure','cancelled','timed_out','action_required','neutral','skipped','stale']);
if(!/^[0-9a-f]{7,40}$/i.test(head)){console.error('BUG LEARNING OBSERVE FAILED — valid --head SHA required');process.exit(1);}
if(!allowedConclusions.has(conclusion)){console.error(`BUG LEARNING OBSERVE FAILED — unsupported conclusion ${conclusion||'missing'}`);process.exit(1);}
if(!Number.isFinite(Date.parse(at))){console.error('BUG LEARNING OBSERVE FAILED — --at must be parseable ISO date');process.exit(1);}
if(!Number.isFinite(successMinutes)||successMinutes<0){console.error('BUG LEARNING OBSERVE FAILED — --success-minutes must be a non-negative number');process.exit(1);}

let state=null;
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch(error){console.error(`BUG LEARNING OBSERVE FAILED — cannot read learning state: ${error.message}`);process.exit(1);}
if(state?.schema!=='kelo-bug-learning-v1'){console.error(`BUG LEARNING OBSERVE FAILED — unsupported state schema ${state?.schema}`);process.exit(1);}

let base=String(args.base||'').trim();
try{execFileSync('git',['cat-file','-e',`${head}^{commit}`],{stdio:'ignore'});}catch{console.error(`BUG LEARNING OBSERVE FAILED — head commit unavailable: ${head}`);process.exit(1);}
if(!base){try{base=execFileSync('git',['rev-parse',`${head}^`],{encoding:'utf8'}).trim();}catch{base='';}}
let files=[];
if(base){
  try{files=execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,120);}catch{files=[];}
}
const id=`prevention:${head}`;
const observations=Array.isArray(state.observations)?state.observations:[];
const existing=observations.find(row=>row?.id===id);
if(existing&&existing.conclusion===conclusion&&JSON.stringify(existing.files||[])===JSON.stringify(files)){
  console.log(`BUG LEARNING OBSERVE — duplicate ${id}; no state change.`);
  process.exit(0);
}

// Successful preventive runs are high-volume positive evidence. Keep at most one
// representative success per interval so learning stays balanced without turning
// every useful main push into a second state-only push. Failures and abnormal
// conclusions remain immediate and are never throttled.
if(conclusion==='success'&&successMinutes>0){
  const observedAt=Date.parse(at);
  const intervalMs=successMinutes*60*1000;
  const latestSuccess=observations
    .filter(row=>row?.source==='bug-prevention-ci'&&row?.conclusion==='success'&&Number.isFinite(Date.parse(row?.at||'')))
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  if(latestSuccess){
    const sinceLatest=observedAt-Date.parse(latestSuccess.at);
    if(sinceLatest<intervalMs){
      console.log(`BUG LEARNING OBSERVE — success ${head.slice(0,12)} sampled out; latest positive feedback is within ${successMinutes}m.`);
      process.exit(0);
    }
  }
}

const observation={id,at:new Date(at).toISOString(),source:'bug-prevention-ci',head_sha:head,base_sha:base||null,conclusion,files};
state.observations=[...observations.filter(row=>row?.id!==id),observation].slice(-200);
state.feedback_updated_at=new Date().toISOString();
fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
console.log(`BUG LEARNING OBSERVE — ${conclusion} ${head.slice(0,12)} files=${files.length} observations=${state.observations.length}`);