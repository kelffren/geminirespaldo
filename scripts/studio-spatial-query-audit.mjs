import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSpatialChunkIndex } from '../src/studio/spatial/spatial-chunk-index.mjs';

const index=createSpatialChunkIndex({chunkSize:64});
index.upsert({id:'wide',category:'entity',rect:{x:40,y:10,w:70,h:20},data:{id:'wide'}});
index.upsert({id:'small',category:'entity',rect:{x:70,y:15,w:8,h:8},data:{id:'small'}});
index.upsert({id:'zone',category:'zone',rect:{x:75,y:15,w:8,h:8},data:{id:'zone'}});
index.upsert({id:'far',category:'entity',rect:{x:200,y:200,w:12,h:12},data:{id:'far'}});

const hits=index.queryRect({x:32,y:0,w:96,h:64},{category:'entity'});
assert.deepEqual(hits.map(row=>row.id).sort(),['small','wide'],'query must preserve category filtering and return spanning entities once');
assert.equal(new Set(hits.map(row=>row.id)).size,hits.length,'entities spanning several chunks must not be duplicated');

const metrics=index.stats().lastQuery;
assert.equal(metrics.bucketsScanned,2,'96px query starting at x=32 must scan exactly two 64px buckets');
assert.ok(metrics.membershipChecks>metrics.uniqueCandidates,'spanning entities should demonstrate deduplication across bucket memberships');
assert.equal(metrics.uniqueCandidates,3,'query should see two entities plus one zone candidate before category filtering');
assert.equal(metrics.results,2,'metrics must report filtered result count');

const point=index.queryPoint(72,18,{category:'entity'});
assert.deepEqual(point.map(row=>row.id).sort(),['small','wide'],'queryPoint must preserve queryRect semantics');
assert.equal(index.stats().lastQuery.bucketsScanned,1,'point query must only scan its containing bucket');

index.clear();
assert.deepEqual(index.stats().lastQuery,{bucketsScanned:0,membershipChecks:0,uniqueCandidates:0,results:0},'clear must reset query telemetry');

const source=fs.readFileSync(new URL('../src/studio/spatial/spatial-chunk-index.mjs',import.meta.url),'utf8');
const queryBody=source.slice(source.indexOf('function queryRect'),source.indexOf('function queryPoint'));
assert.match(queryBody,/for \(let cy = q\.minY; cy <= q\.maxY; cy\+\+\) for \(let cx = q\.minX; cx <= q\.maxX; cx\+\+\)/,'queryRect must walk chunk coordinates directly');
assert.doesNotMatch(queryBody,/keysFor\(rect\)/,'queryRect must not allocate a temporary chunk-key array');
assert.doesNotMatch(queryBody,/\[\.\.\.ids\]/,'queryRect must not allocate a second candidate array before filtering');
assert.match(queryBody,/if \(seen\.has\(id\)\) continue/,'queryRect must deduplicate multi-chunk entities before entry lookup/filtering');

console.log(JSON.stringify({ok:true,directBucketTraversal:true,temporaryQueryKeyArray:false,duplicateCandidateArray:false,metrics},null,2));
