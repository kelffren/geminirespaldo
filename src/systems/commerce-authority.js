/* KELO-INDEX
 * area: ECON / COMMERCE
 * owner: KeloCommerceAuthority
 * keys: TRADE MARKET STALL ESCROW AUTHORITY OFFLINE ONLINE TRANSACTION
 * purpose: frontera única para comercio valioso; UI solicita intenciones y el adapter activo valida/ejecuta
 * public-api: KeloCommerceAuthority.request/snapshot/onChange + helpers de trade/market/stall
 * consumes: KeloContainers, KeloMarketEscrow, KeloNetAuthority, KELO_EQUIPMENT_ITEM_CATALOG, STATE/saveState
 * state-owned: sesiones de trade offline, puestos, fixtures demo y log local de transacciones
 * extension-points: installAuthorityAdapter o KeloNetAuthority.requestCommerce para servidor autoritativo
 * reuse: trade directo, puestos, compras de mercado y futuras subastas/regalos deben entrar por este owner
 * online: si KeloNetAuthority está online NO existe fallback local; el servidor decide estado valioso
 * do-not: la UI no mueve items/oro directamente; market_escrow no se reutiliza como trade_escrow
 */
(function(root){
'use strict';
const VERSION='commerce-authority-v1.1.0';
const SCHEMA=1;
const LOCAL_ID='local_pioneer';
const MAX_HISTORY=60;
const listeners=new Set();
let injectedAuthority=null;
let lastServerSnapshot=null;
let initialized=false;
let recovering=false;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
const id=(prefix)=>prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
function save(){if(typeof saveState==='function')saveState();}
function playerId(){return String(root.keloNet?.playerKey||root.keloNet?.id||LOCAL_ID);}
function playerName(){return String((typeof localPlayer!=='undefined'&&localPlayer&&localPlayer.name)||'Kelo');}
function itemIdentity(item){if(root.KeloMarketEscrow?.itemIdentity)return root.KeloMarketEscrow.itemIdentity(item);if(!item)return null;return String(item.id||item.uid||item._backpackId||'')||null;}
function describe(item){if(!item)return null;let d=null;try{d=root.KeloBackpack?.describeItem?.(item,0)||null;}catch(_){ }return{name:String(d?.name||item.name||item.templateId||item.typeId||'Objeto'),icon:String(d?.icon||item.icon||'▪'),rarity:String(d?.rarity||item.rarity||item.tier||'Normal'),quantity:Math.max(1,Math.floor(Number(item.quantity)||1)),kind:String(item.kind||d?.category||'item'),instanceId:itemIdentity(item)};}
function armoryDemoListings(){
  const catalog=root.KELO_EQUIPMENT_ITEM_CATALOG;if(!catalog?.marketOffers||typeof catalog.createItem!=='function')return[];
  return catalog.marketOffers.map((offer,index)=>{
    const item=catalog.createItem(offer.templateId,{id:'demo_armory_'+offer.templateId,createdAt:1});if(!item)return null;
    return {listingId:'demo_listing_'+offer.offerId,ownerId:'offline_vendor_ron',sellerName:'Ron',stallId:'stall_05',price:Math.max(1,Math.floor(Number(offer.price)||1)),quantity:1,status:'active',demo:true,item};
  }).filter(Boolean);
}
function defaultDemoListings(){
  return [
    {listingId:'demo_listing_fire_01',ownerId:'offline_vendor_maya',sellerName:'Maya',stallId:'stall_02',price:45,quantity:1,status:'active',demo:true,item:{id:'demo_market_fire_01',templateId:'fire_shard_demo',name:'Fragmento de Fuego',icon:'🔥',kind:'material',quantity:1,maxStack:1,rarity:'Rare'}},
    {listingId:'demo_listing_ore_01',ownerId:'offline_vendor_maya',sellerName:'Maya',stallId:'stall_02',price:25,quantity:3,status:'active',demo:true,item:{id:'demo_market_ore_01',templateId:'moon_ore_demo',name:'Mineral Lunar',icon:'◆',kind:'material',quantity:3,maxStack:20,rarity:'Uncommon'}}
  ].concat(armoryDemoListings());
}
function defaultStalls(){return{
  stall_02:{stallId:'stall_02',ownerId:'offline_vendor_maya',sellerName:'Maya',message:'🔥 Piedras y materiales',demo:true,claimedAt:now()},
  stall_05:{stallId:'stall_05',ownerId:'offline_vendor_ron',sellerName:'Ron',message:'⚔️ Arsenal de armas',demo:true,claimedAt:now()}
};}
function ensureState(){
  if(typeof STATE==='undefined')return null;
  let changed=false;
  if(!STATE.commerce||typeof STATE.commerce!=='object'){
    STATE.commerce={schemaVersion:SCHEMA,activeTrade:null,tradeHistory:[],transactionHistory:[],stallClaims:defaultStalls(),demoListings:defaultDemoListings(),transactionSeq:0};changed=true;
  }
  const s=STATE.commerce;
  if(s.schemaVersion!==SCHEMA){s.schemaVersion=SCHEMA;changed=true;}
  if(!Array.isArray(s.tradeHistory)){s.tradeHistory=[];changed=true;}
  if(!Array.isArray(s.transactionHistory)){s.transactionHistory=[];changed=true;}
  if(!s.stallClaims||typeof s.stallClaims!=='object'){s.stallClaims=defaultStalls();changed=true;}
  if(!Array.isArray(s.demoListings)){s.demoListings=defaultDemoListings();changed=true;}
  if(!Number.isFinite(Number(s.transactionSeq))){s.transactionSeq=0;changed=true;}
  // Fixtures are recoverable development data, never authoritative ownership.
  const defaults=defaultStalls();Object.keys(defaults).forEach(k=>{if(!s.stallClaims[k]){s.stallClaims[k]=defaults[k];changed=true;}else if(s.stallClaims[k]?.demo===true&&s.stallClaims[k].message!==defaults[k].message){s.stallClaims[k].message=defaults[k].message;changed=true;}});
  const fixtureListings=defaultDemoListings();fixtureListings.forEach(row=>{if(!s.demoListings.some(x=>x&&x.listingId===row.listingId)){s.demoListings.push(row);changed=true;}});
  if(changed)save();
  if(!initialized&&!recovering){initialized=true;recoverInterruptedTrade();}
  return s;
}
function tradeEscrowSlots(){return root.KeloContainers?.getSlots?.('trade_escrow')||[];}
function recoverInterruptedTrade(){
  if(recovering||!root.KeloContainers||typeof STATE==='undefined')return;
  recovering=true;
  try{
    const s=STATE.commerce;if(!s)return;
    const slots=tradeEscrowSlots().filter(x=>x.item);
    if(!slots.length){if(s.activeTrade){s.activeTrade=null;save();}return;}
    let ok=true;
    slots.forEach(slot=>{const r=root.KeloContainers.transferItem('trade_escrow','backpack',slot.key,null,{persist:false,allowMerge:false});if(!r.ok)ok=false;});
    if(ok){s.activeTrade=null;save();}
  }finally{recovering=false;}
}
function getOwnListings(){
  const rows=root.KeloMarketEscrow?.getActiveListings?.()||[];
  return rows.map(lst=>{
    const slot=(root.KeloContainers?.getSlots?.('market_escrow')||[]).find(s=>s.item&&itemIdentity(s.item)===String(lst.escrowItemInstanceId));
    return Object.assign({},clone(lst),{ownerId:String(lst.ownerId||LOCAL_ID),sellerName:playerName(),stallId:stallForOwner(LOCAL_ID)?.stallId||null,demo:false,item:slot?.item?clone(slot.item):null});
  });
}
function allListings(){const s=ensureState();return getOwnListings().concat((s?.demoListings||[]).filter(x=>x&&x.status==='active').map(clone));}
function stallForOwner(ownerId){const claims=ensureState()?.stallClaims||{};return Object.values(claims).find(x=>x&&String(x.ownerId)===String(ownerId))||null;}
function publicTrade(t){return t?clone(t):null;}
function snapshot(){
  if(getMode()==='server-authoritative'&&lastServerSnapshot)return clone(lastServerSnapshot);
  const s=ensureState();
  return {version:VERSION,mode:'local-offline',player:{id:LOCAL_ID,name:playerName(),gold:Math.max(0,Math.floor(Number(STATE?.gold)||0))},activeTrade:publicTrade(s?.activeTrade),marketListings:allListings(),stalls:Object.values(s?.stallClaims||{}).map(clone),tradeHistory:clone((s?.tradeHistory||[]).slice(-12)),transactionHistory:clone((s?.transactionHistory||[]).slice(-20))};
}
function emit(reason,result){
  const snap=snapshot();const payload={reason:reason||null,result:clone(result||null),snapshot:snap};
  listeners.forEach(fn=>{try{fn(payload);}catch(err){console.error('[Kelo commerce] listener',err);}});
  try{root.KeloEvents?.emit?.('commerce:changed',payload);}catch(_){ }
  try{root.dispatchEvent?.(new CustomEvent('kelo:commerce-changed',{detail:payload}));}catch(_){ }
  return result;
}
function nextTransaction(kind){const s=ensureState();s.transactionSeq=Math.max(0,Math.floor(Number(s.transactionSeq)||0))+1;return 'txn_'+String(kind||'commerce')+'_'+Date.now().toString(36)+'_'+s.transactionSeq.toString(36);}
function appendTransaction(row){const s=ensureState();s.transactionHistory.push(clone(row));if(s.transactionHistory.length>MAX_HISTORY)s.transactionHistory.splice(0,s.transactionHistory.length-MAX_HISTORY);}
function backpackItem(instanceId){return (root.KeloContainers?.getSlots?.('backpack')||[]).find(s=>s.item&&itemIdentity(s.item)===String(instanceId))||null;}
function escrowTradeItem(instanceId){return tradeEscrowSlots().find(s=>s.item&&itemIdentity(s.item)===String(instanceId))||null;}
function resetTradeConfirmations(t){if(!t)return;t.offers.local.ready=false;t.offers.peer.ready=false;t.offers.local.finalAccepted=false;t.offers.peer.finalAccepted=false;t.status='OPEN';t.revision=(Number(t.revision)||0)+1;t.updatedAt=now();}
function validateTrade(t){
  if(!t||!t.tradeId)return{ok:false,error:'TRADE_NOT_FOUND'};
  if(Math.max(0,Math.floor(Number(STATE.gold)||0))<Math.max(0,Math.floor(Number(t.offers.local.gold)||0)))return{ok:false,error:'INSUFFICIENT_GOLD'};
  for(const row of t.offers.local.items){if(!escrowTradeItem(row.instanceId))return{ok:false,error:'TRADE_ESCROW_ITEM_MISSING',instanceId:row.instanceId};}
  return{ok:true};
}
function commitTrade(t){
  const C=root.KeloContainers;if(!C?.checkpoint||!C?.restoreCheckpoint||!C?.receiveItem||!C?.extractItem)return{ok:false,error:'CONTAINER_TRANSACTION_API_UNAVAILABLE'};
  const valid=validateTrade(t);if(!valid.ok)return valid;
  const checkpoint=C.checkpoint(),goldBefore=Math.max(0,Math.floor(Number(STATE.gold)||0)),commerceBefore=clone(STATE.commerce),transactionId=nextTransaction('trade');
  try{
    const incoming=[];
    for(const offered of t.offers.peer.items){
      const item=clone(offered.item);if(!item)throw new Error('PEER_ITEM_MISSING');
      const base=itemIdentity(item)||'remote_item';
      if(item.id!=null)item.id=base+'_'+transactionId;else if(item.uid!=null)item.uid=base+'_'+transactionId;else item._backpackId=base+'_'+transactionId;
      const r=C.receiveItem('backpack',item,{persist:false,allowMerge:false,preserveIdentity:true});if(!r.ok)throw new Error(r.error||'INCOMING_ITEM_FAILED');incoming.push(describe(r.item||item));
    }
    const outgoing=[];
    for(const offered of t.offers.local.items){const slot=escrowTradeItem(offered.instanceId);if(!slot)throw new Error('TRADE_ESCROW_ITEM_MISSING');const r=C.extractItem('trade_escrow',slot.key,{persist:false});if(!r.ok)throw new Error(r.error||'OUTGOING_ITEM_FAILED');outgoing.push(describe(r.item));}
    const give=Math.max(0,Math.floor(Number(t.offers.local.gold)||0)),receive=Math.max(0,Math.floor(Number(t.offers.peer.gold)||0));
    if(give>goldBefore)throw new Error('INSUFFICIENT_GOLD');STATE.gold=goldBefore-give+receive;
    const completed=clone(t);completed.status='COMPLETED';completed.completedAt=now();completed.transactionId=transactionId;
    const s=ensureState();s.activeTrade=null;s.tradeHistory.push(completed);if(s.tradeHistory.length>MAX_HISTORY)s.tradeHistory.splice(0,s.tradeHistory.length-MAX_HISTORY);
    appendTransaction({transactionId,type:'player_trade',status:'committed',createdAt:completed.completedAt,peerId:t.participants.peer.id,outgoing,incoming,goldOut:give,goldIn:receive});
    save();return{ok:true,status:'COMPLETED',tradeId:t.tradeId,transactionId,gold:STATE.gold,outgoing,incoming};
  }catch(err){C.restoreCheckpoint(checkpoint,{persist:false});STATE.gold=goldBefore;STATE.commerce=commerceBefore;save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function createTrade(data){
  const s=ensureState();if(s.activeTrade)return{ok:false,error:'TRADE_ALREADY_ACTIVE',trade:publicTrade(s.activeTrade)};
  const peerId=String(data.peerId||'offline_demo_peer'),peerName=String(data.peerName||'Mercader Demo'),demo=!!data.demo;
  const tradeId=id('trade');
  const peerItems=demo?[{instanceId:'demo_trade_crystal_'+tradeId,item:{id:'demo_trade_crystal',templateId:'trade_crystal_demo',name:'Cristal del Mercader',icon:'💎',kind:'material',rarity:'Epic',quantity:1,maxStack:1}}]:[];
  s.activeTrade={tradeId,status:'OPEN',mode:demo?'offline-demo':'local-shell',participants:{local:{id:LOCAL_ID,name:playerName()},peer:{id:peerId,name:peerName}},offers:{local:{items:[],gold:0,ready:false,finalAccepted:false},peer:{items:peerItems,gold:demo?75:0,ready:false,finalAccepted:false}},revision:1,createdAt:now(),updatedAt:now()};save();return{ok:true,trade:publicTrade(s.activeTrade)};
}
function localRequest(op,payload){
  const s=ensureState(),data=payload||{};
  if(op==='snapshot')return{ok:true,snapshot:snapshot()};
  if(op==='market:create'){
    const price=Math.floor(Number(data.price));if(!Number.isInteger(price)||price<1)return{ok:false,error:'INVALID_PRICE'};
    const r=root.KeloMarketEscrow?.createMarketListing?.(data.instanceId,data.quantity,{price,metadata:Object.assign({},data.metadata||{},{commerceAuthority:VERSION})})||{ok:false,error:'MARKET_ESCROW_UNAVAILABLE'};
    if(r.ok){const row=(root.KeloMarketEscrow.getActiveListings()||[]).find(x=>x.listingId===r.listingId);if(row){row.price=price;if(row.metadata)row.metadata.price=price;}save();}return r;
  }
  if(op==='market:cancel')return root.KeloMarketEscrow?.cancelMarketListing?.(data.listingId)||{ok:false,error:'MARKET_ESCROW_UNAVAILABLE'};
  if(op==='market:buy'){
    const listing=(s.demoListings||[]).find(x=>x.listingId===String(data.listingId)&&x.status==='active');if(!listing){if(getOwnListings().some(x=>x.listingId===String(data.listingId)))return{ok:false,error:'SELF_PURCHASE_FORBIDDEN'};return{ok:false,error:'LISTING_NOT_FOUND'};}
    const price=Math.max(0,Math.floor(Number(listing.price)||0)),goldBefore=Math.max(0,Math.floor(Number(STATE.gold)||0));if(goldBefore<price)return{ok:false,error:'INSUFFICIENT_GOLD'};
    const C=root.KeloContainers;if(!C?.checkpoint||!C?.receiveItem||!C?.restoreCheckpoint)return{ok:false,error:'CONTAINER_TRANSACTION_API_UNAVAILABLE'};
    const cp=C.checkpoint(),commerceBefore=clone(STATE.commerce),transactionId=nextTransaction('market');
    try{const item=clone(listing.item);const base=itemIdentity(item)||listing.listingId;if(item.id!=null)item.id=base+'_'+transactionId;else if(item.uid!=null)item.uid=base+'_'+transactionId;else item._backpackId=base+'_'+transactionId;const r=C.receiveItem('backpack',item,{persist:false,allowMerge:false,preserveIdentity:true});if(!r.ok)throw new Error(r.error);STATE.gold=goldBefore-price;listing.status='sold';listing.buyerId=LOCAL_ID;listing.completedAt=now();appendTransaction({transactionId,type:'market_purchase',listingId:listing.listingId,sellerId:listing.ownerId,price,item:describe(r.item||item),createdAt:listing.completedAt,status:'committed'});save();return{ok:true,transactionId,listingId:listing.listingId,item:describe(r.item||item),gold:STATE.gold};}catch(err){C.restoreCheckpoint(cp,{persist:false});STATE.gold=goldBefore;STATE.commerce=commerceBefore;save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
  }
  if(op==='stall:claim'){
    const stallId=String(data.stallId||'');if(!stallId)return{ok:false,error:'STALL_ID_REQUIRED'};const current=s.stallClaims[stallId];if(current&&String(current.ownerId)!==LOCAL_ID)return{ok:false,error:'STALL_OCCUPIED'};
    Object.keys(s.stallClaims).forEach(k=>{if(String(s.stallClaims[k]?.ownerId)===LOCAL_ID&&k!==stallId)delete s.stallClaims[k];});s.stallClaims[stallId]={stallId,ownerId:LOCAL_ID,sellerName:playerName(),message:String(data.message||'Mi puesto').slice(0,60),demo:false,claimedAt:now()};save();return{ok:true,stall:clone(s.stallClaims[stallId])};
  }
  if(op==='stall:release'){const stallId=String(data.stallId||stallForOwner(LOCAL_ID)?.stallId||'');const row=s.stallClaims[stallId];if(!row)return{ok:true,released:false};if(String(row.ownerId)!==LOCAL_ID)return{ok:false,error:'STALL_NOT_OWNED'};delete s.stallClaims[stallId];save();return{ok:true,released:true,stallId};}
  if(op==='stall:message'){const row=stallForOwner(LOCAL_ID);if(!row)return{ok:false,error:'STALL_NOT_CLAIMED'};row.message=String(data.message||'Mi puesto').slice(0,60);save();return{ok:true,stall:clone(row)};}
  if(op==='trade:create')return createTrade(data);
  const t=s.activeTrade;if(op.startsWith('trade:')&&!t)return{ok:false,error:'TRADE_NOT_FOUND'};
  if(op==='trade:addItem'){
    if(t.offers.local.ready||t.offers.peer.ready)resetTradeConfirmations(t);const slot=backpackItem(data.instanceId);if(!slot?.item)return{ok:false,error:'ITEM_NOT_FOUND'};if(slot.item.bound)return{ok:false,error:'BOUND_ITEM_NOT_TRADABLE'};if(t.offers.local.items.some(x=>x.sourceInstanceId===String(data.instanceId)))return{ok:false,error:'ITEM_ALREADY_OFFERED'};
    const qty=data.quantity==null?Math.max(1,Math.floor(Number(slot.item.quantity)||1)):Math.floor(Number(data.quantity));const r=root.KeloContainers.transferItem('backpack','trade_escrow',slot.key,qty,{persist:false,allowMerge:false});if(!r.ok)return r;const moved=escrowTradeItemByKey(r.movedItemKey);if(!moved){root.KeloContainers.transferItem('trade_escrow','backpack',r.movedItemKey,null,{persist:false,allowMerge:false});return{ok:false,error:'TRADE_ESCROW_RESOLVE_FAILED'};}resetTradeConfirmations(t);t.offers.local.items.push({instanceId:itemIdentity(moved.item),sourceInstanceId:String(data.instanceId),quantity:qty,item:clone(moved.item)});save();return{ok:true,trade:publicTrade(t)};
  }
  if(op==='trade:removeItem'){
    const idx=t.offers.local.items.findIndex(x=>x.instanceId===String(data.instanceId));if(idx<0)return{ok:false,error:'OFFER_ITEM_NOT_FOUND'};const slot=escrowTradeItem(data.instanceId);if(!slot)return{ok:false,error:'TRADE_ESCROW_ITEM_MISSING'};const r=root.KeloContainers.transferItem('trade_escrow','backpack',slot.key,null,{persist:false,allowMerge:false});if(!r.ok)return r;t.offers.local.items.splice(idx,1);resetTradeConfirmations(t);save();return{ok:true,trade:publicTrade(t)};
  }
  if(op==='trade:setGold'){const gold=Math.floor(Number(data.gold));if(!Number.isInteger(gold)||gold<0)return{ok:false,error:'INVALID_GOLD'};if(gold>Math.max(0,Math.floor(Number(STATE.gold)||0)))return{ok:false,error:'INSUFFICIENT_GOLD'};t.offers.local.gold=gold;resetTradeConfirmations(t);save();return{ok:true,trade:publicTrade(t)};}
  if(op==='trade:ready'){t.offers.local.ready=!!data.ready;t.offers.local.finalAccepted=false;t.offers.peer.finalAccepted=false;t.status=t.offers.local.ready&&t.offers.peer.ready?'FINAL_REVIEW':'OPEN';t.updatedAt=now();save();return{ok:true,trade:publicTrade(t)};}
  if(op==='trade:demoPeerReady'){if(t.mode!=='offline-demo')return{ok:false,error:'DEMO_ONLY'};t.offers.peer.ready=data.ready!==false;t.offers.peer.finalAccepted=false;t.offers.local.finalAccepted=false;t.status=t.offers.local.ready&&t.offers.peer.ready?'FINAL_REVIEW':'OPEN';t.updatedAt=now();save();return{ok:true,trade:publicTrade(t)};}
  if(op==='trade:finalAccept'){if(!(t.offers.local.ready&&t.offers.peer.ready))return{ok:false,error:'BOTH_NOT_READY'};t.offers.local.finalAccepted=!!data.accept;t.updatedAt=now();if(t.offers.local.finalAccepted&&t.offers.peer.finalAccepted)return commitTrade(t);save();return{ok:true,trade:publicTrade(t)};}
  if(op==='trade:demoPeerFinalAccept'){if(t.mode!=='offline-demo')return{ok:false,error:'DEMO_ONLY'};if(!(t.offers.local.ready&&t.offers.peer.ready))return{ok:false,error:'BOTH_NOT_READY'};t.offers.peer.finalAccepted=data.accept!==false;t.updatedAt=now();if(t.offers.local.finalAccepted&&t.offers.peer.finalAccepted)return commitTrade(t);save();return{ok:true,trade:publicTrade(t)};}
  if(op==='trade:cancel'){
    const cp=root.KeloContainers.checkpoint?.();for(const offered of t.offers.local.items.slice()){const slot=escrowTradeItem(offered.instanceId);if(!slot)continue;const r=root.KeloContainers.transferItem('trade_escrow','backpack',slot.key,null,{persist:false,allowMerge:false});if(!r.ok){if(cp)root.KeloContainers.restoreCheckpoint(cp,{persist:false});return{ok:false,error:'CANCEL_ROLLBACK',reason:r.error};}}
    t.status='CANCELLED';t.cancelledAt=now();s.tradeHistory.push(clone(t));if(s.tradeHistory.length>MAX_HISTORY)s.tradeHistory.splice(0,s.tradeHistory.length-MAX_HISTORY);s.activeTrade=null;save();return{ok:true,status:'CANCELLED',tradeId:t.tradeId};
  }
  return{ok:false,error:'UNKNOWN_COMMERCE_OPERATION',op};
}
function escrowTradeItemByKey(key){return tradeEscrowSlots().find(s=>s.key===String(key))||null;}
function getMode(){if(injectedAuthority)return'injected-authority';if(root.KeloNetAuthority?.isOnline?.()&&typeof root.KeloNetAuthority.requestCommerce==='function')return'server-authoritative';return'local-offline';}
async function request(op,payload){
  let result;
  try{
    if(injectedAuthority){result=await injectedAuthority.request(op,payload||{});return emit('adapter:'+op,result);}
    if(root.KeloNetAuthority?.isOnline?.()){
      if(typeof root.KeloNetAuthority.requestCommerce!=='function')throw new Error('COMMERCE_SERVER_BRIDGE_UNAVAILABLE');
      result=await root.KeloNetAuthority.requestCommerce(op,payload||{});if(result?.snapshot)lastServerSnapshot=clone(result.snapshot);return emit('server:'+op,result);
    }
    result=localRequest(op,payload||{});return emit('local:'+op,result);
  }catch(err){result={ok:false,error:String(err&&err.message||err)};emit('error:'+op,result);return result;}
}
function installAuthorityAdapter(adapter){if(adapter&&typeof adapter.request!=='function')throw new Error('INVALID_COMMERCE_AUTHORITY_ADAPTER');injectedAuthority=adapter||null;return getMode();}
function ingestServerEvent(detail){if(!detail)return;if(detail.snapshot)lastServerSnapshot=clone(detail.snapshot);emit('server-event',detail);}
root.addEventListener?.('kelo:commerce-server-event',e=>ingestServerEvent(e.detail));
ensureState();
root.KeloCommerceAuthority=Object.freeze({
  version:VERSION,schemaVersion:SCHEMA,playerId,getMode,request,snapshot,installAuthorityAdapter,ingestServerEvent,
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  createMarketListing:(instanceId,quantity,price,metadata)=>request('market:create',{instanceId,quantity,price,metadata}),
  cancelMarketListing:(listingId)=>request('market:cancel',{listingId}),buyListing:(listingId)=>request('market:buy',{listingId}),
  claimStall:(stallId,message)=>request('stall:claim',{stallId,message}),releaseStall:(stallId)=>request('stall:release',{stallId}),setStallMessage:(message)=>request('stall:message',{message}),
  createTrade:(peer)=>request('trade:create',peer||{}),addTradeItem:(instanceId,quantity)=>request('trade:addItem',{instanceId,quantity}),removeTradeItem:(instanceId)=>request('trade:removeItem',{instanceId}),setTradeGold:(gold)=>request('trade:setGold',{gold}),setTradeReady:(ready)=>request('trade:ready',{ready}),finalAcceptTrade:(accept)=>request('trade:finalAccept',{accept}),cancelTrade:()=>request('trade:cancel',{}),
  demoPeerReady:(ready)=>request('trade:demoPeerReady',{ready}),demoPeerFinalAccept:(accept)=>request('trade:demoPeerFinalAccept',{accept})
});
root.KELO_COMMERCE_AUDIT=Object.freeze({version:VERSION,authorityBoundary:true,offlineAdapter:true,automaticServerBridge:true,noOnlineLocalFallback:true,tradeDoubleConfirmation:true,offerMutationResetsConfirmation:true,separateTradeEscrow:true,marketEscrowReused:true,atomicCommitViaContainerCheckpoint:true,transactionLog:true,marketStalls:true,offlineDemoFixtures:true,equipmentCatalogMarketFixtures:true,recoverableFixtureMerge:true,serverReplaceable:true});
})(typeof globalThis!=='undefined'?globalThis:window);