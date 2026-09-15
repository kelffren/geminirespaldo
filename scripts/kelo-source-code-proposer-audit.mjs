/* KELO-INDEX
 * area: QA / EVOLUTION / SOURCE PROPOSER
 * owner: KeloEvolution QA
 * purpose: prove the bounded autonomous source-repair loop rejects unsafe/weak proposals, feeds failures back, dedupes retries and accepts only independent sandbox + objective evidence
 * public-api: CLI audit only
 * consumes: source-code-proposer pure API
 * state-owned: none
 * online: N/A; deterministic CI audit
 * do-not: no Git writes, network, secrets, deploy or production mutation
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildSourceRepairContext,
  validateSourceAgentProposal,
  runAutonomousSourceRepairCycle
} from '../src/creators/evolution/source-code-proposer.mjs';

const sha=value=>crypto.createHash('sha256').update(String(value),'utf8').digest('hex');
const baseSha='1234567890abcdef1234567890abcdef12345678';
const original=`/* KELO-INDEX\n * area: CREATORS / EVOLUTION\n */\nexport const value=1;\n`;
const improved=`/* KELO-INDEX\n * area: CREATORS / EVOLUTION\n */\nexport const value=2;\n`;
const snapshot=[
  {path:'src/creators/evolution/demo.mjs',beforeHash:sha(original),content:original},
  {path:'server/secret-demo.js',beforeHash:sha('secret'),content:'secret'}
];
const problem={
  id:'ci-demo',
  kind:'ci_failure',
  summary:'Evolution audit proves value must become 2.',
  baselineSha:baseSha,
  paths:['src/creators/evolution/demo.mjs'],
  evidence:[{type:'ci',source:'Kelo Evolution Engine CI',detail:'demo invariant failed on baseline'}]
};

const context=buildSourceRepairContext({problem,snapshot});
assert.equal(context.valid,true);
assert.deepEqual(context.writablePaths,['src/creators/evolution/demo.mjs']);
assert.equal(context.files.some(row=>row.path.startsWith('server/')),false);
assert.ok(context.instructions.some(line=>line.includes('sandbox')));

const unsafe=validateSourceAgentProposal({
  context,
  attempt:1,
  raw:{
    rationale:'Try to bypass the bounded context.',
    objective:'Repair the failing invariant.',
    changes:[{path:'server/secret-demo.js',beforeHash:sha('secret'),afterContent:'changed'}],
    tests:['evolution']
  }
});
assert.equal(unsafe.valid,false);
assert.ok(unsafe.errors.some(error=>error.startsWith('proposal_path_not_in_context:')));
assert.ok(unsafe.errors.some(error=>error.startsWith('path_not_allowlisted:')||error.startsWith('path_denied:')));

const noEvidence=buildSourceRepairContext({problem:{...problem,evidence:[]},snapshot});
assert.equal(noEvidence.valid,false);
assert.ok(noEvidence.errors.includes('problem_evidence_missing'));

let calls=0;
const cycle=await runAutonomousSourceRepairCycle({
  problem,
  snapshot,
  policy:{maxAttempts:3,minObjectiveScore:70},
  agent:async ({attempt,feedback})=>{
    calls++;
    if(attempt===1){
      assert.deepEqual(feedback,[]);
      return {
        rationale:'First attempt intentionally forgets the mandatory registered test.',
        objective:'Repair the failing invariant.',
        changes:[{path:'src/creators/evolution/demo.mjs',beforeHash:sha(original),afterContent:improved}],
        tests:[]
      };
    }
    assert.ok(feedback.some(error=>error==='required_test_missing:evolution'));
    return {
      rationale:'Second attempt preserves the same minimal source fix and declares the mandatory gate.',
      objective:'Repair the failing invariant.',
      changes:[{path:'src/creators/evolution/demo.mjs',beforeHash:sha(original),afterContent:improved}],
      tests:['evolution']
    };
  },
  evaluate:async ({candidate,attempt})=>{
    assert.equal(attempt,2);
    assert.equal(candidate.tests.includes('evolution'),true);
    return {
      objectiveScore:88,
      report:{
        ok:true,
        stage:'complete',
        diff:'--- a/demo\n+++ b/demo\n- export const value=1;\n+ export const value=2;',
        tests:[
          {id:'syntax:src/creators/evolution/demo.mjs',ok:true,status:0},
          {id:'evolution',ok:true,status:0}
        ]
      }
    };
  }
});
assert.equal(calls,2);
assert.equal(cycle.accepted,true);
assert.equal(cycle.stage,'accepted');
assert.equal(cycle.attempts[0].stage,'proposal');
assert.ok(cycle.attempts[0].failures.includes('required_test_missing:evolution'));
assert.equal(cycle.final.objectiveScore,88);
assert.equal(cycle.final.evaluation.valid,true);

let weakCalls=0;
const weakObjective=await runAutonomousSourceRepairCycle({
  problem,
  snapshot,
  policy:{maxAttempts:2,minObjectiveScore:80},
  agent:async ()=>{
    weakCalls++;
    return {
      rationale:'Same candidate will be rejected by independent objective evidence.',
      objective:'Repair the failing invariant.',
      changes:[{path:'src/creators/evolution/demo.mjs',beforeHash:sha(original),afterContent:improved}],
      tests:['evolution']
    };
  },
  evaluate:async ()=>({
    objectiveScore:55,
    report:{
      ok:true,
      stage:'complete',
      diff:'--- a/demo\n+++ b/demo\n-1\n+2',
      tests:[
        {id:'syntax:src/creators/evolution/demo.mjs',ok:true,status:0},
        {id:'evolution',ok:true,status:0}
      ]
    }
  })
});
assert.equal(weakCalls,2);
assert.equal(weakObjective.accepted,false);
assert.equal(weakObjective.stage,'exhausted');
assert.equal(weakObjective.attempts[0].stage,'evaluated');
assert.ok(weakObjective.attempts[0].failures.some(error=>error.startsWith('metric_below_hard_min:objectiveScore:')));
assert.equal(weakObjective.attempts[1].stage,'dedupe');
assert.ok(weakObjective.attempts[1].failures.includes('candidate_duplicate'));

console.log(JSON.stringify({
  ok:true,
  contextWritablePaths:context.writablePaths,
  repairAttempts:cycle.attempts.map(row=>({attempt:row.attempt,stage:row.stage,accepted:row.accepted,failures:row.failures})),
  weakObjectiveStages:weakObjective.attempts.map(row=>row.stage)
},null,2));
