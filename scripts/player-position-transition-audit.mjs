/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / PLAYER POSITION
 * owner: Player Position Transition Audit
 * owns: certification of transition-only position owner and migrated callers
 * does-not-own: movement feel, dash, clamps, physics or online reconciliation
 * purpose: prove KeloPlayerPosition centralizes migrated teleports/restores without claiming continuous x/y authority
 * public-api: CLI `node scripts/player-position-transition-audit.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
function expect(value,message){if(value)console.log('PLAYER_POSITION_TRANSITION_OK:',message);else{console.error('PLAYER_POSITION_TRANSITION_FAIL:',message);failures++;}}
function directWrites(text,key){return (text.match(new RegExp('\\blocalPlayer\\.'+key+'\\s*=(?!=)','g'))||[]).length;}

const owner=read('src/core/player-position-system.js');
const engineC=read('engine-c.js');
const parcelMeta=read('src/ui/builder-parcel-meta.js');
const builderUx=read('src/ui/builder-ux-v2.js');
const house=read('src/instances/instance-runtime-bridge.js');
const market=read('src/instances/market-instance.js');
const index=read('index.html');
const manifest=JSON.parse(read('config/legacy-migration-manifest.json'));

expect(directWrites(owner,'x')===1&&directWrites(owner,'y')===1,'transition owner contains exactly one localPlayer x/y write pair');
expect(!/setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|addEventListener\s*\(/.test(owner),'transition owner creates no timers/listeners/RAF');
expect(owner.includes("scope:'transition-only'"),'transition owner declares narrow scope');
expect(directWrites(engineC,'x')===0&&directWrites(engineC,'y')===0,'engine-c quick travel no longer writes localPlayer x/y directly');
expect(engineC.includes('KeloPlayerPosition.teleport'),'engine-c quick travel uses KeloPlayerPosition');
expect(directWrites(parcelMeta,'x')===0&&directWrites(parcelMeta,'y')===0,'parcel door warp no longer writes localPlayer x/y directly');
expect(parcelMeta.includes('KeloPlayerPosition.teleport'),'parcel door warp uses KeloPlayerPosition');
expect(directWrites(builderUx,'x')===0&&directWrites(builderUx,'y')===0,'builder parcel scope no longer writes localPlayer x/y directly');
expect(builderUx.includes("KeloPlayerPosition.teleport")&&builderUx.includes("KeloCamera.setTarget"),'builder parcel scope delegates position and camera transitions');
expect(house.includes("KeloPlayerPosition.teleport")&&house.includes("KeloPlayerPosition.restore"),'house enter/leave transitions use KeloPlayerPosition');
expect(directWrites(house,'x')===1&&directWrites(house,'y')===1,'house keeps only its continuous clamp writer pair for later migration');
expect(market.includes("KeloPlayerPosition.teleport")&&market.includes("KeloPlayerPosition.restore"),'market transition paths use KeloPlayerPosition');
expect(directWrites(market,'x')===2&&directWrites(market,'y')===2,'market keeps only continuous selling/bounds clamp writers for later migration');
const ownerIndex=index.indexOf('src/core/player-position-system.js');
const engineCIndex=index.indexOf('engine-c.js');
expect(ownerIndex>=0&&engineCIndex>ownerIndex,'position transition owner boots before engine-c consumers');
expect(manifest.domains?.playerPositionTransitions?.mode==='NEW','manifest activates transition-only position slice as NEW');
expect(manifest.domains?.playerPositionTransitions?.scope==='transition-only','manifest limits NEW claim to transition-only scope');
expect(manifest.domains?.playerPositionTransitions?.migratedCallers?.includes('src/ui/builder-ux-v2.js'),'manifest records builder UX transition migration');
expect(manifest.domains?.movement?.mode==='LEGACY','continuous movement remains LEGACY');
expect(manifest.domains?.playerPositionShadow?.mode==='SHADOW','position observability remains SHADOW');

const emitted=[];
const context={console:{log(){},warn(){},error(){}},localPlayer:{x:10,y:20,vx:4,vy:-3},KeloEvents:{emit(name,event){emitted.push({name,event});}}};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(owner,context,{filename:'player-position-system.js'});
expect(!!context.KeloPlayerPosition,'KeloPlayerPosition installs in isolated runtime');
const saved=context.KeloPlayerPosition.capture();
const moved=context.KeloPlayerPosition.teleport(110,220,{source:'audit:teleport',stopMotion:true});
expect(context.localPlayer.x===110&&context.localPlayer.y===220,'teleport applies atomic x/y transition');
expect(context.localPlayer.vx===0&&context.localPlayer.vy===0,'optional stopMotion clears velocity');
expect(moved.source==='audit:teleport'&&moved.distance>0,'transition evidence records source and distance');
context.KeloPlayerPosition.restore(saved,{source:'audit:restore'});
expect(context.localPlayer.x===10&&context.localPlayer.y===20,'restore returns to captured position');
expect(context.KeloPlayerPosition.snapshot().transitions===2&&context.KeloPlayerPosition.snapshot().restores===1,'owner tracks bounded transition evidence');
expect(emitted.length===2&&emitted.every(e=>e.name==='PLAYER_POSITION_TRANSITION'),'transition events are emitted without listeners owned here');

if(failures){console.error(`Player position transition audit failed with ${failures} violation(s).`);process.exit(1);}
console.log('PLAYER_POSITION_TRANSITION_MIGRATION_OK');
