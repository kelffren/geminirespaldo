'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let saves=0;
function CustomEvent(type,opts){this.type=type;this.detail=opts&&opts.detail;}
const listeners=new Map();
const context={
  console,Date,Math,Map,Set,Object,Array,Number,String,JSON,Promise,setTimeout,clearTimeout,CustomEvent,
  STATE:{inventory:[],gold:500,equipmentSlots:{}},localPlayer:{id:'local_pioneer',name:'Audit Hero'},
  saveState(){saves++;},
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
  dispatchEvent(ev){for(const fn of listeners.get(ev.type)||[])fn(ev);return true;},
  window:{}
};
context.window=context;vm.createContext(context);
for(const file of ['src/systems/backpack-system.js','src/systems/container-system.js','src/systems/market-escrow-system.js','src/systems/equipment-item-catalog.js','src/systems/commerce-authority.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const B=context.KeloBackpack,K=context.KeloContainers,M=context.KeloMarketEscrow,C=context.KeloCommerceAuthority,W=context.KELO_EQUIPMENT_ITEM_CATALOG;
assert(B&&K&&M&&C&&W,'commerce dependencies and weapon catalog must load');assert.equal(K.version,'container-v1.4.0');assert.equal(C.version,'commerce-authority-v1.1.0');assert.equal(W.version,1);assert.equal(C.getMode(),'local-offline');assert.equal(K.getStats('trade_escrow').capacity,12);
function add(item){context.STATE.inventory.push(item);B.ensure();return item;}
function bag(id){return K.getSlots('backpack').find(s=>s.item&&(s.item.id===id||s.item.uid===id));}
function trade(id){return K.getSlots('trade_escrow').find(s=>s.item&&(s.item.id===id||s.item.uid===id));}
(async()=>{
  let r=await C.claimStall('stall_01','Audit goods');assert(r.ok);assert.equal(C.snapshot().stalls.find(x=>x.stallId==='stall_01').message,'Audit goods');

  add({id:'listing_local_1',templateId:'audit_listing',name:'Audit Listing',icon:'◆',kind:'material',quantity:1,maxStack:1,rarity:'Rare'});
  r=await C.createMarketListing('listing_local_1',1,99,{stallId:'stall_01'});assert(r.ok,'listing creation must succeed through authority');assert(!bag('listing_local_1'),'listed item must leave backpack');assert(M.getActiveListings().some(x=>x.listingId===r.listing.listingId&&x.price===99));
  r=await C.cancelMarketListing(r.listing.listingId);assert(r.ok&&bag('listing_local_1'),'cancelling must return physical item');

  const beforeBuy=context.STATE.gold;r=await C.buyListing('demo_listing_fire_01');assert(r.ok,'demo market purchase must commit');assert.equal(context.STATE.gold,beforeBuy-45);assert(context.STATE.inventory.some(x=>x.templateId==='fire_shard_demo'),'purchased item must enter backpack');assert(!C.snapshot().marketListings.some(x=>x.listingId==='demo_listing_fire_01'),'sold listing must disappear from active snapshot');

  // Equipment catalog -> Commerce authority -> Containers -> Backpack, preserving combat identity.
  const weaponListingId='demo_listing_armory_weapon_03',beforeWeapon=context.STATE.gold;
  assert(C.snapshot().marketListings.some(x=>x.listingId===weaponListingId&&x.item?.templateId==='starter_bow'),'catalog bow must be exposed by existing market snapshot');
  r=await C.buyListing(weaponListingId);assert(r.ok,'catalog weapon purchase must commit through Commerce');assert.equal(context.STATE.gold,beforeWeapon-120);
  const boughtBow=context.STATE.inventory.find(x=>x.templateId==='starter_bow');assert(boughtBow,'catalog weapon must enter existing backpack');assert.equal(boughtBow.kind,'equipment');assert.equal(boughtBow.slot,'weapon');assert.equal(boughtBow.weaponProfileId,'weapon.longbow');assert.equal(boughtBow.family,'bow');
  assert(!C.snapshot().marketListings.some(x=>x.listingId===weaponListingId),'sold catalog weapon must disappear from active snapshot');
  const persistedRows=context.STATE.commerce.demoListings.filter(x=>x.listingId===weaponListingId);assert.equal(persistedRows.length,1,'fixture merge must not duplicate sold catalog listing');assert.equal(persistedRows[0].status,'sold','sold catalog fixture must not revive during ensure/snapshot');

  add({id:'trade_local_1',templateId:'audit_trade',name:'Audit Trade Item',icon:'◈',kind:'material',quantity:1,maxStack:1,rarity:'Epic'});
  r=await C.createTrade({peerId:'audit_peer',peerName:'Audit Peer',demo:true});assert(r.ok);const tradeId=r.trade.tradeId;
  r=await C.addTradeItem('trade_local_1',1);assert(r.ok&&!bag('trade_local_1')&&trade('trade_local_1'),'offered item must live in trade escrow');
  r=await C.setTradeGold(100);assert(r.ok&&r.trade.offers.local.gold===100);
  await C.setTradeReady(true);r=await C.demoPeerReady(true);assert(r.ok&&r.trade.status==='FINAL_REVIEW','both ready enters final review');
  r=await C.setTradeGold(90);assert(r.ok&&!r.trade.offers.local.ready&&!r.trade.offers.peer.ready&&!r.trade.offers.local.finalAccepted&&!r.trade.offers.peer.finalAccepted,'offer mutation must reset both confirmations');
  await C.setTradeReady(true);await C.demoPeerReady(true);r=await C.finalAcceptTrade(true);assert(r.ok&&C.snapshot().activeTrade,'first final acceptance alone must not commit');
  const goldBeforeTrade=context.STATE.gold;r=await C.demoPeerFinalAccept(true);assert(r.ok&&r.status==='COMPLETED','second final acceptance must atomically commit');assert.equal(r.tradeId,tradeId);assert.equal(context.STATE.gold,goldBeforeTrade-90+75);assert(!trade('trade_local_1'),'outgoing item must leave local escrow after commit');assert(!bag('trade_local_1'),'outgoing item must not remain local');assert(context.STATE.inventory.some(x=>x.templateId==='trade_crystal_demo'),'incoming peer item must enter backpack');
  const tx=C.snapshot().transactionHistory.find(x=>x.transactionId===r.transactionId);assert(tx&&tx.status==='committed'&&tx.goldOut===90&&tx.goldIn===75,'transaction log must reconcile trade');assert(K.auditIdentities().ok,'identity invariant must hold after trade');

  add({id:'trade_cancel_1',templateId:'cancel_test',name:'Cancel Test',kind:'material',quantity:1,maxStack:1});await C.createTrade({peerId:'audit_peer_2',peerName:'Audit Peer 2',demo:true});await C.addTradeItem('trade_cancel_1',1);assert(trade('trade_cancel_1'));r=await C.cancelTrade();assert(r.ok&&bag('trade_cancel_1')&&!trade('trade_cancel_1'),'cancel must return escrowed items');

  const cp=K.checkpoint();const incoming={id:'external_atomic_1',templateId:'external_atomic',name:'External Atomic',kind:'material',quantity:1,maxStack:1};r=K.receiveItem('backpack',incoming,{persist:false,allowMerge:false,preserveIdentity:true});assert(r.ok&&bag('external_atomic_1'));K.restoreCheckpoint(cp,{persist:false});assert(!bag('external_atomic_1'),'container checkpoint rollback must restore pre-transaction state');assert(K.auditIdentities().ok);

  assert(saves>0);console.log('PASS commerce-system-audit',JSON.stringify({commerce:C.version,container:K.version,market:M.version,weaponCatalog:W.version,doubleConfirmation:true,mutationReset:true,atomicTrade:true,marketPurchase:true,catalogWeaponPurchase:true,soldFixtureDoesNotRevive:true,stallClaim:true,rollback:true,saves}));
})().catch(err=>{console.error(err);process.exitCode=1;});
