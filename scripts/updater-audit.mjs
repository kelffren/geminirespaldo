/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater audit
 * keys: UPDATE PWA SERVICEWORKER AUDIT CI DELTA HASH CACHE INSTANT WATCH MENU QUEUE
 * purpose: fail closed if Turbo V3 loses content-addressed reuse, adaptive concurrency, gameplay priority, silent menu UX or fast detection
 */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=m=>{console.error(`UPDATER AUDIT FAIL: ${m}`);process.exitCode=1;};
const expect=(c,m)=>{if(!c)fail(m);};
const index=read('index.html'),core=read('src/core/update-system.js'),delta=read('src/core/update-delta-core.js'),watch=read('src/core/update-watch.js'),ui=read('src/ui/update-ui.js'),sw=read('sw.js'),manifest=JSON.parse(read('manifest.webmanifest')),version=read('version.json'),doc=read('docs/systems/APP_UPDATE_SYSTEM.md');
expect(index.includes('src/core/update-system.js'),'index no carga updater');
expect(index.includes('src/core/update-watch.js'),'index no carga watch');
expect(core.includes("ASSET_CACHE_NAME = 'kelo-assets-v3'"),'falta cache global content-addressed');
expect(core.includes('GITHUB_TREE_API'),'falta manifest Git tree');
expect(core.includes('fetchBuildTree'),'falta identidad por archivo previa a descarga');
expect(core.includes('assetObjectUrl'),'falta key content-addressed');
expect(core.includes('cachedBlobSet'),'falta detección de blobs existentes');
expect(core.includes('computeDiff'),'falta cálculo delta');
expect(core.includes('deltaBytes')&&core.includes('reusedBytes'),'faltan métricas delta/reuse');
expect(core.includes('timeToReadyMs'),'falta Time To Update Ready');
expect(core.includes('navigator.storage.persist'),'falta persistencia storage best-effort');
expect(/priority\s*:\s*o\.foreground\s*\?\s*'high'\s*:\s*'low'/.test(core),'falta Fetch Priority low/high');
expect(core.includes('abortBackgroundDownloads'),'falta aborto al entrar gameplay');
expect(core.includes('Promise.all(batch.map'),'falta paralelismo adaptativo');
expect(core.includes('chooseConcurrency'),'falta gobernador de concurrencia');
expect(core.includes('KELO_COMBAT_ENABLED')&&core.includes('KeloArena.isActive'),'falta prioridad PVP/Arena');
expect(core.includes('computeGitBlobSha'),'falta verificación de integridad Git blob');
expect(core.includes('scheduleDeferredStage'),'falta stage diferido');
expect(core.includes("parsed.querySelectorAll('script[src]')"),'critical shell no deriva del HTML nuevo');
expect(!core.includes('setInterval('),'updater no puede usar setInterval');
expect(delta.includes('diffManifest')&&delta.includes('chooseConcurrency'),'helper delta incompleto');
expect(watch.includes('CHECK_EVERY_MS = 15000'),'watch no está en 15 segundos');
expect(watch.includes('snapshot.gameplayBusy'),'watch no cede a gameplay');
expect(watch.includes('setTimeout(')&&!watch.includes('setInterval('),'watch debe usar timeout recursivo');
expect(ui.includes('data-update-center')&&ui.includes('Actualizaciones'),'falta entrada Menu > Actualizaciones');
expect(ui.includes('ACTUALIZAR AHORA')&&ui.includes('DEJAR PARA LUEGO'),'faltan acciones ready/defer');
expect(ui.includes('updateCenter.queue.v1'),'falta cola persistente de actualizaciones');
expect((ui.includes('KeloUpdater.applyUpdate()')||ui.includes('g.KeloUpdater.applyUpdate()')),'UI no delega apply al updater owner');
expect(ui.includes('staging-progress')&&ui.includes('staging-paused')&&ui.includes('staged'),'UI no refleja estados download/paused/ready');
expect(ui.includes('safe-area-inset-bottom'),'Update Center no respeta safe-area iPhone');
expect(sw.includes("ASSET_CACHE_NAME = 'kelo-assets-v3'"),'SW no conoce cache global');
expect(sw.includes('contentAddressedResponse')&&sw.includes('getManifest'),'SW no resuelve build->blob');
expect(sw.includes('KELO_SET_ACTIVE_BUILD'),'SW no conserva build activa');
expect(sw.includes("cache: 'reload'"),'SW no tiene fallback fresco durante apply');
expect(manifest.id==='.'||manifest.id==='./','manifest.id incorrecto');
expect(manifest.start_url==='./'&&manifest.scope==='./'&&manifest.display==='standalone','manifest PWA incorrecto');
expect(version.includes('site.github.build_revision'),'version.json no refleja deploy real');
expect(doc.includes('Turbo V3')&&doc.includes('kelo-assets-v3'),'docs no describen Turbo V3');
expect(doc.includes('15 segundos'),'docs no describen detección rápida');
expect(doc.includes('Update Delta Bytes')&&doc.includes('Time To Update Ready'),'docs no definen KPIs');
expect(doc.includes('Git tree'),'docs no explican manifest de transición');
if(!process.exitCode)console.log('UPDATER AUDIT PASS — Turbo V3 + silent Menu Update Center contract proven');
