/* KELO-INDEX
 * area: AUDIT / WORLD IPHONE BOOT
 * purpose: prove Studio boot pacing cannot hang forever when iPhone Safari withholds requestAnimationFrame, including the live-shell-to-draft-import handoff
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {yieldStudioBoot} from '../src/studio/integration/studio-boot-pace.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

{
  let rafRequested=0;
  const root={
    KELO_STUDIO_BOOT_RAF_FALLBACK_MS:8,
    requestAnimationFrame:()=>{rafRequested++;return 1;},
    setTimeout,clearTimeout
  };
  const started=Date.now();
  await yieldStudioBoot(root);
  const elapsed=Date.now()-started;
  assert.equal(rafRequested,1,'boot pace should still request a paint frame');
  assert.ok(elapsed<120,`withheld RAF must fall back promptly, got ${elapsed}ms`);
}

{
  let rafRequested=0;
  const root={
    KELO_STUDIO_BOOT_RAF_FALLBACK_MS:100,
    requestAnimationFrame:cb=>{rafRequested++;return setTimeout(cb,0);},
    setTimeout,clearTimeout
  };
  const started=Date.now();
  await yieldStudioBoot(root);
  const elapsed=Date.now()-started;
  assert.equal(rafRequested,1);
  assert.ok(elapsed<80,`normal RAF should win before fallback, got ${elapsed}ms`);
  await sleep(110);
}

{
  const root={
    requestAnimationFrame:()=>{throw new Error('Safari RAF unavailable during transition');},
    setTimeout,clearTimeout
  };
  const started=Date.now();
  await yieldStudioBoot(root);
  assert.ok(Date.now()-started<80,'throwing RAF must degrade to a timer yield instead of rejecting/hanging');
}

const controllerSource=fs.readFileSync(new URL('../src/studio/integration/live-studio-controller.mjs',import.meta.url),'utf8');
assert.match(controllerSource,/async function yieldLiveMount\(root\).*yieldStudioBoot/s,'live controller must reuse the bounded Studio boot yield');
assert.match(controllerSource,/await yieldLiveMount\(root\);\s*if\(root\.KELO_WORLD_LAUNCH_ABORTED\).*await studio\.importCurrent/s,'draft import must be reached through the bounded live-mount yield');
assert.doesNotMatch(controllerSource,/await new Promise\(r=>\(root\.requestAnimationFrame\|\|root\.setTimeout\|\|setTimeout\)/,'live mount must not await raw requestAnimationFrame before draft import');

console.log('PASS world iPhone boot yield audit: RAF success, withheld RAF fallback, throwing RAF fallback, live-mount handoff bounded');