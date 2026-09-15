/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: deterministic, fuzz and quality audit for the pure Map Forge core
 * public-api: CLI
 * consumes: map-forge recipes + pure core
 * state-owned: none
 * do-not: no browser/runtime assertions in this headless core audit
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate,generateBestOf,serializeMapDefinition,deserializeMapDefinition} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';
import {scenePrefabTieScore} from '../src/world/map-forge/map-forge-scene-prefabs.mjs';

const cap=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const a=generateMapCandidate(cap,{seed:81746291,assetCatalogVersion:'ci-catalog'});
const b=generateMapCandidate(cap,{seed:81746291,assetCatalogVersion:'ci-catalog'});
assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,'same seed must reproduce layoutHash');
assert.equal(serializeMapDefinition(a),serializeMapDefinition(b),'same seed must reproduce serialized MapDefinition');
assert.deepEqual(a.chunkIndex,b.chunkIndex,'chunk lookup must be deterministic');
const c=generateMapCandidate(cap,{seed:81746292,assetCatalogVersion:'ci-catalog'});
assert.notEqual(a.metadata.layoutHash,c.metadata.layoutHash,'different seed should normally change layoutHash');
assert.equal(a.validation.valid,true,JSON.stringify(a.validation));
for(const id of cap.districts.filter(d=>d.required!==false).map(d=>d.id))assert.ok(a.districts.some(d=>d.id===id),`required district ${id}`);
for(const node of a.semanticGraph.nodes.filter(n=>n.required))assert.ok(node.id,'required semantic node must have stable id');
assert.ok(a.roads.some(r=>r.source==='mst'),'MST road edges must exist');
assert.ok(a.roads.some(r=>r.source==='loop'),'strategic loop road must exist for Royal Capital');
assert.ok(a.parcels.length>0,'parcels must be generated');
assert.ok(a.parcels.every(p=>p.id&&p.blockId&&p.buildableArea.w>0&&p.buildableArea.h>0),'parcels must be valid data');
assert.ok(a.scenicVistas.some(v=>v.fromRef==='spawn'&&v.toRef==='fountain'&&v.reserved),'spawn → fountain vista must be reserved');
assert.ok(a.scenicVistas.some(v=>v.fromRef==='fountain'&&v.toRef==='castle'&&v.reserved),'fountain → castle vista must be reserved');
const roundTrip=deserializeMapDefinition(serializeMapDefinition(a));
assert.equal(roundTrip.metadata.layoutHash,a.metadata.layoutHash,'serialization roundtrip must preserve layout hash');
assert.equal(serializeMapDefinition(roundTrip),serializeMapDefinition(a),'serialization roundtrip must be exact');
const best=generateBestOf(cap,{seed:12345,count:8,assetCatalogVersion:'ci-catalog'});
assert.equal(best.requested,8);assert.equal(best.validCount,8);assert.ok(best.best.quality.total>=best.candidates.at(-1).quality.total);
assert.ok(best.selections.bestOverall&&best.selections.mostMonumental&&best.selections.mostOrganic&&best.selections.mostExplorable&&best.selections.mostCompact,'best-of selectors must resolve');

const visualTieScore=map=>{const m=map?.quality?.breakdown||{};return Number(m.visualComposition||0)*1.35+Number(m.scenicVistas||0)*1.25+Number(m.negativeSpace||0)*1.05+Number(m.assetVariety||0)+Number(m.districtCoherence||0)+scenePrefabTieScore(map);};
const legacyComparator=(x,y)=>y.quality.total-x.quality.total||String(x.metadata.layoutHash).localeCompare(String(y.metadata.layoutHash));
const currentComparator=(x,y)=>y.quality.total-x.quality.total||visualTieScore(y)-visualTieScore(x)||String(x.metadata.layoutHash).localeCompare(String(y.metadata.layoutHash));
const tieBreakRegression={runs:0,tieCases:0,changedSelections:0,improvedSelections:0,legacyVisualSum:0,currentVisualSum:0};
for(const recipe of Object.values(MAP_FORGE_RECIPES))for(let seed=1;seed<=100;seed++){
  const result=generateBestOf(recipe,{seed,count:8,assetCatalogVersion:'ci-catalog'}),legacy=[...result.candidates].sort(legacyComparator)[0],current=result.best;
  const legacyVisual=visualTieScore(legacy),currentVisual=visualTieScore(current),ties=result.candidates.filter(candidate=>candidate.quality.total===current.quality.total).length;
  assert.equal(current.quality.total,legacy.quality.total,`${recipe.id}:${seed}: tie-break must never trade away total quality`);
  assert.ok(currentVisual+1e-9>=legacyVisual,`${recipe.id}:${seed}: visual tie-break selected a worse equal-score map`);
  if(ties>1)tieBreakRegression.tieCases++;
  if(current.metadata.layoutHash!==legacy.metadata.layoutHash){tieBreakRegression.changedSelections++;if(currentVisual>legacyVisual+1e-9)tieBreakRegression.improvedSelections++;}
  tieBreakRegression.legacyVisualSum+=legacyVisual;tieBreakRegression.currentVisualSum+=currentVisual;tieBreakRegression.runs++;
  if(seed<=2){const repeat=generateBestOf(recipe,{seed,count:8,assetCatalogVersion:'ci-catalog'});assert.equal(repeat.best.metadata.layoutHash,current.metadata.layoutHash,`${recipe.id}:${seed}: best-of tie-break must stay deterministic`);}
}
assert.equal(tieBreakRegression.runs,300,'expected 300 representative best-of runs');
const forcedTie=[...best.candidates].sort((x,y)=>visualTieScore(x)-visualTieScore(y)).filter((row,index,rows)=>index===0||visualTieScore(row)>visualTieScore(rows[0])+1e-9).slice(0,2).map(row=>JSON.parse(JSON.stringify(row)));
assert.equal(forcedTie.length,2,'best-of fixture must expose two candidates with distinct visual tie scores');
forcedTie[0].quality.total=forcedTie[1].quality.total=95;forcedTie[0].metadata.layoutHash='a';forcedTie[1].metadata.layoutHash='z';
assert.equal([...forcedTie].sort(legacyComparator)[0].metadata.layoutHash,'a','legacy equal-score fixture must fall back to hash');
assert.equal([...forcedTie].sort(currentComparator)[0].metadata.layoutHash,'z','current equal-score fixture must prefer the visually stronger candidate');
const coreSource=fs.readFileSync('src/world/map-forge/map-forge-core.mjs','utf8');
assert.ok(/function candidateComparator\(a,b\)\{return b\.quality\.total-a\.quality\.total\|\|visualTieScore\(b\)-visualTieScore\(a\)\|\|String\(a\.metadata\.layoutHash\)\.localeCompare\(String\(b\.metadata\.layoutHash\)\);\}/.test(coreSource),'best-of comparator must keep visualTieScore ahead of deterministic layoutHash fallback');
assert.ok(tieBreakRegression.currentVisualSum+1e-9>=tieBreakRegression.legacyVisualSum,'visual tie-break must not regress aggregate equal-score visual quality');
tieBreakRegression.legacyVisualAvg=+(tieBreakRegression.legacyVisualSum/tieBreakRegression.runs).toFixed(3);
tieBreakRegression.currentVisualAvg=+(tieBreakRegression.currentVisualSum/tieBreakRegression.runs).toFixed(3);
tieBreakRegression.visualDelta=+(tieBreakRegression.currentVisualAvg-tieBreakRegression.legacyVisualAvg).toFixed(3);

const clone=value=>JSON.parse(JSON.stringify(value));
const disconnected=clone(a);
disconnected.navigation.edges=[];
const disconnectedScore=scoreMapDefinition(disconnected,cap);
assert.equal(disconnectedScore.valid,false,'disconnected fixed-seed map must be invalid');
assert.ok(disconnectedScore.total<=69,`invalid map must be hard-capped below elite quality; got ${disconnectedScore.total}`);

const noisy=clone(a),central=noisy.districts.find(d=>d.id==='central')||noisy.districts[0];
for(let i=0;i<120;i++)noisy.decorations.push({id:`regression:spam:${i}`,district:central.id,family:'lamp',x:central.center.x+(i%12)*4,y:central.center.y+Math.floor(i/12)*4,rotation:0,scale:1});
const noisyScore=scoreMapDefinition(noisy,cap);
assert.equal(noisyScore.valid,true,'visual spam fixture stays structurally valid so the quality gate is exercised');
assert.ok(noisyScore.total<=89,`visually spammed map must not score 90+, got ${noisyScore.total}`);

const semanticDrift=clone(a),hero=semanticDrift.landmarks.find(l=>l.hero)||semanticDrift.landmarks[0];
hero.roadConnection=false;
const semanticScore=scoreMapDefinition(semanticDrift,cap);
assert.ok(semanticScore.total<=89,`major landmark without road connection must not score 90+, got ${semanticScore.total}`);

const mixedLocal=clone(a),clusteredLocal=clone(a),fixtureDistrict=mixedLocal.districts[0],fixtureCount=Math.min(60,mixedLocal.decorations.length),fixtureFamilies=['bench','lamp','tree'];
const fixtureLabels=Array.from({length:fixtureCount},(_,i)=>fixtureFamilies[i%fixtureFamilies.length]);
const clusteredLabels=[...fixtureLabels].sort();
for(let i=0;i<fixtureCount;i++){
  const x=fixtureDistrict.bounds.x+(i%10)*100+80,y=fixtureDistrict.bounds.y+Math.floor(i/10)*100+80;
  Object.assign(mixedLocal.decorations[i],{district:fixtureDistrict.id,x,y,family:fixtureLabels[i]});
  Object.assign(clusteredLocal.decorations[i],{district:fixtureDistrict.id,x,y,family:clusteredLabels[i]});
}
const mixedLocalScore=scoreMapDefinition(mixedLocal,cap),clusteredLocalScore=scoreMapDefinition(clusteredLocal,cap),localVarietyDelta=+(mixedLocalScore.breakdown.assetVariety-clusteredLocalScore.breakdown.assetVariety).toFixed(2);
assert.ok(localVarietyDelta>=2.5,`local repetition must lower asset variety by a material measured margin; delta=${localVarietyDelta} mixed=${mixedLocalScore.breakdown.assetVariety} clustered=${clusteredLocalScore.breakdown.assetVariety}`);

const decorInsideBlock=(map,pad=16)=>map.decorations.filter(d=>map.blocks.some(block=>d.x>=block.bounds.x-pad&&d.x<=block.bounds.x+block.bounds.w+pad&&d.y>=block.bounds.y-pad&&d.y<=block.bounds.y+block.bounds.h+pad));
assert.equal(decorInsideBlock(a).length,0,'fixed-seed Royal Capital must keep decoration anchors outside buildable blocks');

const stats={};let totalBlockRejects=0,totalBlockOverlaps=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  const scores=[],times=[];let valid=0,min=Infinity,max=-Infinity,blockRejects=0,blockOverlaps=0;
  for(let seed=1;seed<=100;seed++){
    const t0=performance.now();
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    times.push(performance.now()-t0);
    if(map.validation.valid)valid++;
    scores.push(map.quality.total);min=Math.min(min,map.quality.total);max=Math.max(max,map.quality.total);
    blockRejects+=map.generationStats.decorationBlockRejects||0;
    blockOverlaps+=decorInsideBlock(map).length;
  }
  totalBlockRejects+=blockRejects;totalBlockOverlaps+=blockOverlaps;
  scores.sort((x,y)=>x-y);
  stats[id]={validRate:valid/100,avgScore:+(scores.reduce((s,x)=>s+x,0)/100).toFixed(2),medianScore:+scores[49].toFixed(2),minScore:+min.toFixed(2),bestScore:+max.toFixed(2),avgGenerationMs:+(times.reduce((s,x)=>s+x,0)/100).toFixed(2),decorationBlockRejects:blockRejects,decorationBlockOverlaps:blockOverlaps};
  assert.ok(valid>=99,`${id} valid rate ${valid}/100 is below 99%`);
  assert.ok(max-min>.5,`${id} scorer must distinguish candidate quality; range=${(max-min).toFixed(2)}`);
  assert.equal(blockOverlaps,0,`${id} generated decorations must stay outside block envelopes`);
}
assert.ok(totalBlockRejects>0,'fixed-seed fuzz must exercise the decoration-vs-block collision guard');
assert.equal(totalBlockOverlaps,0,'300 fixed-seed maps must have zero decoration anchors inside block envelopes');
console.log(JSON.stringify({ok:true,generator:'map-forge-core-v1',royalCapital:{seed:a.metadata.seed,layoutHash:a.metadata.layoutHash,score:a.quality.total,roads:a.roads.length,loops:a.generationStats.roadLoops,parcels:a.parcels.length,decorations:a.decorations.length,decorationBlockRejects:a.generationStats.decorationBlockRejects||0},qualityRegressions:{invalidCap:disconnectedScore.total,visualSpamCap:noisyScore.total,semanticLandmarkCap:semanticScore.total,localVarietyMixed:mixedLocalScore.breakdown.assetVariety,localVarietyClustered:clusteredLocalScore.breakdown.assetVariety,localVarietyDelta},bestOfTieBreak:tieBreakRegression,placementRegression:{decorationBlockRejects:totalBlockRejects,decorationBlockOverlaps:totalBlockOverlaps},bestOf8:{score:best.best.quality.total,seed:best.best.metadata.seed,layoutHash:best.best.metadata.layoutHash},stats},null,2));
