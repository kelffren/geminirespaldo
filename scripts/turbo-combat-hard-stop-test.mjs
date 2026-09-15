import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const delta = require('../src/core/update-delta-core.js');
const runtime = fs.readFileSync(new URL('../src/core/update-system.js', import.meta.url), 'utf8');
const fail = (message) => { throw new Error(`TURBO COMBAT HARD-STOP FAIL: ${message}`); };

if (delta.chooseConcurrency({ gameplayBusy: true, foreground: false, status: 'good', pingMs: 20, downlinkMbps: 100 }) !== 0) {
  fail('background combat concurrency is not zero');
}
if (delta.chooseConcurrency({ gameplayBusy: true, foreground: true, status: 'good', pingMs: 20, downlinkMbps: 100 }) !== 0) {
  fail('foreground/explicit combat concurrency is not zero');
}

if (/isGameplayBusy\(\)\s*&&\s*!o\.foreground/.test(runtime)) fail('runtime gate still exempts foreground from combat');
if (/manualGameplayBusy\s*&&\s*!foregroundStage/.test(runtime)) fail('foreground stage is still exempt from abort');
if (/isGameplayBusy\(\)\s*&&\s*!\(options\s*&&\s*options\.foreground\)/.test(runtime)) fail('retry still exempts foreground');
if (!/function networkGateFromState[\s\S]*?if\(isGameplayBusy\(\)\)return \{allow:false/.test(runtime)) fail('network gate lacks unconditional combat stop');
if (!/function chooseConcurrency[\s\S]*?if\(isGameplayBusy\(\)\)return 0/.test(runtime)) fail('runtime fallback concurrency lacks unconditional zero');
if (!/function setGameplayBusy[\s\S]*?if\(state\.manualGameplayBusy\)\{[\s\S]*?abortBackgroundDownloads\(\)/.test(runtime)) fail('setGameplayBusy does not abort all tracked updater transfers');
if (!/async function applyUpdate\(\)\{if\(isGameplayBusy\(\)\)throw new Error\('update_blocked_combat'\)/.test(runtime)) fail('applyUpdate can start during combat');
if (!/async function prepareUpdate\(build,options\)\{\s*if\(isGameplayBusy\(\)\)throw new Error\('update_blocked_combat'\)/.test(runtime)) fail('prepareUpdate can start during combat');
if (!/timedFetch\(GITHUB_TREE_API[\s\S]*?,MANIFEST_TIMEOUT_MS,true\)/.test(runtime)) fail('manifest request is not abort-tracked');
if (!/timedFetch\(fresh\.href[\s\S]*?,FETCH_TIMEOUT_MS,true\)/.test(runtime)) fail('index staging request is not abort-tracked');
if (!/timedFetch\(probe\.href[\s\S]*?,PING_TIMEOUT_MS,true\)/.test(runtime)) fail('network probe is not abort-tracked');

console.log('TURBO COMBAT HARD-STOP PASS — PVP/combat blocks apply/prepare, forces zero concurrency, and aborts active updater network work');
