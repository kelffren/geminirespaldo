import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeFavoriteIds } from '../src/studio/ui/studio-asset-favorites.mjs';

assert.deepEqual(normalizeFavoriteIds(['tree','tree','wall','','shop']),['tree','wall','shop'],'favorites must deduplicate while preserving priority');
assert.equal(normalizeFavoriteIds(Array.from({length:30},(_,i)=>`asset:${i}`)).length,18,'favorites must stay compact and bounded');
assert.deepEqual(normalizeFavoriteIds(null),[],'invalid persisted data must normalize safely');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-asset-favorites.mjs',import.meta.url),'utf8');
assert.match(source,/localStorage\?\.setItem/,'favorites must persist locally across Studio sessions');
assert.match(source,/kelo\.studio\.assetFavorites\.v1/,'favorites persistence must be versioned');
assert.match(source,/data-favorite-toggle/,'each palette card must expose a favorite toggle');
assert.match(source,/data-favorite-asset-id/,'favorite shortcuts must remain directly selectable');
assert.match(source,/paletteApi\.choose/,'favorite shortcut must reuse the existing asset placement bridge');
assert.doesNotMatch(source,/kernel\.execute|worldEditRequest|KELO_WORLD_EDIT\.request/,'favorites must not execute world or authority mutations');
assert.match(source,/MutationObserver/,'favorites must survive dynamic palette rerenders');
assert.match(source,/scheduleRefresh/,'favorite DOM refreshes must be coalesced instead of running synchronously for every mutation');
assert.match(source,/changed\.every\(isFavoriteUiNode\)/,'observer must ignore mutations produced by favorite chips and stars themselves');
assert.doesNotMatch(source,/new root\.MutationObserver\(\(\)=>refresh\(\)\)/,'observer must never directly refresh itself on every body mutation');
assert.match(source,/removeEventListener\('click'/,'favorites must clean up global interaction hooks');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioAssetFavorites/,'Studio boot must install asset favorites');
assert.match(entry,/NOOP_ASSET_FAVORITES/,'Studio boot must have a safe fallback when optional favorites fail');
assert.match(entry,/optional asset favorites unavailable; continuing without it/,'favorites failure must not prevent world editor launch');
assert.match(entry,/assetFavorites\.refresh\(\)/,'world import must refresh favorite shortcuts');
assert.match(entry,/assetFavorites\.destroy\(\)/,'Studio close must clean up favorites');
assert.match(entry,/kelo-studio-foundation-v1\.13\.0-asset-favorites/,'Studio version must identify the favorites release');

console.log(JSON.stringify({ok:true,persistent:true,deduped:true,bounded:true,placementBridge:true,worldMutationFree:true,dynamicUi:true,selfMutationGuard:true,coalescedRefresh:true,resilientBoot:true,cleanup:true},null,2));