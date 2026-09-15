import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSelectHitRadius, screenRadiusToWorld } from '../src/studio/tools/select-tool.mjs';

const mobileRoot=zoom=>({innerWidth:390,matchMedia:()=>({matches:true}),KeloCamera:{snapshot:()=>({effectiveZoom:zoom})}});
assert.equal(screenRadiusToWorld(18,1),18,'18 screen px at 100% zoom must equal 18 world units');
assert.equal(screenRadiusToWorld(18,.5),36,'18 screen px at 50% zoom must expand to 36 world units');
assert.equal(screenRadiusToWorld(18,2),9,'18 screen px at 200% zoom must contract to 9 world units');
assert.equal(screenRadiusToWorld(18,.05),72,'extreme zoom-out must clamp conversion to the 0.25 safety floor');
assert.equal(resolveSelectHitRadius(null,{root:mobileRoot(1)}),18,'coarse mobile pointers need an 18px screen-equivalent hit radius');
assert.equal(resolveSelectHitRadius(null,{root:mobileRoot(.5)}),36,'mobile hit slop must remain 18 screen px while zoomed out');
assert.equal(resolveSelectHitRadius(null,{root:mobileRoot(2)}),9,'mobile hit slop must remain 18 screen px while zoomed in');
assert.equal(resolveSelectHitRadius(null,{root:{innerWidth:1200,matchMedia:()=>({matches:true}),KeloCamera:{snapshot:()=>({effectiveZoom:.5})}}}),0,'wide coarse layouts must not silently enlarge desktop selection');
assert.equal(resolveSelectHitRadius(null,{root:{innerWidth:390,matchMedia:()=>({matches:false}),KeloCamera:{snapshot:()=>({effectiveZoom:.5})}}}),0,'fine pointers must retain exact desktop selection');
assert.equal(resolveSelectHitRadius(7,{root:mobileRoot(.5)}),7,'explicit world radius must override automatic mobile tolerance');
assert.equal(resolveSelectHitRadius(0,{root:mobileRoot(.5)}),0,'callers must be able to request exact hit testing');

const source=fs.readFileSync(new URL('../src/studio/tools/select-tool.mjs',import.meta.url),'utf8');
assert.match(source,/MOBILE_HIT_RADIUS_PX=18/,'mobile hit radius must remain explicit in screen pixels');
assert.match(source,/KeloCamera\?\.snapshot\?\.\(\)\?\.effectiveZoom/,'mobile selection must read canonical camera effective zoom');
assert.match(source,/screenRadiusToWorld\(MOBILE_HIT_RADIUS_PX,zoom\)/,'automatic touch tolerance must convert screen pixels to world units');
assert.match(source,/\(pointer: coarse\)/,'touch tolerance must be gated by coarse pointer capability');
assert.match(source,/innerWidth\|\|9999\)<=MOBILE_MAX/,'touch tolerance must remain mobile-scoped');
assert.match(source,/kernel\.spatial\.queryRect/,'expanded hit testing must reuse the spatial index');
assert.match(source,/hitDistanceSquared/,'expanded candidates must be ranked by distance to the tap');
assert.match(source,/\.sort\(\(a,b\)=>a\.d-b\.d\|\|a\.index-b\.index\)/,'nearest object must win while preserving stack order on ties');
assert.match(source,/kernel\.spatial\.queryPoint/,'desktop exact hit testing must remain available');
assert.doesNotMatch(source,/kernel\.execute/,'selection hit slop must not create world commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection hit slop must not write authority directly');

console.log(JSON.stringify({ok:true,mobileHitSlop:true,screenRadiusPx:18,zoomStable:true,zoomCases:{half:36,normal:18,double:9},coarsePointerOnly:true,nearestCandidate:true,desktopExact:true,commandBusUntouched:true},null,2));
