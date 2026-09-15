/* KELO-INDEX
 * area: QA / ADMIN TUNING
 * owner: Game Tuning CI audit
 * purpose: protege owner boundaries, publicación server-side y boot explícito del panel admin
 */
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const checks=[];function ok(name,value){checks.push([name,!!value]);if(!value)process.exitCode=1;}
const index=read('index.html'),core=read('src/systems/game-tuning-system.js'),authority=read('src/systems/game-tuning-authority.js'),ui=read('src/ui/game-tuning-admin-ui.js'),publisher=read('server/game-tuning-publisher.js'),http=read('server/game-tuning-http.js'),bootstrap=read('server/sprite-ai-bootstrap.js'),config=JSON.parse(read('game-tuning.json')),catalog=read('docs/system-catalog.json');
ok('boot authority',index.includes('src/systems/game-tuning-authority.js'));
ok('boot tuning owner',index.includes('src/systems/game-tuning-system.js'));
ok('boot admin ui',index.includes('src/ui/game-tuning-admin-ui.js'));
ok('camera uses owner API',core.includes('KeloCamera.setBaseZoom')&&core.includes('KeloCamera.setFollowTuning')&&!core.includes('CONFIG.zoom='));
ok('sprite scale uses avatar middleware',core.includes("KeloAvatar.use('game-tuning:sprite-scale'"));
ok('preview/draft/publish API',/preview,saveDraft,discard,publish/.test(core));
ok('authority uses same online endpoint',authority.includes('KELO_ONLINE_RUNTIME_CONFIG')&&authority.includes('/api/game-tuning/publish'));
ok('admin UI uses input locks',ui.includes('KeloInputLocks.acquire')&&ui.includes('KeloInputLocks.release'));
ok('admin UI has publish confirmation',ui.includes('PUBLICAR ACTUALIZACIÓN')&&ui.includes('window.confirm'));
ok('server secret only',publisher.includes('KELO_GITHUB_TOKEN')&&!authority.includes('GITHUB_TOKEN')&&!ui.includes('GITHUB_TOKEN'));
ok('publisher fixes repo path server-side',publisher.includes("'game-tuning.json'")&&publisher.includes('GitHub Contents API'));
ok('server permission gate',http.includes('GAME_TUNING_PERMISSION_DENIED')&&http.includes("permissions.has('world.publish')"));
ok('single HTTP composition',bootstrap.includes('createGameTuningHttpHandler')&&!bootstrap.match(/\.listen\(/));
ok('config schema',config.schema===1&&config.camera&&config.sprites);
ok('catalog registered',catalog.includes('"id":"game-tuning"')||catalog.includes('"id": "game-tuning"'));
for(const [name,pass] of checks)console.log(`${pass?'✓':'✗'} ${name}`);if(process.exitCode)throw new Error('Game tuning audit failed');
