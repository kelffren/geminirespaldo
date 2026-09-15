'use strict';
/* KELO-INDEX
 * area: SERVER / COMMERCE
 * owner: CommerceService
 * keys: MARKET STALL TRADE REQUEST ACCEPT ESCROW ATOMIC IDEMPOTENCY AUTHORITY
 * purpose: autoridad server-side para cualquier transferencia de oro/objetos entre jugadores
 * consumes: PlayerEconomyStore
 * reuse: puestos, trade directo y futuras subastas/regalos
 * do-not: no confiar en saldo del cliente; no mutar inventarios fuera de PlayerEconomyStore
 */
const crypto=require('crypto');
const VERSION='commerce-server-v1.1.0';
const SCHEMA=1;
const MAX_HISTORY=100;
const TRADE_REQUEST_TTL_MS=30000;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
const uid=prefix=>prefix+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(4).toString('hex');
const amount=v=>Math.max(0,Math.floor(Number(v)||0));

function itemId(item){return item&&String(item.id||item.uid||item.instanceId||'')||'';}
function sanitizeItem(raw,ownerId){
  if(!raw||typeof raw!=='object')throw new Error('INVALID_ITEM');
  const id=String(raw.id||raw.uid||raw.instanceId||'').replace(/[^a-zA-Z0-9_:.-]/g,'').slice(0,120);
  if(!id)throw new Error('INVALID_ITEM_ID');
  const quantity=Math.max(1,Math.min(999999,Math.floor(Number(raw.quantity)||1)));
  return {...clone(raw),id,ownerId:String(ownerId),quantity,name:String(raw.name||raw.templateId||'Objeto').slice(0,80),templateId:String(raw.templateId||raw.typeId||raw.name||'item').slice(0,100),bound:!!raw.bound,container:String(raw.container||'backpack')};
}
function publicItem(item){if(!item)return null;const x=clone(item);delete x.serverMeta;return x;}

function createCommerceService(opts={}){
  if(!opts.economyStore)throw new Error('ECONOMY_STORE_REQUIRED');
  const economy=opts.economyStore;
  const stalls=new Map();
  const listings=new Map();
  const trades=new Map();
  const activeTradeByPlayer=new Map();
  const requestCache=new Map();
  let txSeq=0;

  function player(id){return economy.ensure(String(id));}
  function playerName(id,fallback){return String(opts.resolvePlayerName?.(String(id))||fallback||String(id)).slice(0,24);}
  function nextTx(kind){txSeq++;return 'txn_'+kind+'_'+Date.now().toString(36)+'_'+txSeq.toString(36);}
  function findItem(p,id,container){return (p.items||[]).find(x=>itemId(x)===String(id)&&(!container||String(x.container||'backpack')===container))||null;}
  function ensureFree(item,purpose,sessionId){const p=player(item.ownerId||'');const r=p.reservations?.[itemId(item)];if(r&&!(r.purpose===purpose&&String(r.sessionId)===String(sessionId)))throw new Error('ITEM_RESERVED');}
  function reserve(p,item,purpose,sessionId){const id=itemId(item),current=p.reservations[id];if(current&&!(current.purpose===purpose&&String(current.sessionId)===String(sessionId)))throw new Error('ITEM_RESERVED');p.reservations[id]={purpose,sessionId:String(sessionId),at:now()};}
  function unreserve(p,id){delete p.reservations[String(id)];}
  function splitToEscrow(p,sourceId,qty,container,purpose,sessionId){
    const src=findItem(p,sourceId,'backpack');if(!src)throw new Error('ITEM_NOT_FOUND');if(src.bound)throw new Error('BOUND_ITEM_NOT_TRADABLE');ensureFree(src,purpose,sessionId);
    qty=qty==null?amount(src.quantity):Math.floor(Number(qty));if(!Number.isInteger(qty)||qty<1||qty>amount(src.quantity))throw new Error('INVALID_AMOUNT');
    let moved;
    if(qty===amount(src.quantity)){moved=src;moved.container=container;}
    else{src.quantity=amount(src.quantity)-qty;moved={...clone(src),id:uid('item'),quantity:qty,container,splitFrom:itemId(src)};p.items.push(moved);}
    moved.ownerId=p.id;reserve(p,moved,purpose,sessionId);return moved;
  }
  function moveEscrowToBackpack(p,id){const item=findItem(p,id);if(!item)throw new Error('ITEM_NOT_FOUND');unreserve(p,id);item.container='backpack';return item;}
  function ownStall(ownerId){return [...stalls.values()].find(x=>x.ownerId===String(ownerId))||null;}
  function tradeForPlayer(id){const tid=activeTradeByPlayer.get(String(id));return tid?trades.get(tid)||null:null;}
  function sideOf(t,id){if(!t)return null;id=String(id);if(t.participants.a.id===id)return'a';if(t.participants.b.id===id)return'b';return null;}
  function otherSide(side){return side==='a'?'b':'a';}
  function participantId(t,side){return t.participants[side].id;}
  function resetConfirmations(t){t.offers.a.ready=false;t.offers.b.ready=false;t.offers.a.finalAccepted=false;t.offers.b.finalAccepted=false;t.status='OPEN';t.revision=(Number(t.revision)||0)+1;t.updatedAt=now();}
  function assertEditableTrade(t){if(!t)throw new Error('TRADE_NOT_FOUND');if(t.status==='REQUESTED')throw new Error('TRADE_NOT_ACCEPTED');if(!['OPEN','FINAL_REVIEW'].includes(t.status))throw new Error('TRADE_NOT_EDITABLE');}
  function clearTrade(t,status,reason){if(!t)return null;t.status=status;t.updatedAt=now();t.cancelReason=reason||null;trades.delete(t.tradeId);activeTradeByPlayer.delete(t.participants.a.id);activeTradeByPlayer.delete(t.participants.b.id);return t;}
  function expirePendingTrades(){const ts=now();for(const t of [...trades.values()])if(t.status==='REQUESTED'&&Number(t.expiresAt||0)<=ts)clearTrade(t,'EXPIRED','request-timeout');}
  function publicTradeFor(t,viewerId){
    if(!t)return null;const side=sideOf(t,viewerId);if(!side)return null;const peer=otherSide(side),direction=t.status==='REQUESTED'?(String(viewerId)===String(t.requestedBy)?'outgoing':'incoming'):null;
    return {tradeId:t.tradeId,status:t.status,mode:'online',requestDirection:direction,requestedBy:t.requestedBy||null,expiresAt:t.expiresAt||null,revision:t.revision,createdAt:t.createdAt,updatedAt:t.updatedAt,participants:{local:clone(t.participants[side]),peer:clone(t.participants[peer])},offers:{local:clone(t.offers[side]),peer:clone(t.offers[peer])}};
  }
  function activeListings(){return [...listings.values()].filter(x=>x.status==='active').map(x=>({...clone(x),item:publicItem(x.item)}));}
  function tradeCandidates(id){const rows=typeof opts.listTradeCandidates==='function'?opts.listTradeCandidates(String(id)):[];return (Array.isArray(rows)?rows:[]).filter(x=>x&&String(x.id)!==String(id)).map(x=>({id:String(x.id),name:String(x.name||x.id).slice(0,24),zone:String(x.zone||''),distance:Number.isFinite(Number(x.distance))?Math.round(Number(x.distance)):null}));}
  function snapshot(id){
    expirePendingTrades();const p=player(id),t=tradeForPlayer(id);
    return {version:VERSION,schemaVersion:SCHEMA,mode:'server-authoritative',player:{id:p.id,name:playerName(p.id),gold:amount(p.gold),items:(p.items||[]).filter(x=>String(x.container||'backpack')==='backpack').map(publicItem)},activeTrade:publicTradeFor(t,id),tradeCandidates:tradeCandidates(id),marketListings:activeListings(),stalls:[...stalls.values()].map(clone),tradeHistory:clone((p.commerceHistory||[]).filter(x=>x.type==='player_trade').slice(-12)),transactionHistory:clone((p.commerceHistory||[]).slice(-20))};
  }
  function history(p,row){p.commerceHistory.unshift(clone(row));if(p.commerceHistory.length>MAX_HISTORY)p.commerceHistory.length=MAX_HISTORY;p.commerceRevision=(Number(p.commerceRevision)||0)+1;}
  function cacheKey(id,requestId){return requestId?String(id)+':'+String(requestId):null;}
  function cached(id,requestId){const k=cacheKey(id,requestId),hit=k&&requestCache.get(k);return hit?{...clone(hit),snapshot:snapshot(id)}:null;}
  function remember(id,requestId,result){const k=cacheKey(id,requestId);if(!k)return;requestCache.set(k,clone(result));if(requestCache.size>500)requestCache.delete(requestCache.keys().next().value);}
  function notifyResult(viewerId,result,notifyIds){return {...result,snapshot:snapshot(viewerId),notifyPlayerIds:[...new Set((notifyIds||[]).filter(Boolean).map(String))]};}
  function requireTradeRange(a,b){if(typeof opts.canTradePlayers==='function'&&!opts.canTradePlayers(String(a),String(b)))throw new Error('PLAYERS_NOT_IN_TRADE_RANGE');}

  async function migrateLegacyItems(id,data){const p=player(id);if(p.commerceMigrated)return{ok:true,alreadyMigrated:true};if((p.items||[]).length)throw new Error('SERVER_INVENTORY_NOT_EMPTY');const incoming=Array.isArray(data.items)?data.items:[];if(incoming.length>200)throw new Error('TOO_MANY_ITEMS');const seen=new Set(),clean=incoming.map(raw=>{const x=sanitizeItem(raw,p.id);if(seen.has(x.id))throw new Error('DUPLICATE_ITEM_ID');seen.add(x.id);x.container='backpack';return x;});p.items.push(...clean);p.commerceMigrated=true;return{ok:true,migrated:clean.length};}
  async function createListing(id,data){const p=player(id),price=amount(data.price);if(price<1)throw new Error('INVALID_PRICE');const stall=ownStall(id),stallId=String(data.metadata?.stallId||data.stallId||stall?.stallId||'');if(!stallId||!stall||stall.stallId!==stallId)throw new Error('STALL_NOT_OWNED');const listingId=uid('listing'),moved=splitToEscrow(p,data.instanceId,data.quantity,'market_escrow','market',listingId);const row={listingId,ownerId:p.id,sellerName:playerName(p.id),stallId,price,quantity:amount(moved.quantity),status:'active',itemInstanceId:itemId(moved),item:publicItem(moved),createdAt:now(),metadata:clone(data.metadata||{})};listings.set(listingId,row);return{ok:true,listing:clone(row),listingId};}
  async function cancelListing(id,data){const row=listings.get(String(data.listingId||''));if(!row)throw new Error('LISTING_NOT_FOUND');if(row.ownerId!==String(id))throw new Error('LISTING_NOT_OWNED');if(row.status!=='active')throw new Error('LISTING_NOT_ACTIVE');const p=player(id),item=findItem(p,row.itemInstanceId,'market_escrow');if(!item)throw new Error('MARKET_ESCROW_ITEM_MISSING');moveEscrowToBackpack(p,row.itemInstanceId);row.status='cancelled';row.cancelledAt=now();return{ok:true,listing:clone(row)};}
  async function buyListing(id,data){
    const row=listings.get(String(data.listingId||''));if(!row||row.status!=='active')throw new Error('LISTING_NOT_FOUND');if(row.ownerId===String(id))throw new Error('SELF_PURCHASE_FORBIDDEN');const buyerId=String(id),sellerId=row.ownerId,transactionId=nextTx('market');
    const out=await economy.transaction([buyerId,sellerId],(buyer,seller)=>{if(row.status!=='active')throw new Error('LISTING_NOT_FOUND');if(amount(buyer.gold)<row.price)throw new Error('INSUFFICIENT_GOLD');const item=findItem(seller,row.itemInstanceId,'market_escrow');if(!item)throw new Error('MARKET_ESCROW_ITEM_MISSING');const reservation=seller.reservations[itemId(item)];if(!reservation||reservation.purpose!=='market'||reservation.sessionId!==row.listingId)throw new Error('ITEM_RESERVATION_LOST');buyer.gold=amount(buyer.gold)-row.price;seller.gold=amount(seller.gold)+row.price;seller.items=seller.items.filter(x=>itemId(x)!==row.itemInstanceId);unreserve(seller,row.itemInstanceId);item.ownerId=buyer.id;item.container='backpack';buyer.items.push(item);row.status='sold';row.buyerId=buyer.id;row.completedAt=now();row.transactionId=transactionId;const tx={transactionId,type:'market_purchase',status:'committed',listingId:row.listingId,sellerId,buyerId,price:row.price,item:publicItem(item),createdAt:row.completedAt};history(buyer,tx);history(seller,tx);return{ok:true,transactionId,listingId:row.listingId,item:publicItem(item),gold:buyer.gold};});
    return{...out,notifyPlayerIds:[sellerId]};
  }
  function claimStall(id,data){const stallId=String(data.stallId||'').slice(0,40);if(!stallId)throw new Error('STALL_ID_REQUIRED');const current=stalls.get(stallId);if(current&&current.ownerId!==String(id))throw new Error('STALL_OCCUPIED');const old=ownStall(id);if(old&&old.stallId!==stallId)stalls.delete(old.stallId);const row={stallId,ownerId:String(id),sellerName:playerName(id),message:String(data.message||'Mi puesto').slice(0,60),claimedAt:now()};stalls.set(stallId,row);return{ok:true,stall:clone(row)};}
  function releaseStall(id,data){const own=ownStall(id),stallId=String(data.stallId||own?.stallId||''),row=stalls.get(stallId);if(!row)return{ok:true,released:false};if(row.ownerId!==String(id))throw new Error('STALL_NOT_OWNED');stalls.delete(stallId);return{ok:true,released:true,stallId};}
  function setStallMessage(id,data){const row=ownStall(id);if(!row)throw new Error('STALL_NOT_CLAIMED');row.message=String(data.message||'Mi puesto').slice(0,60);return{ok:true,stall:clone(row)};}

  function makeTrade(id,data,status){
    id=String(id);expirePendingTrades();if(activeTradeByPlayer.has(id))throw new Error('TRADE_ALREADY_ACTIVE');const peerId=String(data.peerId||'');if(!peerId||peerId===id)throw new Error('INVALID_TRADE_PEER');if(opts.isPlayerOnline&&!opts.isPlayerOnline(peerId))throw new Error('PLAYER_NOT_ONLINE');if(activeTradeByPlayer.has(peerId))throw new Error('PEER_TRADE_BUSY');requireTradeRange(id,peerId);player(peerId);
    const tradeId=uid('trade'),requested=status==='REQUESTED';const t={tradeId,status,requestedBy:requested?id:null,expiresAt:requested?now()+TRADE_REQUEST_TTL_MS:null,participants:{a:{id,name:playerName(id)},b:{id:peerId,name:playerName(peerId,data.peerName)}},offers:{a:{items:[],gold:0,ready:false,finalAccepted:false},b:{items:[],gold:0,ready:false,finalAccepted:false}},revision:1,createdAt:now(),updatedAt:now()};trades.set(tradeId,t);activeTradeByPlayer.set(id,tradeId);activeTradeByPlayer.set(peerId,tradeId);return t;
  }
  function requestTrade(id,data){const t=makeTrade(id,data,'REQUESTED');return{ok:true,status:'REQUESTED',trade:publicTradeFor(t,id),notifyPlayerIds:[t.participants.b.id]};}
  function acceptTrade(id){const t=tradeForPlayer(id);if(!t)throw new Error('TRADE_NOT_FOUND');if(t.status!=='REQUESTED')throw new Error('TRADE_REQUEST_NOT_PENDING');if(String(id)===String(t.requestedBy))throw new Error('TRADE_REQUEST_TARGET_REQUIRED');requireTradeRange(t.participants.a.id,t.participants.b.id);t.status='OPEN';t.expiresAt=null;t.updatedAt=now();return{ok:true,status:'OPEN',trade:publicTradeFor(t,id),notifyPlayerIds:[t.requestedBy]};}
  function rejectTrade(id){const t=tradeForPlayer(id);if(!t)throw new Error('TRADE_NOT_FOUND');if(t.status!=='REQUESTED')throw new Error('TRADE_REQUEST_NOT_PENDING');if(String(id)===String(t.requestedBy))throw new Error('TRADE_REQUEST_TARGET_REQUIRED');const initiator=t.requestedBy,tradeId=t.tradeId;clearTrade(t,'REJECTED','target-rejected');return{ok:true,status:'REJECTED',tradeId,notifyPlayerIds:[initiator]};}
  function addTradeItem(id,data){const t=tradeForPlayer(id);assertEditableTrade(t);const side=sideOf(t,id),p=player(id),source=findItem(p,data.instanceId,'backpack');if(!source)throw new Error('ITEM_NOT_FOUND');if(t.offers[side].items.some(x=>x.sourceInstanceId===String(data.instanceId)))throw new Error('ITEM_ALREADY_OFFERED');const moved=splitToEscrow(p,data.instanceId,data.quantity,'trade_escrow','trade',t.tradeId);resetConfirmations(t);t.offers[side].items.push({instanceId:itemId(moved),sourceInstanceId:String(data.instanceId),quantity:amount(moved.quantity),item:publicItem(moved)});return{ok:true,trade:publicTradeFor(t,id),notifyPlayerIds:[participantId(t,otherSide(side))]};}
  function removeTradeItem(id,data){const t=tradeForPlayer(id);assertEditableTrade(t);const side=sideOf(t,id),offer=t.offers[side],idx=offer.items.findIndex(x=>x.instanceId===String(data.instanceId));if(idx<0)throw new Error('OFFER_ITEM_NOT_FOUND');moveEscrowToBackpack(player(id),offer.items[idx].instanceId);offer.items.splice(idx,1);resetConfirmations(t);return{ok:true,trade:publicTradeFor(t,id),notifyPlayerIds:[participantId(t,otherSide(side))]};}
  function setTradeGold(id,data){const t=tradeForPlayer(id);assertEditableTrade(t);const side=sideOf(t,id),gold=Math.floor(Number(data.gold));if(!Number.isInteger(gold)||gold<0)throw new Error('INVALID_GOLD');if(gold>amount(player(id).gold))throw new Error('INSUFFICIENT_GOLD');t.offers[side].gold=gold;resetConfirmations(t);return{ok:true,trade:publicTradeFor(t,id),notifyPlayerIds:[participantId(t,otherSide(side))]};}
  function setTradeReady(id,data){const t=tradeForPlayer(id);assertEditableTrade(t);const side=sideOf(t,id),peer=otherSide(side);t.offers[side].ready=!!data.ready;t.offers[side].finalAccepted=false;t.offers[peer].finalAccepted=false;t.status=t.offers.a.ready&&t.offers.b.ready?'FINAL_REVIEW':'OPEN';t.updatedAt=now();return{ok:true,trade:publicTradeFor(t,id),notifyPlayerIds:[participantId(t,peer)]};}
  async function finalAccept(id,data){
    const t=tradeForPlayer(id);assertEditableTrade(t);if(!(t.offers.a.ready&&t.offers.b.ready))throw new Error('BOTH_NOT_READY');requireTradeRange(t.participants.a.id,t.participants.b.id);const side=sideOf(t,id),peer=otherSide(side);t.offers[side].finalAccepted=!!data.accept;t.updatedAt=now();if(!(t.offers.a.finalAccepted&&t.offers.b.finalAccepted))return{ok:true,trade:publicTradeFor(t,id),notifyPlayerIds:[participantId(t,peer)]};
    const aId=t.participants.a.id,bId=t.participants.b.id,transactionId=nextTx('trade');const result=await economy.transaction([aId,bId],(a,b)=>{if(amount(a.gold)<amount(t.offers.a.gold)||amount(b.gold)<amount(t.offers.b.gold))throw new Error('INSUFFICIENT_GOLD');for(const [sideKey,p] of [['a',a],['b',b]])for(const row of t.offers[sideKey].items){const item=findItem(p,row.instanceId,'trade_escrow'),r=p.reservations[row.instanceId];if(!item||!r||r.purpose!=='trade'||r.sessionId!==t.tradeId)throw new Error('TRADE_ESCROW_ITEM_MISSING');}const aOut=amount(t.offers.a.gold),bOut=amount(t.offers.b.gold);a.gold=amount(a.gold)-aOut+bOut;b.gold=amount(b.gold)-bOut+aOut;const move=(from,to,rows)=>rows.map(row=>{const item=findItem(from,row.instanceId,'trade_escrow');from.items=from.items.filter(x=>itemId(x)!==row.instanceId);unreserve(from,row.instanceId);item.ownerId=to.id;item.container='backpack';to.items.push(item);return publicItem(item);});const aItems=move(a,b,t.offers.a.items),bItems=move(b,a,t.offers.b.items),completedAt=now(),tx={transactionId,type:'player_trade',status:'committed',tradeId:t.tradeId,playerA:aId,playerB:bId,goldAOut:aOut,goldBOut:bOut,itemsAOut:aItems,itemsBOut:bItems,createdAt:completedAt};history(a,tx);history(b,tx);return{ok:true,status:'COMPLETED',tradeId:t.tradeId,transactionId};});
    t.status='COMPLETED';t.completedAt=now();t.transactionId=transactionId;clearTrade(t,'COMPLETED','committed');return{...result,notifyPlayerIds:[aId,bId]};
  }
  function cancelTrade(id,reason){const t=tradeForPlayer(id);if(!t)return{ok:true,status:'NO_TRADE'};for(const side of ['a','b']){const pid=t.participants[side].id,p=player(pid);for(const row of t.offers[side].items){const item=findItem(p,row.instanceId,'trade_escrow');if(item)moveEscrowToBackpack(p,row.instanceId);}}const ids=[t.participants.a.id,t.participants.b.id],tradeId=t.tradeId;clearTrade(t,'CANCELLED',reason||'cancelled');return{ok:true,status:'CANCELLED',tradeId,notifyPlayerIds:ids};}

  async function handle(id,op,payload={},requestId){
    id=String(id);expirePendingTrades();const hit=cached(id,requestId);if(hit)return hit;player(id);let result;
    try{
      if(op==='snapshot')result={ok:true};
      else if(op==='inventory:migrate')result=await migrateLegacyItems(id,payload);
      else if(op==='stall:claim')result=claimStall(id,payload);
      else if(op==='stall:release')result=releaseStall(id,payload);
      else if(op==='stall:message')result=setStallMessage(id,payload);
      else if(op==='market:create')result=await createListing(id,payload);
      else if(op==='market:cancel')result=await cancelListing(id,payload);
      else if(op==='market:buy')result=await buyListing(id,payload);
      else if(op==='trade:create'||op==='trade:request')result=requestTrade(id,payload);
      else if(op==='trade:accept')result=acceptTrade(id);
      else if(op==='trade:reject')result=rejectTrade(id);
      else if(op==='trade:addItem')result=addTradeItem(id,payload);
      else if(op==='trade:removeItem')result=removeTradeItem(id,payload);
      else if(op==='trade:setGold')result=setTradeGold(id,payload);
      else if(op==='trade:ready')result=setTradeReady(id,payload);
      else if(op==='trade:finalAccept')result=await finalAccept(id,payload);
      else if(op==='trade:cancel')result=cancelTrade(id,'player-cancelled');
      else throw new Error('UNKNOWN_COMMERCE_OPERATION');
      const notify=result.notifyPlayerIds||[];delete result.notifyPlayerIds;result=notifyResult(id,result,notify);remember(id,requestId,result);return result;
    }catch(err){result=notifyResult(id,{ok:false,error:String(err&&err.message||err)},[]);remember(id,requestId,result);return result;}
  }
  function disconnect(id){const result=cancelTrade(id,'disconnect'),stall=ownStall(id);if(stall)stalls.delete(stall.stallId);return{...result,releasedStall:stall?.stallId||null};}
  function seedItems(id,items){const p=player(id);p.items=(items||[]).map(x=>sanitizeItem(x,p.id));p.commerceMigrated=true;return snapshot(id);}
  function audit(){const duplicateListingItems=[],seen=new Set();for(const row of activeListings()){if(seen.has(row.itemInstanceId))duplicateListingItems.push(row.itemInstanceId);seen.add(row.itemInstanceId);}return{ok:duplicateListingItems.length===0,version:VERSION,stalls:stalls.size,activeListings:activeListings().length,activeTrades:trades.size,duplicateListingItems};}
  return Object.freeze({version:VERSION,economyStore:economy,handle,snapshot,disconnect,seedItems,audit,_debug:{stalls,listings,trades,activeTradeByPlayer}});
}

module.exports={VERSION,TRADE_REQUEST_TTL_MS,createCommerceService};
