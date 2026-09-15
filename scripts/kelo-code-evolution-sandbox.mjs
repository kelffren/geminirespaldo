/* KELO-INDEX
 * area: QA / EVOLUTION / SANDBOX
 * owner: KeloEvolution external code-candidate sandbox runner
 * purpose: materialize an allowlisted code-patch candidate in a detached Git worktree and run registered tests without touching the caller checkout
 * public-api: sha256Text, runCodePatchSandbox; CLI --candidate <json>
 * consumes: kelo-code-patch-v1 candidate + fixed test registry
 * state-owned: temporary worktree only; removed after every run
 * online: Git/CI is the current authority; future remote runners can preserve the same candidate/report contract
 * do-not: no arbitrary shell commands from candidate data, no direct main writes, no secrets, no deploy
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createCodePatchPolicy,validateCodePatchCandidate} from '../src/creators/evolution/code-patch-candidate.mjs';

const TEST_REGISTRY=Object.freeze({
  evolution:['npm',['run','audit:evolution']],
  docs:['npm',['run','audit:docs']],
  'map-forge-core':['node',['scripts/map-forge-core-audit.mjs']],
  'map-forge-handoff':['node',['scripts/map-forge-studio-handoff-audit.mjs']]
});
const run=(command,args,{cwd,timeout=180000}={})=>spawnSync(command,args,{cwd,encoding:'utf8',timeout,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
export const sha256Text=value=>crypto.createHash('sha256').update(String(value??''),'utf8').digest('hex');

async function syntaxCheckChangedFiles(sandbox,changes){
  const rows=[];
  for(const change of changes){
    if(!/\.(?:m?js|cjs)$/.test(change.path))continue;
    const result=run(process.execPath,['--check',change.path],{cwd:sandbox,timeout:30000});
    rows.push({id:`syntax:${change.path}`,ok:result.status===0,status:result.status,stdout:result.stdout,stderr:result.stderr});
    if(result.status!==0)break;
  }
  return rows;
}

export async function runCodePatchSandbox({candidate,repoRoot=process.cwd(),policy=createCodePatchPolicy(),testIds=null}={}){
  const validation=validateCodePatchCandidate(candidate,policy);
  if(!validation.valid)return freeze({ok:false,stage:'validate',validation,tests:[]});
  const requested=[...new Set((testIds||validation.candidate.tests||[]).filter(Boolean))];
  for(const id of requested)if(id!=='syntax'&&!TEST_REGISTRY[id])return freeze({ok:false,stage:'validate-tests',validation,tests:[],error:`SANDBOX_TEST_NOT_REGISTERED:${id}`});
  const head=run('git',['rev-parse','HEAD'],{cwd:repoRoot,timeout:15000});
  if(head.status!==0)return freeze({ok:false,stage:'git-head',validation,tests:[],error:String(head.stderr||head.stdout)});
  const currentSha=String(head.stdout||'').trim();
  if(!(currentSha===validation.candidate.baseSha||currentSha.startsWith(validation.candidate.baseSha)||validation.candidate.baseSha.startsWith(currentSha)))return freeze({ok:false,stage:'base-sha',validation,tests:[],error:`BASE_SHA_MISMATCH:${validation.candidate.baseSha}:${currentSha}`});
  const tempRoot=await fs.mkdtemp(path.join(os.tmpdir(),'kelo-evolution-')),sandbox=path.join(tempRoot,'worktree');
  const tests=[];
  try{
    const added=run('git',['worktree','add','--detach',sandbox,validation.candidate.baseSha],{cwd:repoRoot,timeout:60000});
    if(added.status!==0)return freeze({ok:false,stage:'worktree-add',validation,tests,error:String(added.stderr||added.stdout)});
    for(const change of validation.candidate.changes){
      const full=path.resolve(sandbox,change.path),root=path.resolve(sandbox)+path.sep;
      if(!full.startsWith(root))return freeze({ok:false,stage:'materialize',validation,tests,error:`SANDBOX_PATH_ESCAPE:${change.path}`});
      const before=await fs.readFile(full,'utf8'),actual=sha256Text(before);
      if(actual!==change.beforeHash)return freeze({ok:false,stage:'before-hash',validation,tests,error:`BEFORE_HASH_MISMATCH:${change.path}:${actual}`});
      await fs.writeFile(full,change.afterContent,'utf8');
    }
    const syntaxRows=await syntaxCheckChangedFiles(sandbox,validation.candidate.changes);tests.push(...syntaxRows);
    if(syntaxRows.some(row=>!row.ok))return freeze({ok:false,stage:'syntax',validation,tests});
    for(const id of requested.filter(id=>id!=='syntax')){
      const [command,args]=TEST_REGISTRY[id],result=run(command,args,{cwd:sandbox});
      const row={id,ok:result.status===0,status:result.status,stdout:result.stdout,stderr:result.stderr};tests.push(row);if(!row.ok)return freeze({ok:false,stage:'tests',validation,tests});
    }
    const diff=run('git',['diff','--','.' ],{cwd:sandbox,timeout:30000});
    return freeze({ok:true,stage:'complete',validation,tests,diff:String(diff.stdout||''),sandboxIsolated:true,baseSha:validation.candidate.baseSha});
  }finally{
    try{run('git',['worktree','remove','--force',sandbox],{cwd:repoRoot,timeout:30000});}catch{}
    try{await fs.rm(tempRoot,{recursive:true,force:true});}catch{}
  }
}

async function cli(){
  const index=process.argv.indexOf('--candidate');if(index<0||!process.argv[index+1])throw new Error('USAGE: node scripts/kelo-code-evolution-sandbox.mjs --candidate candidate.json');
  const candidate=JSON.parse(await fs.readFile(path.resolve(process.argv[index+1]),'utf8')),report=await runCodePatchSandbox({candidate});
  console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)cli().catch(error=>{console.error(error);process.exitCode=1;});
