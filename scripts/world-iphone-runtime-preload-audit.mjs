/* KELO-INDEX
 * area: AUDIT / WORLD IPHONE BOOT
 * purpose: verify the iPhone World bootstrap serializes runtime-root loading, cannot hang on a missing RAF callback, and desktop does not pay the preload cost
 */
import assert from 'node:assert/strict';
import {isPhoneWorldBootstrap,preloadPhoneStudioRuntime} from '../src/creators/workspaces/world-workspace.mjs';

const iphoneRoot={
  navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',maxTouchPoints:5},
  innerWidth:390,innerHeight:844,
  requestAnimationFrame:cb=>setTimeout(cb,0),setTimeout,clearTimeout,
  matchMedia:()=>({matches:true})
};
const desktopRoot={
  navigator:{userAgent:'Mozilla/5.0 Macintosh',maxTouchPoints:0},
  innerWidth:1440,innerHeight:900,
  setTimeout,clearTimeout,
  matchMedia:()=>({matches:false})
};

assert.equal(isPhoneWorldBootstrap(iphoneRoot),true,'real iPhone shape must use constrained bootstrap');
assert.equal(isPhoneWorldBootstrap(desktopRoot),false,'desktop must keep normal lazy/parallel runtime path');

let active=0,maxActive=0;
const started=[];
const finished=[];
const modules=['one.mjs','two.mjs','three.mjs','four.mjs'];
const result=await preloadPhoneStudioRuntime(iphoneRoot,{
  modules,
  yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0)),
  load:async specifier=>{
    started.push(specifier);
    active++;
    maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,4));
    active--;
    finished.push(specifier);
    return {specifier};
  }
});
assert.deepEqual(started,modules,'iPhone preload must preserve deterministic runtime-root order');
assert.deepEqual(finished,modules,'each runtime root must finish before the next starts');
assert.equal(maxActive,1,'iPhone runtime-root preload must cap direct import concurrency at one');
assert.deepEqual(result,{enabled:true,loaded:4,total:4});

const stalledRafRoot={
  ...iphoneRoot,
  KELO_WORLD_RUNTIME_YIELD_FALLBACK_MS:5,
  requestAnimationFrame:()=>1
};
const stalledStarted=Date.now();
const stalledResult=await preloadPhoneStudioRuntime(stalledRafRoot,{
  modules:['one.mjs','two.mjs'],
  load:async specifier=>({specifier})
});
const stalledElapsed=Date.now()-stalledStarted;
assert.deepEqual(stalledResult,{enabled:true,loaded:2,total:2},'a missing Safari RAF callback must not strand the preload between modules');
assert.ok(stalledElapsed<100,'runtime fallback must release the next module without waiting for the global World timeout');

const throwingRafRoot={
  ...iphoneRoot,
  requestAnimationFrame:()=>{throw new Error('RAF_UNAVAILABLE');}
};
const throwingResult=await preloadPhoneStudioRuntime(throwingRafRoot,{
  modules:['one.mjs','two.mjs'],
  load:async specifier=>({specifier})
});
assert.deepEqual(throwingResult,{enabled:true,loaded:2,total:2},'RAF exceptions must fall back to a timer instead of aborting World boot');

let desktopLoads=0;
const desktopResult=await preloadPhoneStudioRuntime(desktopRoot,{
  modules,
  load:async()=>{desktopLoads++;}
});
assert.equal(desktopLoads,0,'desktop must not eagerly preload the Studio runtime');
assert.deepEqual(desktopResult,{enabled:false,loaded:0,total:4});

const abortedRoot={...iphoneRoot,KELO_WORLD_LAUNCH_ABORTED:true};
await assert.rejects(
  preloadPhoneStudioRuntime(abortedRoot,{modules:['one.mjs'],load:async()=>({})}),
  /WORLD_EDITOR_OPEN_TIMEOUT/,
  'preloader must respect the existing World launch abort contract'
);

console.log('PASS world iPhone runtime preload audit: serial on phone, bounded RAF yield, timer fallback, lazy on desktop, abort-safe');