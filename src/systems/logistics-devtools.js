/* KELO-INDEX
 * area: DEVTOOLS / LOGISTICS
 * owner: KeloLogisticsDevtools
 * keys: DEBUG ECONOMY QUOTE CONTRACT ROUTE RISK CART FACTION CLAN SIMULATE
 * purpose: observabilidad y simulación explícita para economía regional/logística sin crear autoridad paralela
 * public-api: KeloLogisticsDevtools.snapshot/run/scenarios
 * consumes: KeloRegionalEconomy, KeloCaravans, KeloFactions, KeloContainers
 * state-owned: none
 * extension-points: comandos dev delegados a owners reales
 * reuse: consola, futuros paneles admin y tests
 * legacy: none
 * do-not: NO mutar STATE directamente; NO usar en gameplay productivo
 */
(function(root){
'use strict';
const VERSION='logistics-devtools-v1.0.0';
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function economy(){return root.KeloRegionalEconomy;}function carts(){return root.KeloCaravans;}function factions(){return root.KeloFactions;}
function snapshot(){
  const e=economy(),c=carts(),f=factions();
  const econ=e?e.snapshot():null;
  return Object.freeze({
    version:VERSION,
    economy:econ,
    settlements:econ?econ.settlements.map(function(def){const state=econ.state.settlements[def.id];return{id:def.id,name:def.name,stock:clone(state.stock),production:Object.fromEntries(econ.resources.map(r=>[r.id,e.productionProfile(def.id,r.id)])),quotes:Object.fromEntries(econ.resources.map(r=>[r.id,e.quote(def.id,r.id,'T1',{skipRefresh:true})]))};}):[],
    contracts:econ?Object.values(econ.state.contracts):[],
    routes:econ?econ.routes.map(r=>({id:r.id,from:r.from,to:r.to,risk:e.getRouteRisk(r.id),economicDistance:e.getEconomicDistance(r.from,r.to)})):[],
    worldEvents:econ?Object.values(econ.state.routeEvents):[],
    carts:c?c.snapshot():null,
    containerAudit:root.KeloContainers?.auditIdentities?.()||null,
    factions:f?f.snapshot():null
  });
}
async function run(command,payload){
  const e=economy(),c=carts(),f=factions(),p=payload||{};
  switch(String(command)){
    case'set-stock':return e?.dev.setStock(p.settlementId,p.resourceId,p.value,p.tier)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'advance-hours':return e?.dev.advanceHours(p.settlementId,p.hours)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'activate-raiders':return e?.request('ActivateRaiderBand',p)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'end-world-event':return e?.request('EndWorldEvent',p)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'buy-resource':return e?.request('BuyResource',p)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'sell-resource':return e?.request('SellResource',p)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'deliver-contract':return e?.request('DeliverSupplyContract',p)||{ok:false,error:'ECONOMY_UNAVAILABLE'};
    case'attach-cart':return c?.request('AttachCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'detach-cart':return c?.request('DetachCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'begin-claim':return c?.request('BeginClaimCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'complete-claim':return c?.request('CompleteClaimCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'kill-carrier':return c?.dev.killCarrier(p.cartId)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'load-cart':return c?.request('LoadCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'unload-cart':return c?.request('UnloadCart',p)||{ok:false,error:'CARAVANS_UNAVAILABLE'};
    case'join-faction':return f?.request('JoinFaction',p)||{ok:false,error:'FACTIONS_UNAVAILABLE'};
    case'create-clan':return f?.request('CreateClan',p)||{ok:false,error:'FACTIONS_UNAVAILABLE'};
    case'join-clan':return f?.request('JoinClan',p)||{ok:false,error:'FACTIONS_UNAVAILABLE'};
    case'set-clan-role':return f?.request('SetClanRole',p)||{ok:false,error:'FACTIONS_UNAVAILABLE'};
    default:return{ok:false,error:'UNKNOWN_DEV_COMMAND',command:String(command)};
  }
}
const scenarios=Object.freeze({
  emergencyApples:function(){return run('set-stock',{settlementId:'ignis',resourceId:'apple',value:.08});},
  raiderForest:function(){return run('activate-raiders',{routeId:'route_ignis_verdantia',ambushNodeId:'forest_iv',npcThreat:.18,eventRisk:.35});},
  abandonDemoCart:function(){return run('kill-carrier',{cartId:'cart_demo_1'});}
});
root.KeloLogisticsDevtools=Object.freeze({version:VERSION,snapshot:snapshot,run:run,scenarios:scenarios});
root.KELO_LOGISTICS_DEVTOOLS_AUDIT=Object.freeze({version:VERSION,delegatesOnly:true,directStateWrites:false,observesQuotes:true,observesRisk:true,observesCarts:true,observesFactions:true});
})(typeof globalThis!=='undefined'?globalThis:window);
