/* KELO-INDEX
 * area: QA / BUG RECOVERY
 * owner: /bugs Bug Intelligence support tooling
 * keys: RECOVERY GIT BISECT BINARY-SEARCH REGRESSION CLOUD MOBILE PROFILE
 * purpose: automatiza git bisect con perfiles allowlisted para encontrar el primer commit que rompe boot, movimiento o World
 * public-api: CLI --good=<sha> --bad=<sha> --profile=boot|movement|world|full
 * consumes: git, python3 static server, scripts/recovery-profile-runner.mjs, installed Playwright
 * state-owned: recovery-artifacts/bisect-* only
 * online: N/A; runs in GitHub Actions or any cloud runner, never requires the user's computer
 * do-not: no force-push, no main mutation, no arbitrary shell command input, no causal claim without reproducing the returned commit
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn,execFileSync } from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).map(raw=>{
  const clean=raw.replace(/^--/,'');const i=clean.indexOf('=');return i<0?[clean,'1']:[clean.slice(0,i),clean.slice(i+1)];
}));
const good=String(args.good||'').trim();
const bad=String(args.bad||'HEAD').trim();
const profile=String(args.profile||'boot').trim();
const allowedProfiles=new Set(['boot','movement','world','full']);
const shaLike=/^(?:HEAD|[0-9a-fA-F]{7,40}|[A-Za-z0-9._/-]+)$/;
if(!good||!shaLike.test(good)||!shaLike.test(bad)||!allowedProfiles.has(profile)){
  console.error('Usage: node scripts/recovery-bisect.mjs --good=<known-good> [--bad=HEAD] --profile=boot|movement|world|full');
  process.exit(2);
}

const artifacts=path.resolve(args.artifacts||'recovery-artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const report={schema:1,good,bad,profile,startedAt:new Date().toISOString(),firstBad:null,result:'RUNNING'};
const log=[];
const runGit=(argv,opts={})=>execFileSync('git',argv,{encoding:'utf8',...opts});
function verifyCommit(ref){runGit(['cat-file','-e',`${ref}^{commit}`]);}
verifyCommit(good);verifyCommit(bad);

const tmpRunner=path.join(os.tmpdir(),`kelo-recovery-runner-${process.pid}.mjs`);
fs.copyFileSync(path.resolve('scripts/recovery-profile-runner.mjs'),tmpRunner);
const port=Number(args.port)||4173;
const base=`http://127.0.0.1:${port}/`;
const serverLog=fs.openSync(path.join(artifacts,'bisect-server.log'),'a');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:['ignore',serverLog,serverLog]});

async function waitServer(){
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    try{const res=await fetch(base,{cache:'no-store'});if(res.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error('LOCAL_SERVER_NOT_READY');
}
function resetBisect(){try{runGit(['bisect','reset'],{stdio:'ignore'});}catch{}}

let exitCode=0;
try{
  await waitServer();
  resetBisect();
  log.push(runGit(['bisect','start',bad,good]));
  let bisectOutput='';
  try{
    bisectOutput=execFileSync('git',['bisect','run','node',tmpRunner,`--profile=${profile}`,`--base=${base}`,`--artifacts=${artifacts}`],{
      encoding:'utf8',env:{...process.env,KELO_PAGES:base,KELO_RECOVERY_PROFILE:profile,KELO_RECOVERY_ARTIFACTS:artifacts}
    });
  }catch(error){
    bisectOutput=String(error?.stdout||'')+'\n'+String(error?.stderr||'');
    // git bisect run can surface the tested command status; keep evidence and inspect refs/bisect/bad below.
  }
  log.push(bisectOutput);
  try{report.firstBad=runGit(['rev-parse','refs/bisect/bad']).trim();}catch{}
  report.result=report.firstBad?'FOUND':'INCONCLUSIVE';
  if(!report.firstBad)exitCode=1;
}catch(error){
  report.result='ERROR';report.error=String(error?.stack||error);exitCode=2;
}finally{
  try{log.push(runGit(['bisect','log']));}catch{}
  resetBisect();
  try{server.kill('SIGTERM');}catch{}
  try{fs.unlinkSync(tmpRunner);}catch{}
  try{fs.closeSync(serverLog);}catch{}
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(artifacts,'bisect.log'),log.join('\n\n'));
  fs.writeFileSync(path.join(artifacts,'bisect-report.json'),JSON.stringify(report,null,2));
}

if(report.firstBad)console.log(`RECOVERY_BISECT_FIRST_BAD=${report.firstBad}`);
console.log(JSON.stringify(report,null,2));
process.exit(exitCode);
