import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assetPaletteCategories, filterAssetPaletteRows, sanitizeRecentAssetIds } from '../src/studio/ui/studio-asset-palette.mjs';

const rows=[
  {id:'tree:oak',label:'Oak Tree',category:'nature'},
  {id:'tree:palm',label:'Palm Tree',category:'nature'},
  {id:'wall:gold',label:'Gold Wall',category:'architecture'},
  {id:'shop:kiosk',label:'Market Kiosk',category:'shops'}
];

assert.deepEqual(assetPaletteCategories(rows,7),[
  {id:'nature',count:2},{id:'architecture',count:1},{id:'shops',count:1}
],'categories must prioritize the most useful groups without changing catalog data');
assert.deepEqual(filterAssetPaletteRows(rows,{query:'oak'}).map(x=>x.id),['tree:oak'],'search must match human labels');
assert.deepEqual(filterAssetPaletteRows(rows,{category:'architecture'}).map(x=>x.id),['wall:gold'],'category filter must reduce visual noise');
assert.deepEqual(filterAssetPaletteRows(rows,{category:'recent',recentIds:['shop:kiosk','tree:oak']}).map(x=>x.id),['shop:kiosk','tree:oak'],'recent assets must preserve most-recent-first order');
assert.equal(filterAssetPaletteRows(rows,{limit:2}).length,2,'palette must cap rendered cards for a light workspace');
assert.deepEqual(sanitizeRecentAssetIds(['tree:oak','tree:oak','','wall:gold']),['tree:oak','wall:gold'],'recent persistence must remove blanks and duplicates deterministically');
assert.equal(sanitizeRecentAssetIds(Array.from({length:20},(_,i)=>`asset:${i}`)).length,10,'recent persistence must remain bounded to ten assets');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-asset-palette.mjs',import.meta.url),'utf8');
assert.match(source,/RECENT_STORAGE_KEY='kelo\.studio\.assetPalette\.recent\.v1'/,'recent choices must use a versioned local storage key');
assert.match(source,/localStorage\?\.getItem/,'palette must restore recent assets across Studio sessions');
assert.match(source,/localStorage\?\.setItem/,'choosing an asset must persist recents for the next Studio session');
assert.match(source,/persistRecentIds\(root,recentIds\)/,'remember must persist the bounded deduplicated recent list');
assert.match(source,/\[data-clean-action="assets"\],\[data-act="edit-assets"\]/,'clean Assets and legacy EDIT must route to the floating palette');
assert.match(source,/stopImmediatePropagation/,'palette interception must prevent the old heavy browser opening at the same time');
assert.match(source,/selectThroughShell/,'asset choice must delegate to the existing shell placement flow');
assert.match(source,/\.ks-asset-search/,'placement proxy must reuse the existing searchable asset bridge');
assert.match(source,/BIBLIOTECA COMPLETA/,'advanced creator prefabs must remain reachable through the legacy full library');
assert.match(source,/grid-template-columns:repeat\(3/,'mobile palette must use a compact touch-friendly grid');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT|worldEditRequest/,'recent persistence must remain local UI state and never mutate world authority');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioAssetPalette/,'Studio boot must install the floating asset palette');
assert.match(entry,/tools\.prefabStamp\.list/,'floating palette must include registered creator prefabs');
assert.match(entry,/category:'My Prefabs'/,'creator prefab rows must be grouped visibly in the palette');
assert.match(entry,/creatorPrefab:true/,'creator prefab rows must use the creator thumbnail path');
assert.match(entry,/previewChildren/,'creator prefab thumbnails must retain their child composition');
assert.match(entry,/assetPalette\.destroy\(\)/,'Studio close must clean up the palette');
assert.match(entry,/assetPalette\.refresh\(\)/,'world import must refresh palette data');
assert.match(entry,/kelo-studio-foundation-v1\.15\.0-precision-snap/,'palette persistence must remain compatible with the current Studio foundation');

console.log(JSON.stringify({ok:true,search:true,categories:true,recent:true,persistentRecent:true,recentBounded:true,renderCap:true,legacyPlacementProxy:true,creatorPrefabs:true,fullLibraryFallback:true,mobileGrid:true,authorityIsolation:true},null,2));
