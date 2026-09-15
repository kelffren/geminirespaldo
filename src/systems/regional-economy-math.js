/* KELO-INDEX
 * area: ECON / LOGISTICS
 * owner: KeloRegionalEconomyMath
 * keys: ECONOMY RISK ROUTE GRAPH DISTANCE SCARCITY DEMAND DETERMINISTIC
 * purpose: primitivas puras y deterministas para riesgo logístico, distancia económica, escasez y propagación regional
 * public-api: KeloRegionalEconomyMath
 * consumes: none
 * state-owned: none
 * extension-points: pesos de riesgo, bandas de escasez y parámetros de atenuación data-driven
 * reuse: economía regional, contratos, debug/tests y futura autoridad server usan exactamente la misma matemática
 * legacy: none
 * do-not: NO leer DOM, STATE, localStorage, reloj ni red
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KeloRegionalEconomyMath=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='regional-economy-math-v1.0.0';
  const DEFAULT_WEIGHTS=Object.freeze({pvpExposure:.24,terrainDanger:.18,chokePointRisk:.16,npcThreat:.20,eventRisk:.22});

  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:(fallback==null?0:fallback);}
  function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
  function clamp01(value){return clamp(value,0,1);}
  function normalizeWeights(input){
    const source=input||DEFAULT_WEIGHTS,out={};let total=0;
    Object.keys(DEFAULT_WEIGHTS).forEach(function(key){const n=Math.max(0,finite(source[key],DEFAULT_WEIGHTS[key]));out[key]=n;total+=n;});
    if(total<=0)return Object.assign({},DEFAULT_WEIGHTS);
    Object.keys(out).forEach(function(key){out[key]/=total;});
    return out;
  }
  function riskBreakdown(edge,weights){
    const w=normalizeWeights(weights),components={};let score=0;
    Object.keys(DEFAULT_WEIGHTS).forEach(function(key){const raw=clamp01(edge&&edge[key]);const weighted=raw*w[key];components[key]=Object.freeze({raw:raw,weight:w[key],weighted:weighted});score+=weighted;});
    return Object.freeze({score:clamp01(score),components:Object.freeze(components)});
  }
  function economicEdgeCost(edge,options){
    const opts=options||{},base=Math.max(.0001,finite(edge&&edge.travelTime,finite(edge&&edge.distance,1))),risk=riskBreakdown(edge,opts.weights).score;
    const riskMultiplier=Math.max(0,finite(opts.riskMultiplier,2.25));
    return base*(1+risk*riskMultiplier);
  }
  function buildAdjacency(edges,options){
    const adj=new Map(),opts=options||{};
    (edges||[]).forEach(function(edge){
      if(!edge||edge.disabled)return;
      const from=String(edge.from||''),to=String(edge.to||'');if(!from||!to)return;
      const cost=economicEdgeCost(edge,opts),risk=riskBreakdown(edge,opts.weights).score;
      if(!adj.has(from))adj.set(from,[]);adj.get(from).push({to:to,edge:edge,cost:cost,risk:risk});
      if(edge.bidirectional!==false){if(!adj.has(to))adj.set(to,[]);adj.get(to).push({to:from,edge:edge,cost:cost,risk:risk});}
    });
    return adj;
  }
  function shortestEconomicPath(edges,from,to,options){
    const start=String(from||''),goal=String(to||'');if(!start||!goal)return Object.freeze({reachable:false,distance:Infinity,path:[],edges:[],averageRisk:0});
    if(start===goal)return Object.freeze({reachable:true,distance:0,path:[start],edges:[],averageRisk:0});
    const adj=buildAdjacency(edges,options),dist=new Map([[start,0]]),prev=new Map(),visited=new Set();
    while(true){
      let node=null,best=Infinity;dist.forEach(function(value,key){if(!visited.has(key)&&value<best){best=value;node=key;}});
      if(node==null||best===Infinity)break;if(node===goal)break;visited.add(node);
      (adj.get(node)||[]).forEach(function(step){const next=best+step.cost;if(next<(dist.get(step.to)==null?Infinity:dist.get(step.to))){dist.set(step.to,next);prev.set(step.to,{node:node,step:step});}});
    }
    if(!dist.has(goal))return Object.freeze({reachable:false,distance:Infinity,path:[],edges:[],averageRisk:0});
    const path=[goal],used=[];let cursor=goal,riskTotal=0;
    while(cursor!==start){const p=prev.get(cursor);if(!p)break;used.push(p.step.edge);riskTotal+=p.step.risk;cursor=p.node;path.push(cursor);}
    path.reverse();used.reverse();
    return Object.freeze({reachable:true,distance:dist.get(goal),path:Object.freeze(path),edges:Object.freeze(used),averageRisk:used.length?riskTotal/used.length:0});
  }
  function scarcityBand(ratio,bands){
    const r=clamp01(ratio),list=(bands||[]).slice().sort(function(a,b){return finite(b.minRatio)-finite(a.minRatio);});
    for(let i=0;i<list.length;i++)if(r>=finite(list[i].minRatio))return list[i];
    return list[list.length-1]||{id:'default',minRatio:0,multiplier:1};
  }
  function scarcityMultiplier(ratio,bands){return Math.max(.01,finite(scarcityBand(ratio,bands).multiplier,1));}
  function demandAttenuation(economicDistance,decay){const d=Math.max(0,finite(economicDistance)),k=Math.max(.0001,finite(decay,30));return Math.exp(-d/k);}
  function propagatedDemand(pressure,economicDistance,decay){return Math.max(0,finite(pressure))*demandAttenuation(economicDistance,decay);}
  function weightedTierMultiplier(tier,tierMultipliers){const table=tierMultipliers||{};return Math.max(.01,finite(table[tier],1));}
  function quoteBreakdown(input){
    const p=input||{},base=Math.max(0,finite(p.baseValue))*weightedTierMultiplier(p.tier,p.tierMultipliers),scarcityMult=Math.max(.01,finite(p.scarcityMultiplier,1));
    const scarcityDelta=base*(scarcityMult-1),regionalDemand=Math.max(0,finite(p.regionalDemand)),other=finite(p.otherModifier),unit=Math.max(0,base+scarcityDelta+regionalDemand+other);
    return Object.freeze({base:base,scarcity:scarcityDelta,regionalDemand:regionalDemand,other:other,total:unit});
  }
  return Object.freeze({version:VERSION,DEFAULT_WEIGHTS:DEFAULT_WEIGHTS,finite:finite,clamp:clamp,clamp01:clamp01,normalizeWeights:normalizeWeights,riskBreakdown:riskBreakdown,economicEdgeCost:economicEdgeCost,shortestEconomicPath:shortestEconomicPath,scarcityBand:scarcityBand,scarcityMultiplier:scarcityMultiplier,demandAttenuation:demandAttenuation,propagatedDemand:propagatedDemand,weightedTierMultiplier:weightedTierMultiplier,quoteBreakdown:quoteBreakdown});
});
