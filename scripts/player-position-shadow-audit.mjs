/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / PLAYER POSITION
 * owner: Player Position Shadow Audit
 * owns: certification that position observability is read-only and uses KeloSimulation
 * does-not-own: movement, teleport policy, network reconciliation or PvP rules
 * purpose: prove x/y can be observed safely before authority migration
 * public-api: CLI `node scripts/player-position-shadow-audit.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
function expect(value,message){if(value)console.log('PLAYER_POSITION_SHADOW_OK:',message);else{console.error('PLAYER_POSITION_SHADOW_FAIL:',message);failures++;}}
const source=read('src/core/player-position-shadow.js');
const index=read('index.html');
const manifest=JSON.parse(read('config/legacy-migration-manifest.json'));
expect(!/localPlayer\.(?:x|y)\s*=(?!=)/.test(source),'shadow contains no localPlayer x/y assignments');
expect(!/\bset(?:Timeout|Interval)\s*\(/.test(source),'shadow contains no timers');
expect(!/addEventListener\s*\(/.test(source),'shadow contains no event listeners');
expect(!/requestAnimationFrame\s*\(/.test(source),'shadow contains no second frame loop');
expect(!/(?:new\s+Error|Error\()\s*\.stack|\.stack\b/.test(source),'shadow contains no stack-trace sampling');
expect(source.includes("simulation.after('player-position-shadow',sample,10000)"),'shadow samples through KeloSimulation.after at low-impact end priority');
const sim=index.indexOf('src/core/simulation-extension-system.js'),observer=index.indexOf('src/core/player-position-shadow.js');
expect(sim>=0&&observer>sim,'position shadow boots after KeloSimulation');
expect((index.match(/src\/core\/player-position-shadow\.js/g)||[]).length===1,'position shadow boots exactly once');
const domain=manifest.domains?.playerPositionShadow;
expect(domain?.mode==='SHADOW','manifest keeps player position shadow in SHADOW');
expect(domain?.authority==='legacy-only','legacy x/y writers remain authoritative');
expect(domain?.owner==='KeloPlayerPositionShadow','manifest names the observer owner');

let afterHook=null;
const classList={contains(){return false;}};
const context={console:{log(){},warn(){},error(){}},localPlayer:{x:10,y:20},document:{body:{classList}},KeloSimulation:{after(owner,fn,priority){afterHook={owner,fn,priority};return 'sim-hook-audit';}}};
context.globalThis=context;context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'player-position-shadow.js'});
expect(!!context.KeloPlayerPositionShadow,'observer installs in isolated runtime');
expect(afterHook?.owner==='player-position-shadow'&&afterHook?.priority===10000,'observer registers one end-of-simulation hook');
afterHook.fn({dt:1/60});
context.localPlayer.x=14;context.localPlayer.y=23;afterHook.fn({dt:1/60});
let snap=context.KeloPlayerPositionShadow.snapshot();
expect(snap.changedFrames===1&&snap.continuousMoves===1&&snap.largeMoves===0,'small movement is classified without emitting a teleport');
context.localPlayer.x=240;context.localPlayer.y=260;afterHook.fn({dt:1/60});
snap=context.KeloPlayerPositionShadow.snapshot();
expect(snap.largeMoves===1&&snap.eventCount===1,'large displacement is retained in bounded evidence ring');
context.KeloPvPWorld={state:{mode:'pvp'}};afterHook.fn({dt:1/60});
snap=context.KeloPlayerPositionShadow.snapshot();
expect(snap.contextTransitions===1&&snap.eventCount===2&&snap.lastContext==='pvp:pvp','context transition is observable without position mutation');
expect(context.localPlayer.x===240&&context.localPlayer.y===260,'observer never changes player coordinates');
expect(context.KELO_PLAYER_POSITION_SHADOW_AUDIT?.readOnly===true&&context.KELO_PLAYER_POSITION_SHADOW_AUDIT?.gameLoop===false,'runtime audit advertises read-only no-loop contract');
if(failures){console.error(`Player position shadow audit failed with ${failures} violation(s).`);process.exit(1);}console.log('PLAYER_POSITION_SHADOW_AUDIT_OK');
