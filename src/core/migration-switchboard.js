/* KELO-INDEX
 * area: FOUNDATION / LEGACY MODERNIZATION
 * owner: Migration Switchboard
 * owns: migration mode selection and shadow-result comparison primitives
 * does-not-own: domain behavior, state mutation, legacy implementation, feature activation
 * purpose: provide LEGACY/SHADOW/NEW control without coupling domains to migration mechanics
 * public-api: createMigrationSwitchboard
 * extension-points: reporters, custom comparators, domain policies
 * reuse: movement/camera/world/render migrations
 */

const VALID_MODES = new Set(['LEGACY','SHADOW','NEW']);

function defaultCompare(legacyValue,newValue,tolerance=0){
  if(typeof legacyValue==='number' && typeof newValue==='number'){
    const delta=Math.abs(legacyValue-newValue);
    return {match:delta<=tolerance,delta,legacyValue,newValue};
  }
  const match=Object.is(legacyValue,newValue);
  return {match,delta:match?0:null,legacyValue,newValue};
}

export function createMigrationSwitchboard({domains={},reporter=null}={}){
  const state=new Map();
  for(const [domain,cfg] of Object.entries(domains)){
    const mode=cfg?.mode||'LEGACY';
    if(!VALID_MODES.has(mode)) throw new Error(`Invalid migration mode for ${domain}: ${mode}`);
    state.set(domain,{mode,owner:cfg?.owner||null,comparisons:0,divergences:0,last:null});
  }

  function requireDomain(domain){
    if(!state.has(domain)) state.set(domain,{mode:'LEGACY',owner:null,comparisons:0,divergences:0,last:null});
    return state.get(domain);
  }

  return Object.freeze({
    mode(domain){ return requireDomain(domain).mode; },
    snapshot(){ return Object.fromEntries([...state.entries()].map(([k,v])=>[k,{...v}])); },
    setMode(domain,mode){
      if(!VALID_MODES.has(mode)) throw new Error(`Invalid migration mode: ${mode}`);
      const row=requireDomain(domain);
      row.mode=mode;
      reporter?.({type:'migration-mode',domain,mode,owner:row.owner});
      return mode;
    },
    select(domain,{legacy,newer}){
      const mode=requireDomain(domain).mode;
      if(mode==='NEW') return newer;
      return legacy;
    },
    compare(domain,legacyValue,newValue,{tolerance=0,comparator=defaultCompare,context=null}={}){
      const row=requireDomain(domain);
      const result=comparator(legacyValue,newValue,tolerance);
      row.comparisons++;
      if(!result.match) row.divergences++;
      row.last={...result,context,at:Date.now()};
      reporter?.({type:result.match?'shadow-match':'shadow-divergence',domain,mode:row.mode,owner:row.owner,...row.last});
      return row.last;
    },
    shouldRunLegacy(domain){ return requireDomain(domain).mode!=='NEW'; },
    shouldRunShadow(domain){ return requireDomain(domain).mode==='SHADOW'; },
    shouldRunNew(domain){ return requireDomain(domain).mode!=='LEGACY'; }
  });
}
