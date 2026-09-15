/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / PLAYER STATE
 * owner: Player State Owner Migration Audit
 * owns: certification that all localPlayer hp/maxHp writes cross KeloPlayerState boundary
 * does-not-own: combat rules, networking policy, arena rules or movement
 * purpose: prove accessor compatibility + explicit modern damage routing before playerState can be NEW
 * public-api: CLI `node scripts/player-state-owner-migration-audit.mjs`
 * reuse: Legacy Observatory CI
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
function fail(message){console.error('PLAYER_STATE_AUDIT_FAIL:',message);failures++;}
function ok(message){console.log('PLAYER_STATE_AUDIT_OK:',message);}
function expect(condition,message){if(condition)ok(message);else fail(message);}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}

const source=read('src/core/player-state-system.js');
const damageSource=read('src/systems/combat/damage-resolver.js');
const index=read('index.html');
const observatory=read('scripts/legacy-observatory.mjs');
const manifest=JSON.parse(read('config/legacy-migration-manifest.json'));

expect(source.includes("Object.defineProperty(player,'hp'"),'hp is guarded by an accessor boundary');
expect(source.includes("Object.defineProperty(player,'maxHp'"),'maxHp is guarded by an accessor boundary');
expect(source.includes('configurable:false'),'vitals boundary cannot be replaced at runtime');
expect(!/\bset(?:Timeout|Interval)\s*\(/.test(source),'player state owner has no timers');
expect(!/addEventListener\s*\(/.test(source),'player state owner has no event listeners');
expect(!/requestAnimationFrame\s*\(/.test(source),'player state owner has no game loop');
expect(damageSource.includes('KeloPlayerState.isLocal(target)'),'modern damage resolver identifies the local player through the state owner');
expect(damageSource.includes("KeloPlayerState.setHp(afterHp,{source:'KeloDamageResolver'})"),'modern local combat damage delegates to KeloPlayerState');

const engineA=index.indexOf('engine-a.js');
const playerState=index.indexOf('src/core/player-state-system.js');
const engineB=index.indexOf('engine-b.js');
expect(engineA>=0&&playerState>engineA&&engineB>playerState,'player state owner boots after localPlayer creation and before legacy PvP consumers');
expect((index.match(/src\/core\/player-state-system\.js/g)||[]).length===1,'player state owner boots exactly once');

expect(observatory.includes("'localPlayer.hp':Object.freeze({owner:'KeloPlayerState'"),'Observatory records hp accessor-routed authority');
expect(observatory.includes("'localPlayer.maxHp':Object.freeze({owner:'KeloPlayerState'"),'Observatory records maxHp accessor-routed authority');
expect(manifest.domains?.playerState?.mode==='NEW','manifest promotes only the certified local vitals domain to NEW');
expect(manifest.domains?.playerState?.owner==='KeloPlayerState','manifest names KeloPlayerState as vitals owner');
expect(manifest.domains?.playerState?.scope==='local-player-vitals-only','manifest does not overclaim broader player state ownership');

const context={console:{warn(){},log(){},error(){}},localPlayer:{id:'local',hp:100,maxHp:100,keloShield:0}};
vm.createContext(context);
vm.runInContext(source,context,{filename:'player-state-system.js'});
const api=context.KeloPlayerState;
expect(!!api,'KeloPlayerState installs in isolated runtime');
expect(context.localPlayer.hp===100&&context.localPlayer.maxHp===100,'bootstrap vitals are preserved');

context.localPlayer.hp=140;
expect(context.localPlayer.hp===100,'legacy direct hp assignment is clamped through accessor');
context.localPlayer.hp=-5;
expect(context.localPlayer.hp===0,'legacy negative hp assignment is clamped through accessor');
context.localPlayer.maxHp=160;
context.localPlayer.hp=150;
expect(context.localPlayer.maxHp===160&&context.localPlayer.hp===150,'legacy maxHp then hp assignments route through owner');
context.localPlayer.maxHp=80;
expect(context.localPlayer.maxHp===80&&context.localPlayer.hp===80,'lowering maxHp clamps current hp');

api.setVitals({maxHp:120,hp:115},{source:'audit:set-vitals'});
expect(context.localPlayer.maxHp===120&&context.localPlayer.hp===115,'setVitals applies maxHp before hp');
const damage=api.damage(30,{source:'audit:damage'});
expect(context.localPlayer.hp===85&&damage.amount===30&&!damage.killed,'damage API mutates local hp through owner');
api.restoreFull({source:'audit:restore'});
expect(context.localPlayer.hp===120,'restoreFull restores hp to maxHp');
api.applyAuthoritative({maxHp:90,hp:88},{source:'audit:authority'});
expect(context.localPlayer.maxHp===90&&context.localPlayer.hp===88,'authoritative reconciliation uses the same boundary');

const alias=context.localPlayer;
alias.hp=77;
expect(context.localPlayer.hp===77,'aliased target.hp assignment is intercepted by the same accessor');
expect(api.snapshot().directCompatibilityWrites>=6,'compatibility writes are observable in owner audit counters');

vm.runInContext(damageSource,context,{filename:'damage-resolver.js'});
const beforeLocal=context.localPlayer.hp;
const localResult=context.KeloDamageResolver.apply(context.localPlayer,12,{source:'audit'});
expect(context.localPlayer.hp===beforeLocal-12&&localResult.hp===beforeLocal-12,'modern damage resolver routes local hp through KeloPlayerState');
expect(api.snapshot().lastSource==='KeloDamageResolver','modern damage route is attributed to KeloDamageResolver');
const enemy={id:'enemy',hp:50,maxHp:50,keloShield:0};
context.KeloDamageResolver.apply(enemy,7,{source:'audit'});
expect(enemy.hp===43,'generic actor hp remains owned by combat resolver path');

if(failures){console.error(`Player state owner migration audit failed with ${failures} violation(s).`);process.exit(1);}
console.log('PLAYER_STATE_OWNER_MIGRATION_OK');
