(function(){
'use strict';
const VERSION='market-escrow-v1.0.0';
const SCHEMA_VERSION=1;
const OWNER='local_pioneer';
function save(){if(typeof saveState==='function')saveState();}
function ensure(){
  if(typeof STATE==='undefined')return null;
  if(!window.KeloContainers)return null;
  window.KeloContainers.ensure();
  if(!Array.isArray(STATE.marketEscrowListings))STATE.marketEscrowListings=[];
  STATE.marketEscrowListings.forEach(function(x){if(x&&x.schemaVersion==null)x.schemaVersion=SCHEMA_VERSION;});
  return STATE.marketEscrow;
}
function itemIdentity(item){
  if(!item)return null;
  if(item.id!=null)return String(item.id);
  if(item.uid!=null)return String(item.uid);
  if(item._backpackId!=null)return String(item._backpackId);
  return null;
}
function itemKey(item,index){return window.KeloContainers.keyForItem(item,index||0);}
function quantity(item){return Math.max(1,Math.floor(Number(item&&item.quantity)||1));}
function stackLimit(item){return Math.max(1,Math.floor(Number(item&&item.maxStack)||1));}
function activeListings(){ensure();return STATE.marketEscrowListings.filter(function(x){return x&&x.status==='active';});}
function allListings(){ensure();return STATE.marketEscrowListings.slice();}
function findBackpackSlot(instanceId){
  instanceId=String(instanceId||'');
  return window.KeloContainers.getSlots('backpack').find(function(s){return s.item&&itemIdentity(s.item)===instanceId;})||null;
}
function findEscrowSlot(instanceId){
  instanceId=String(instanceId||'');
  return window.KeloContainers.getSlots('market_escrow').find(function(s){return s.item&&itemIdentity(s.item)===instanceId;})||null;
}
function listingId(){return 'mkt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);}
function snapshot(){return JSON.parse(JSON.stringify({inventory:STATE.inventory,backpack:STATE.backpack,warehouse:STATE.warehouse,marketEscrow:STATE.marketEscrow,marketEscrowListings:STATE.marketEscrowListings}));}
function restore(s){STATE.inventory=s.inventory;STATE.backpack=s.backpack;STATE.warehouse=s.warehouse;STATE.marketEscrow=s.marketEscrow;STATE.marketEscrowListings=s.marketEscrowListings;}
function auditInvariants(){
  ensure();
  const errors=[];
  const containers=[
    {name:'backpack',items:STATE.inventory||[]},
    {name:'warehouse',items:(STATE.warehouse&&STATE.warehouse.items)||[]},
    {name:'market_escrow',items:(STATE.marketEscrow&&STATE.marketEscrow.items)||[]}
  ];
  const seen=new Map();
  containers.forEach(function(c){
    c.items.forEach(function(item,index){
      const key=itemKey(item,index),id=itemIdentity(item);
      if(!key||!id)errors.push({code:'MISSING_IDENTITY',container:c.name,index});
      if(key&&seen.has(key))errors.push({code:'DUPLICATE_IDENTITY',key,containers:[seen.get(key),c.name]});
      else if(key)seen.set(key,c.name);
      const q=quantity(item),max=stackLimit(item);
      if(q>max)errors.push({code:'STACK_OVER_MAX',container:c.name,key,quantity:q,maxStack:max});
    });
  });
  const escrowById=new Map();
  ((STATE.marketEscrow&&STATE.marketEscrow.items)||[]).forEach(function(item,index){
    const id=itemIdentity(item);if(id)escrowById.set(id,{item,key:itemKey(item,index)});
  });
  const active=activeListings();
  const listingByEscrow=new Map();
  active.forEach(function(lst){
    if(!lst.listingId)errors.push({code:'LISTING_MISSING_ID'});
    if(lst.owner!==OWNER)errors.push({code:'INVALID_LISTING_OWNER',listingId:lst.listingId});
    const rec=escrowById.get(String(lst.escrowItemInstanceId||''));
    if(!rec)errors.push({code:'ORPHAN_LISTING',listingId:lst.listingId,escrowItemInstanceId:lst.escrowItemInstanceId});
    else{
      if(quantity(rec.item)!==Math.max(1,Math.floor(Number(lst.quantity)||1)))errors.push({code:'LISTING_QUANTITY_MISMATCH',listingId:lst.listingId});
      if(findBackpackSlot(lst.escrowItemInstanceId))errors.push({code:'LISTED_ITEM_IN_BACKPACK',listingId:lst.listingId});
    }
    const eid=String(lst.escrowItemInstanceId||'');
    if(listingByEscrow.has(eid))errors.push({code:'MULTIPLE_LISTINGS_ONE_ESCROW_ITEM',escrowItemInstanceId:eid});
    else listingByEscrow.set(eid,lst.listingId);
  });
  escrowById.forEach(function(rec,id){
    if(!listingByEscrow.has(id))errors.push({code:'ORPHAN_ESCROW_ITEM',escrowItemInstanceId:id});
  });
  return {ok:errors.length===0,errors,activeListings:active.length,escrowItems:escrowById.size,uniqueIdentities:seen.size};
}
function createMarketListing(itemInstanceId,amount,listingData){
  ensure();listingData=listingData||{};
  const slot=findBackpackSlot(itemInstanceId);if(!slot||!slot.item)return{ok:false,error:'ITEM_NOT_FOUND'};
  const current=quantity(slot.item);amount=amount==null?current:Math.floor(Number(amount));
  if(!Number.isInteger(amount)||amount<1||amount>current)return{ok:false,error:'INVALID_AMOUNT'};
  if(current>stackLimit(slot.item))return{ok:false,error:'INVALID_STACK_STATE'};
  const snap=snapshot();
  try{
    const moved=window.KeloContainers.transferItem('backpack','market_escrow',slot.key,amount,{persist:false,allowMerge:false});
    if(!moved.ok)return moved;
    const movedKey=moved.movedItemKey||(moved.createdKeys&&moved.createdKeys[0])||(moved.preservedIdentity?slot.key:null);
    const escrowSlot=window.KeloContainers.getSlots('market_escrow').find(function(s){return s.key===movedKey;});
    if(!escrowSlot||!escrowSlot.item)throw new Error('ESCROW_ITEM_NOT_FOUND_AFTER_TRANSFER');
    const escrowItem=escrowSlot.item,escrowId=itemIdentity(escrowItem);
    const listing={
      schemaVersion:SCHEMA_VERSION,
      listingId:listingId(),
      owner:OWNER,
      seller:'KeloPioneer (Tu)',
      escrowItemInstanceId:escrowId,
      escrowItemKey:escrowSlot.key,
      templateId:escrowItem.templateId||escrowItem.typeId||null,
      quantity:quantity(escrowItem),
      createdAt:Date.now(),
      status:'active',
      price:Number.isFinite(Number(listingData.price))?Number(listingData.price):null,
      metadata:listingData.metadata&&typeof listingData.metadata==='object'?Object.assign({},listingData.metadata):{}
    };
    STATE.marketEscrowListings.push(listing);
    const audit=auditInvariants();if(!audit.ok)throw new Error('INVARIANT:'+JSON.stringify(audit.errors));
    save();
    return{ok:true,listing,moved,audit};
  }catch(err){restore(snap);save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function cancelMarketListing(id){
  ensure();
  const listing=STATE.marketEscrowListings.find(function(x){return x&&x.listingId===id&&x.status==='active';});
  if(!listing)return{ok:false,error:'LISTING_NOT_FOUND'};
  const escrow=findEscrowSlot(listing.escrowItemInstanceId);if(!escrow||!escrow.item)return{ok:false,error:'ESCROW_ITEM_NOT_FOUND'};
  const snap=snapshot();
  try{
    const moved=window.KeloContainers.transferItem('market_escrow','backpack',escrow.key,quantity(escrow.item),{persist:false,allowMerge:false});
    if(!moved.ok)return moved;
    listing.status='cancelled';listing.cancelledAt=Date.now();listing.returnedItemInstanceId=listing.escrowItemInstanceId;
    const audit=auditInvariants();if(!audit.ok)throw new Error('INVARIANT:'+JSON.stringify(audit.errors));
    save();
    return{ok:true,listing,moved,audit};
  }catch(err){restore(snap);save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
ensure();
window.KeloMarketEscrow=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,owner:OWNER,ensure,itemIdentity,getListings:allListings,getActiveListings:activeListings,createMarketListing,cancelMarketListing,auditInvariants});
window.KELO_MARKET_ESCROW_AUDIT=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,containerType:'market_escrow',identityRule:'listed-item-in-escrow-not-backpack',listingContract:'validate-transfer-create-persist-rollback-v1',cancelContract:'validate-transfer-close-persist-rollback-v1',escrowMerge:false,fullTransferPreservesIdentity:true,partialTransferCreatesIdentity:true,cancelPreservesIdentity:true,serverAuthoritative:false});
})();