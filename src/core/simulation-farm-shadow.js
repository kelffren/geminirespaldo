/* KELO-INDEX
 * area: CORE / SIMULATION / LEGACY MODERNIZATION
 * owner: SimulationFarmShadow
 * keys: FARM TICK SHADOW PARITY COOP PEN EGGS PORK
 * purpose: compare the legacy engine-c farm completion tick with a read-only prediction
 * public-api: KELO_SIMULATION_FARM_SHADOW.snapshot
 * consumes: KeloSimulation before/after hooks + STATE snapshot supplied by the simulation bridge
 * state-owned: shadow counters only; never gameplay state
 * legacy: observes engine-c farm tick while legacy remains authoritative
 * do-not: NO gameplay writes, NO saveState, NO toast, NO timer, NO second game loop
 */
(function(root){
  'use strict';
  if(root.KELO_SIMULATION_FARM_SHADOW)return;
  const VERSION='simulation-farm-shadow-v1';
  const MODE='SHADOW';
  const BOUNDARY_MS=50;
  const LOOKAHEAD_MS=250;
  const stats={comparisons:0,divergences:0,boundarySkips:0,observedTicks:0,last:null};
  const pending=[];

  function n(value,fallback){const x=Number(value);return Number.isFinite(x)?x:(fallback||0);}
  function capture(state){
    const farm=state&&state.farm||{};
    const silo=state&&state.silo||{};
    const coop=farm.coop||null,pen=farm.pen||null;
    return {
      coop:coop?{ready:!!coop.ready,fedAt:n(coop.fedAt),duration:n(coop.duration),eggs:n(silo.eggs)}:null,
      pen:pen?{ready:!!pen.ready,fedAt:n(pen.fedAt),duration:n(pen.duration),pork:n(silo.pork)}:null
    };
  }
  function remainingMs(animal,now){
    if(!animal||animal.ready||!(animal.fedAt>0)||!(animal.duration>=0))return Infinity;
    return animal.duration*1000-(now-animal.fedAt);
  }
  function relevant(snapshot,now){
    return remainingMs(snapshot.coop,now)<=LOOKAHEAD_MS||remainingMs(snapshot.pen,now)<=LOOKAHEAD_MS;
  }
  function nearBoundary(snapshot,now){
    const values=[remainingMs(snapshot.coop,now),remainingMs(snapshot.pen,now)].filter(Number.isFinite);
    return values.some(function(v){return Math.abs(v)<=BOUNDARY_MS;});
  }
  function project(snapshot,now){
    const out={
      coop:snapshot.coop?Object.assign({},snapshot.coop):null,
      pen:snapshot.pen?Object.assign({},snapshot.pen):null
    };
    if(out.coop&&!out.coop.ready&&out.coop.fedAt>0&&(now-out.coop.fedAt)/1000>=out.coop.duration){
      out.coop.ready=true;out.coop.eggs+=2;out.coop.fedAt=0;
    }
    if(out.pen&&!out.pen.ready&&out.pen.fedAt>0&&(now-out.pen.fedAt)/1000>=out.pen.duration){
      out.pen.ready=true;out.pen.pork+=1;out.pen.fedAt=0;
    }
    return out;
  }
  function sameAnimal(expected,actual,kind){
    if(expected===null||actual===null)return expected===actual;
    const product=kind==='coop'?'eggs':'pork';
    return expected.ready===actual.ready&&expected.fedAt===actual.fedAt&&expected[product]===actual[product];
  }
  function compare(expected,actual){
    return sameAnimal(expected.coop,actual.coop,'coop')&&sameAnimal(expected.pen,actual.pen,'pen');
  }
  function snapshot(){
    return Object.freeze({version:VERSION,mode:MODE,installed:!!root.KeloSimulation,stateWrites:false,comparisons:stats.comparisons,divergences:stats.divergences,boundarySkips:stats.boundarySkips,observedTicks:stats.observedTicks,last:stats.last?Object.freeze(Object.assign({},stats.last)):null});
  }

  if(!root.KeloSimulation||typeof root.KeloSimulation.before!=='function'||typeof root.KeloSimulation.after!=='function'){
    root.KELO_SIMULATION_FARM_SHADOW=Object.freeze({version:VERSION,mode:MODE,installed:false,stateWrites:false,snapshot:snapshot});
    root.KELO_SIMULATION_FARM_SHADOW_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'KeloSimulation-missing',mode:MODE,stateWrites:false});
    return;
  }

  root.KeloSimulation.before('SimulationFarmShadow',function(ctx){
    const now=Date.now();
    const before=capture(ctx&&ctx.state);
    if(!relevant(before,now)){pending.push(null);return;}
    stats.observedTicks++;
    pending.push({at:now,before:before,expected:project(before,now),boundary:nearBoundary(before,now)});
  },-10000);

  root.KeloSimulation.after('SimulationFarmShadow',function(ctx){
    const item=pending.pop();
    if(!item)return;
    if(item.boundary){
      stats.boundarySkips++;
      stats.last={match:null,reason:'boundary-window',at:item.at};
      return;
    }
    const actual=capture(ctx&&ctx.state);
    const match=compare(item.expected,actual);
    stats.comparisons++;
    if(!match)stats.divergences++;
    stats.last={match:match,at:item.at,expected:item.expected,actual:actual};
    if(!match&&root.console&&typeof root.console.warn==='function')root.console.warn('[Kelo Farm Shadow] divergence',stats.last);
  },10000);

  root.KELO_SIMULATION_FARM_SHADOW=Object.freeze({version:VERSION,mode:MODE,installed:true,stateWrites:false,snapshot:snapshot});
  root.KELO_SIMULATION_FARM_SHADOW_AUDIT=Object.freeze({
    version:VERSION,installed:true,mode:MODE,stateWrites:false,legacyAuthority:true,secondLoop:false,timers:0,
    get comparisons(){return stats.comparisons;},get divergences(){return stats.divergences;},get boundarySkips(){return stats.boundarySkips;}
  });
})(typeof globalThis!=='undefined'?globalThis:window);
