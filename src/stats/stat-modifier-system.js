/* KELO-INDEX
 * area: STATS
 * owner: KeloStats
 * purpose: resolver compartido y determinista de modificadores para player/mount sin recalcular por frame
 * public-api: KeloStats.registerSource/unregisterSource/resolve/markDirty/validateModifier
 * consumes: providers de equipo, monturas, buffs y futuros owners
 * state-owned: registry de providers + revision/cache; NO posee inventario ni equipment slots
 * extension-points: source providers + scopes + operations
 * online: authority futura entrega fuentes/modifiers validados; resolver puede permanecer cliente para preview
 * do-not: no escribir STATE/equipment; no meter reglas por itemId; no calcular desde DOM
 */
(function(root,factory){
  const api=factory();
  if(root)root.KeloStats=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='stat-modifier-v1.0.0';
  const OPS=Object.freeze(['flatAdd','flatSubtract','percentAdd','percentMultiply','override','clampMin','clampMax']);
  const SCOPES=Object.freeze(['always','whileEquipped','whileMounted','whileDismounted','inCombat','outOfCombat']);
  const sources=new Map();
  const cache=new Map();
  let revision=1;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=v=>Number.isFinite(Number(v));
  function validateModifier(raw){
    const errors=[];
    if(!raw||typeof raw!=='object')return{ok:false,errors:['MODIFIER_REQUIRED']};
    if(!raw.id)errors.push('ID_REQUIRED');
    if(!raw.target)errors.push('TARGET_REQUIRED');
    if(!raw.stat)errors.push('STAT_REQUIRED');
    if(!OPS.includes(raw.operation))errors.push('OPERATION_INVALID');
    if(!finite(raw.value))errors.push('VALUE_INVALID');
    if(raw.scope&&!SCOPES.includes(raw.scope))errors.push('SCOPE_INVALID');
    return{ok:errors.length===0,errors};
  }
  function normalizeModifier(raw){
    const check=validateModifier(raw);if(!check.ok)return null;
    return Object.freeze({id:String(raw.id),target:String(raw.target),targetId:raw.targetId==null?null:String(raw.targetId),stat:String(raw.stat),operation:String(raw.operation),value:Number(raw.value),scope:String(raw.scope||'always'),sourceId:String(raw.sourceId||raw.id),priority:Number.isFinite(Number(raw.priority))?Number(raw.priority):0});
  }
  function scopeActive(scope,context){
    const c=context||{};
    if(scope==='always'||scope==='whileEquipped')return true;
    if(scope==='whileMounted')return c.mounted===true;
    if(scope==='whileDismounted')return c.mounted!==true;
    if(scope==='inCombat')return c.inCombat===true;
    if(scope==='outOfCombat')return c.inCombat!==true;
    return false;
  }
  function markDirty(){revision++;cache.clear();return revision;}
  function registerSource(id,provider){
    id=String(id||'');if(!id||typeof provider!=='function')throw new Error('KELO_STATS_SOURCE_INVALID');
    sources.set(id,provider);markDirty();return()=>unregisterSource(id);
  }
  function unregisterSource(id){const removed=sources.delete(String(id));if(removed)markDirty();return removed;}
  function collect(target,targetId,context){
    const out=[];
    for(const [sourceId,provider] of sources){
      let rows=[];try{rows=provider({target,targetId,context:context||{}})||[];}catch(error){console.error('[KeloStats source]',sourceId,error);continue;}
      for(const raw of Array.isArray(rows)?rows:[]){const m=normalizeModifier(raw);if(!m||m.target!==target)continue;if(m.targetId!=null&&String(targetId||'')!==m.targetId)continue;if(!scopeActive(m.scope,context))continue;out.push(m);}
    }
    return out.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  }
  function applyForStat(base,mods){
    let value=Number(base)||0,percentAdd=0,multiplier=1,override=null,min=-Infinity,max=Infinity;
    for(const m of mods){
      if(m.operation==='flatAdd')value+=m.value;
      else if(m.operation==='flatSubtract')value-=m.value;
      else if(m.operation==='percentAdd')percentAdd+=m.value;
      else if(m.operation==='percentMultiply')multiplier*=1+m.value;
      else if(m.operation==='override')override=m.value;
      else if(m.operation==='clampMin')min=Math.max(min,m.value);
      else if(m.operation==='clampMax')max=Math.min(max,m.value);
    }
    value=(value*(1+percentAdd))*multiplier;
    if(override!=null)value=override;
    return Math.max(min,Math.min(max,value));
  }
  function fingerprint(base,context){
    const keys=Object.keys(base||{}).sort();const b=keys.map(k=>k+':'+Number(base[k]||0)).join('|');
    const c=context||{};return b+'#'+[c.mounted===true?1:0,c.inCombat===true?1:0,c.mountId||''].join(':');
  }
  function resolve(target,baseStats,context,targetId){
    target=String(target||'player');const base=clone(baseStats||{});const fp=fingerprint(base,context);const key=[revision,target,targetId||'',fp].join('::');
    if(cache.has(key))return clone(cache.get(key));
    const mods=collect(target,targetId,context),stats=new Set(Object.keys(base));mods.forEach(m=>stats.add(m.stat));
    const final={};for(const stat of stats)final[stat]=applyForStat(base[stat],mods.filter(m=>m.stat===stat));
    const result={version:VERSION,target,targetId:targetId||null,revision,stats:final,modifiers:mods.map(clone)};cache.set(key,result);return clone(result);
  }
  return Object.freeze({version:VERSION,operations:OPS.slice(),scopes:SCOPES.slice(),registerSource,unregisterSource,markDirty,validateModifier,normalizeModifier,resolve,get revision(){return revision;},get sourceCount(){return sources.size;}});
});