#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / REGIONAL LOGISTICS
 * owner: Regional Logistics CI
 * keys: AUDIT ECONOMY LOGISTICS CARAVAN FACTION CONTAINER COMBAT
 * purpose: valida integración real de economía regional, contenedores, carretas, facciones y combate
 * public-api: npm run audit:logistics
 * consumes: Regional Logistics owners
 * state-owned: none
 * do-not: no depender de navegador ni red
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
function load(s,file){new vm.Script(fs.readFileSync(path.join(ROOT,file),'utf8'),{filename:file}).runInContext(s);}
function sandbox(){
  const listeners=new Map(),s={console,Date,Math,JSON,Map,Set,Object,Array,Number,String,Boolean,Promise,Infinity,NaN,parseInt,parseFloat,isFinite,setTimeout,clearTimeout,performance:{now:()=>Date.now()},STATE:{gold:100000,kc:0,inventory:[],equipped:[]},localPlayer:{id:'local_pioneer',name:'Audit',x:1485,y:1645,vx:0,vy:0,hp:100,maxHp:100,radius:20},simulatedPlayers:[],input:{normX:0,normY:0},saveCount:0,KeloEquipment:{isEquipped(){return false;}},KeloEvents:{on(n,fn){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(fn);return()=>listeners.get(n).delete(fn);},emit(n,p){for(const fn of listeners.get(n)||[])fn(p);}},KeloMovement:{after(){return true;}},KeloRender:{afterFrame(){return true;}},KeloCamera:{worldToScreen(x,y){return{x,y};},getEffectiveZoom(){return 1;}},ctx:{save(){},restore(){},translate(){},scale(){},fillRect(){},strokeRect(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}},innerWidth:390,innerHeight:844};
  s.saveState=()=>{s.saveCount++;};
  s.KeloBackpack={ensure(){if(!s.STATE.backpack)s.STATE.backpack={capacity:20,slots:new Array(20).fill(null)};}};
  s.window=s;s.globalThis=s;return vm.createContext(s);
}
function approx(a,b,tol,msg){assert(Math.abs(a-b)<=tol,(msg||'values differ')+`: ${a} vs ${b}`);}
async function main(){
  const s=sandbox();
  ['src/systems/regional-economy-math.js','src/systems/container-system.js','src/systems/regional-economy-system.js','src/systems/faction-clan-system.js','src/systems/caravan-system.js'].forEach(f=>load(s,f));
  const E=s.KeloRegionalEconomy,C=s.KeloContainers,F=s.KeloFactions,V=s.KeloCaravans,M=s.KeloRegionalEconomyMath;
  assert(E&&C&&F&&V&&M,'regional logistics owners must load');
  assert.strictEqual(typeof C.registerContainer,'function');assert.strictEqual(typeof C.removeContainer,'function');assert.strictEqual(typeof C.getContainer,'function');

  const easy={travelTime:15,pvpExposure:.1,terrainDanger:.1,chokePointRisk:.1,npcThreat:.1,eventRisk:.1},danger={travelTime:15,pvpExposure:.9,terrainDanger:.8,chokePointRisk:.8,npcThreat:.9,eventRisk:.8};
  assert(M.riskBreakdown(danger).score>M.riskBreakdown(easy).score);assert(M.economicEdgeCost(danger)>M.economicEdgeCost(easy));assert(M.propagatedDemand(30,M.economicEdgeCost(danger),30)<M.propagatedDemand(30,M.economicEdgeCost(easy),30));

  E.dev.setStock('ignis','coal',.50,'T1');const coal0=E.quote('ignis','coal','T1',{skipRefresh:true}).stock;const prod=E.dev.advanceHours('ignis',1);assert(prod.ok&&prod.produced.coal>499);approx(E.quote('ignis','coal','T1',{skipRefresh:true}).stock-coal0,500,1.5,'production');
  E.dev.setStock('verdantia','stone',.90,'T1');const abundant=E.quote('verdantia','stone','T1',{skipRefresh:true});E.dev.setStock('verdantia','stone',.30,'T1');assert(E.quote('verdantia','stone','T1',{skipRefresh:true}).unitPrice>abundant.unitPrice,'scarcity pricing');

  E.dev.setStock('verdantia','apple',.70,'T1');const before=E.quote('verdantia','apple','T1',{skipRefresh:true}).stock;assert((await E.request('BuyResource',{settlementId:'verdantia',resourceId:'apple',tier:'T1',quantity:10})).ok);const afterBuy=E.quote('verdantia','apple','T1',{skipRefresh:true}).stock;approx(before-afterBuy,10,.01,'buy stock');let apple=C.getSlots('backpack').find(x=>x.item&&x.item.resourceId==='apple');assert(apple);const qty=Number(apple.item.quantity);assert((await E.request('SellResource',{settlementId:'verdantia',itemKey:apple.key,quantity:5})).ok);if(qty>5){apple=C.getSlots('backpack').find(x=>x.item&&x.item.resourceId==='apple');assert(apple&&Number(apple.item.quantity)===qty-5,'partial extract');}

  const emergency=E.dev.setStock('ignis','apple',.08,'T1');assert(emergency.contract&&emergency.contract.status==='ACTIVE');const cid=emergency.contract.id,reward=emergency.contract.currentReward,stock=E.quote('ignis','apple','T1',{skipRefresh:true}).stock;const supply=C.receiveItem('backpack',{id:'audit_supply',templateId:'resource_apple',kind:'resource',resourceId:'apple',tier:'T1',quantity:100,maxStack:200,weight:.35},{persist:false,preserveIdentity:true});assert(supply.ok);const delivered=await E.request('DeliverSupplyContract',{contractId:cid,itemKey:supply.itemKey,quantity:100});assert(delivered.ok&&delivered.stock>stock&&delivered.contract.currentReward<reward);E.dev.setStock('ignis','apple',.50,'T1');assert.strictEqual(E.getContract(cid).status,'COMPLETED');

  E.dev.setStock('ignis','apple',.08,'T1');E.dev.setStock('verdantia','apple',.70,'T1');E.dev.setStock('ferrum','apple',.70,'T1');const d1=E.getEconomicDistance('verdantia','ignis'),d2=E.getEconomicDistance('ferrum','ignis');assert(d2.distance>d1.distance);const risk0=E.getRouteRisk('route_ignis_verdantia').score,raid=await E.request('ActivateRaiderBand',{routeId:'route_ignis_verdantia',ambushNodeId:'forest_iv',npcThreat:.2,eventRisk:.4});assert(raid.ok&&raid.risk.score>risk0);await E.request('EndWorldEvent',{eventId:raid.event.id});approx(E.getRouteRisk('route_ignis_verdantia').score,risk0,.000001,'risk restore');

  const attach=await V.request('AttachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'});assert(attach.ok&&attach.cart.state==='ATTACHED',JSON.stringify(attach));assert.strictEqual(V.canActorAttack('local_pioneer'),false);assert.strictEqual((await V.request('BeginClaimCart',{cartId:'cart_demo_1',actorId:'enemy'})).error,'CART_ATTACHED_PROTECTED');const resource=C.getSlots('backpack').find(x=>x.item&&x.item.kind==='resource');assert(resource);assert((await V.request('LoadCart',{cartId:'cart_demo_1',actorId:'local_pioneer',itemKey:resource.key,quantity:1})).ok);assert.strictEqual(V.inspectCart('cart_demo_1','enemy').cargo,'UNKNOWN');assert(V.inspectCart('cart_demo_1','local_pioneer').cargoVisible);assert((await V.request('DetachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'})).ok);const claim=await V.request('BeginClaimCart',{cartId:'cart_demo_1',actorId:'enemy'});assert(claim.ok);const stolen=V.dev.finishClaim('cart_demo_1','enemy');assert(stolen.ok&&stolen.cart.currentControllerId==='enemy'&&stolen.cart.owner.id==='local_pioneer');

  assert((await F.request('JoinFaction',{playerId:'local_pioneer',factionId:'solari'})).ok);const clan=await F.request('CreateClan',{playerId:'local_pioneer',name:'Audit Clan',tag:'AUD'});assert(clan.ok&&clan.clan.factionId==='solari');assert(F.hasPermission(clan.clan.id,'local_pioneer','MANAGE_CARAVANS'));

  V.dev.killCarrier('cart_demo_1');s.localPlayer.x=V.getCart('cart_demo_1').position.x;s.localPlayer.y=V.getCart('cart_demo_1').position.y;assert((await V.request('AttachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'})).ok);s.KeloCombatSchema={events:{ATTACK_STARTED:'a',ATTACK_RESOLVED:'b',HIT_CONFIRMED:'c',DAMAGE_APPLIED:'combat:damage_applied',ENTITY_KILLED:'combat:entity_killed'}};s.KeloHitResolver={withinRange(){return{hit:true,distance:1,range:10};}};s.KeloDamageResolver={apply(t,a){t.hp-=a;return{amount:a,requested:a,absorbed:0,hp:t.hp,killed:t.hp<=0};}};load(s,'src/systems/combat/combat-engine.js');const target={id:'enemy',x:s.localPlayer.x+1,y:s.localPlayer.y,hp:100};assert.strictEqual(s.KeloCombatEngine.attack({attacker:s.localPlayer,target,profile:{range:10,damage:10,cooldown:1}}).reason,'ACTION_BLOCKED_BY_CART');s.KeloEvents.emit('combat:entity_killed',{targetActorId:'local_pioneer',target:s.localPlayer});assert.strictEqual(V.getCart('cart_demo_1').state,'DROPPED');

  const persisted=JSON.parse(JSON.stringify(s.STATE));s.STATE=persisted;assert(V.getCart('cart_demo_1')&&C.getContainer('cart_inv_cart_demo_1'));assert(C.auditIdentities().ok);
  console.log(JSON.stringify({ok:true,version:E.version,checks:{production:true,scarcity:true,transactions:true,partialExtract:true,contracts:true,risk:true,raiders:true,carts:true,hiddenCargo:true,factions:true,clans:true,persistence:true,combatCartLock:true,identity:true}},null,2));
}
main().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
