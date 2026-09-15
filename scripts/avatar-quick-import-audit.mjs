/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: UNIVERSAL SPRITE INGESTION V6 OWNERS HYPOTHESES 8D REVIEW GATE RUNTIME
 * purpose: architecture and end-to-end contract audit for Universal Sprite Ingestion V6
 * online: validates that persistence/selection remain behind repository/service
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {interpretSpriteRig} from '../src/creators/sprite-compiler/sprite-rig-interpreter.mjs';

const require = createRequire(import.meta.url);
const {createAvatarSyncStore} = require('../server/avatar-sync-store.js');

const read = path => fs.readFileSync(path, 'utf8');
const checks = [];
const ok = (name, condition) => checks.push({name, ok: !!condition});
const runtime = read('src/characters/creator-avatar-runtime.mjs');
const legacy = read('src/creators/avatar/avatar-spritesheet-analyzer.mjs');
const compiler = read('src/creators/avatar/kelo-universal-asset-compiler.mjs');
const foreground = read('src/creators/sprite-compiler/sprite-foreground-analysis.mjs');
const layout = read('src/creators/sprite-compiler/sprite-layout-interpreter.mjs');
const rig = read('src/creators/sprite-compiler/sprite-rig-interpreter.mjs');
const normalizer = read('src/creators/sprite-compiler/sprite-frame-normalizer.mjs');
const validator = read('src/creators/sprite-compiler/sprite-ingestion-validator.mjs');
const doctor = read('src/creators/sprite-compiler/sprite-frame-doctor.mjs');
const service = read('src/creators/avatar/avatar-quick-import-service.mjs');
const ui = read('src/creators/ui/avatar-workspace.mjs');
const server = read('server/avatar-sync-store.js');
const entry = read('src/creators/creator-entry.mjs');
const repo = read('src/creators/content/supabase-content-repository.mjs');
const registry = read('src/creators/content/runtime-content-registry.mjs');
const migration = read('supabase/migrations/20260910040057_avatar_quick_import_selection.sql');

ok('runtime remains one KeloAvatar middleware owner', runtime.includes("KeloAvatar.use('creator-avatar-runtime'") && !runtime.includes('renderAvatar='));
ok('runtime selection still restores locally', runtime.includes('kelo.creator.avatar.selection.v1') && runtime.includes('localStorage'));
ok('runtime resolves diagonal octants for 8D', runtime.includes("['e','se','s','sw','w','nw','n','ne']") && runtime.includes('manifest.directions>=8'));
ok('runtime honors variable frame counts', runtime.includes('manifest.frameCounts[row]') && runtime.includes('%frameCount'));
ok('legacy V4 remains staged and available', legacy.includes('adaptiveCuts') && compiler.includes("from './avatar-spritesheet-analyzer.mjs'") && compiler.includes('forceLegacyV4'));
ok('orchestrator delegates foreground detection', compiler.includes('analyzeSpriteForeground') && foreground.includes('floodConnectedBackground') && foreground.includes('connectedSpriteComponents'));
ok('orchestrator delegates physical layout interpretation', compiler.includes('interpretSpriteLayout') && layout.includes('projection-clusters') && layout.includes('adaptive-grid') && layout.includes('regular-grid') && layout.includes('spatial-clusters'));
ok('layout scores components and boundary cuts', layout.includes('componentPurity') && layout.includes('boundaryTouches') && layout.includes('countAgreement'));
ok('layout reports close alternatives instead of guessing', layout.includes('AMBIGUOUS_INTERPRETATION') && layout.includes('alternatives'));
ok('semantic owner supports 1D, 4D and 8D', rig.includes('sprite-rig-1d') && rig.includes('sprite-rig-4d') && rig.includes('sprite-rig-8d'));
ok('8D contact sheet preserves eight frames', rig.includes('contactSheet8') && rig.includes('SOUTH_CLOCKWISE') && rig.includes('canonicalDirectionOrder[8]'));
ok('normalizer has safe scale and foot-anchor policy', normalizer.includes('safeScaleMin') && normalizer.includes('safeScaleMax') && normalizer.includes('baseline') && normalizer.includes('centerX'));
ok('normalizer preserves variable frame counts', normalizer.includes('frameCounts') && normalizer.includes('rig.groups.map'));
ok('normalizer accepts selective frame patches', normalizer.includes('framePatches') && normalizer.includes('copyFrom') && normalizer.includes('patchScale'));
ok('validator emits requested health dimensions', ['detection','alignment','background','frameConsistency','interpretationConfidence','finalHealth'].every(key => validator.includes(key)));
ok('validator gates uncertainty and art defects', validator.includes("status: uniqueReasons.length ? 'REVIEW_REQUIRED' : 'VALIDATED'") && validator.includes('ART_DEFECT_REGENERATION_REQUIRED'));
ok('Frame Doctor identifies exact scale and feet offsets', doctor.includes('verticalScaleDelta') && doctor.includes('feetOffsetPx') && doctor.includes('label:'));
ok('UI exposes local frame repair controls', ui.includes('AJUSTAR ESTE FRAME') && ui.includes('APLICAR PATCH') && ui.includes('COPIAR FRAME ANTERIOR'));
ok('quick service rejects unreviewed and irreparable output', service.includes('AVATAR_REVIEW_REQUIRED') && service.includes('AVATAR_ART_DEFECT_REGENERATION_REQUIRED'));
ok('quick service persists 1D/4D/8D runtime contract', service.includes('compiled.rigProfileId') && service.includes('compiled.directions') && service.includes('frameCounts:compiled.frameCounts') && service.includes('directionKeys:compiled.directionKeys'));
ok('quick service uses universal content service', service.includes('contentService.importJob') && service.includes("contentType:'character'"));
ok('runtime delivery uses public avatars bucket', service.includes("upload('avatars'") && service.includes("bucket:'avatars'"));
ok('selection persists per character', service.includes('setActiveCharacterAvatar') && migration.includes('active_avatar_content_id'));
ok('selection RPC verifies character ownership', migration.includes('AVATAR_CONTENT_NOT_OWNED_OR_INVALID') && migration.includes("d.content_type = 'character'"));
ok('server sanitizes dynamic directions and frame counts', server.includes('DIRECTION_KEYS') && server.includes('frameCounts(rt.frameCounts') && server.includes('directionKeys:Object.freeze'));
ok('UI keeps the simple upload path', ui.includes('+ SUBIR SPRITE') && ui.includes('USAR COMO AVATAR') && ui.includes('Sube. Kelo lo resuelve.'));
ok('UI renders real health metrics', ui.includes("metric('DETECTION'") && ui.includes("metric('ALIGNMENT'") && ui.includes("metric('FINAL HEALTH'"));
ok('UI exposes alternatives only as needed', ui.includes('paintHypotheses') && ui.includes('selectedLayoutSignature') && ui.includes('AJUSTES AVANZADOS'));
ok('UI previews all compiled directions', ui.includes('compiled?.directionKeys') && ui.includes('compiled.frameCounts?.[row]'));
ok('UI exposes per-frame doctor output', ui.includes('frames correctos') && ui.includes('vertical scale') && ui.includes('ART DEFECT — REGENERATION REQUIRED'));
ok('Creator composition registers Avatar workspace', entry.includes('registerAvatarWorkspace(workspaces)') && entry.includes('avatarQuick'));
ok('repository exposes avatar APIs', repo.includes('setActiveCharacterAvatar') && repo.includes('getAvatarManifest') && repo.includes('listMyCharacters'));
ok('character content routes to existing adapter', registry.includes("type==='character'") && registry.includes('KeloCreatorAvatars'));
ok('compiler and service do not create a second renderer', !compiler.includes('KeloAvatar.use(') && !service.includes('KeloAvatar.setBase'));

const fakeFrame = index => Object.freeze({empty:false,area:100,bounds:Object.freeze({x:index*12,y:0,w:8,h:10}),sourceRect:Object.freeze({x:index*12,y:0,w:8,h:10}),cell:Object.freeze({x:index*12,y:0,w:10,h:12}),cx:index*12+4,cy:5,feetY:10,boundaryRatio:0,touchesCanvasEdge:false});
const contactLayout = Object.freeze({groups:Object.freeze([Object.freeze([0,1,2,3].map(fakeFrame)),Object.freeze([4,5,6,7].map(fakeFrame))])});
const eight = interpretSpriteRig(contactLayout,{fileName:'hero-8dir.png'});
assert.equal(eight.best.directions,8);
assert.deepEqual(eight.best.directionKeys,['n','ne','e','se','s','sw','w','nw']);
assert.equal(eight.best.groups.flat().length,8);
const sanitized = createAvatarSyncStore({supabaseUrl:'https://kelo.test',supabaseApiKey:'test',fetchImpl:async()=>null}).sanitize({contentId:'avatar-8d',displayName:'8D',payload:{directions:8,avatarRuntime:{bucket:'avatars',path:'user/characters/eight.png',columns:2,rows:8,directionKeys:['n','ne','e','se','s','sw','w','nw'],frameCounts:[2,2,1,2,2,1,2,2],rowMap:{n:0,ne:1,e:2,se:3,s:4,sw:5,w:6,nw:7},frameMs:120}}});
assert.deepEqual(sanitized.payload.avatarRuntime.directionKeys,['n','ne','e','se','s','sw','w','nw']);
assert.deepEqual(sanitized.payload.avatarRuntime.frameCounts,[2,2,1,2,2,1,2,2]);
assert.equal(sanitized.payload.avatarRuntime.rowMap.nw,7);

for (const row of checks) console.log(`${row.ok ? '✓' : '✗'} ${row.name}`);
const failed = checks.filter(row => !row.ok);
if (failed.length) {
  console.error(`Universal Sprite Ingestion V6 audit failed: ${failed.length}`);
  process.exit(1);
}
console.log(`Universal Sprite Ingestion V6 audit passed: ${checks.length}/${checks.length}`);
