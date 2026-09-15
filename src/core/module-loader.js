/* KELO-INDEX
 * area: CORE / BOOT
 * owner: KeloModuleLoader
 * keys: DYNAMIC LOAD IDLE FIRST-USE CACHE VERSION PING MOBILE SAFARI RECOVERY QUARANTINE TRACE STYLE ASSET-LIBRARY FEATURE-REGISTRY
 * purpose: un solo hilo de descarga. Plaza ya está viva; el resto entra al tocar un tool del menú. JS y CSS opcionales se cargan secuencialmente. Pausa si el player camina. La biblioteca puede bloquear paquetes opcionales.
 * public-api: KELO_MODULE_LOADER.start/ensure/needs/isReady/diagnostics
 * consumes: KELO_FEATURE_REGISTRY + optional KELO_ASSET_REGISTRY allow-list + optional KELO_RECOVERY_MESH diagnostics
 * do-not: NO tileset 556KB, NO studio, NO supabase, NO segundo gameLoop, NO SW, NO quarantine fuera de recoveryLab
 */
(function(root){
'use strict';
if(root.KELO_MODULE_LOADER)return;
const VERSION='kelo-module-loader-v10-feature-registry';
const LEGACY_FALLBACK=Object.freeze({
  social:Object.freeze([
    {src:'src/ui/player-nameplate.js?v=2',name:'placas'},
    {src:'src/systems/nobility.js?v=4',name:'títulos'},
    {src:'src/environment/plaza-depth.js?v=219',name:'plaza'},
    {src:'src/ui/profile-panel-close.js?v=2',name:'perfil'},
    {src:'src/ui/self-interaction-ui.js?v=1',name:'perfil'}
  ]),
  world:Object.freeze([
    {src:'engine-m.js?v=94',name:'mundo'},{src:'engine-n.js?v=230',name:'mundo'},{src:'engine-o.js?v=96',name:'mundo'},
    {src:'engine-p.js?v=96',name:'mundo'},{src:'engine-q.js?v=94',name:'mundo'},{src:'engine-s.js?v=96',name:'mundo'},
    {src:'engine-ah.js?v=95',name:'mundo'},{src:'engine-ai.js?v=95',name:'mundo'},{src:'src/systems/illumination.js?v=2',name:'luz'}
  ]),
  bag:Object.freeze([{src:'src/ui/backpack-fantasy-v1.css?v=1',name:'estilo mochila',type:'style'},{src:'src/systems/backpack-system.js?v=2',name:'mochila'},{src:'src/ui/backpack-ui.js?v=4',name:'mochila'}]),
  mounts:Object.freeze([{src:'src/mounts/mount-catalog.js?v=2',name:'monturas'},{src:'src/mounts/mount-system.js?v=2',name:'monturas'},{src:'src/ui/mount-panel.js?v=2',name:'monturas'}]),
  market:Object.freeze([{src:'src/systems/market-escrow-system.js?v=1',name:'mercado'},{src:'src/ui/market-ui.js?v=2',name:'mercado'}]),
  titles:Object.freeze([{src:'src/systems/title-catalog.js?v=1',name:'títulos'},{src:'src/systems/player-stats.js?v=1',name:'títulos'},{src:'src/systems/title-system.js?v=1',name:'títulos'}]),
  appearance:Object.freeze([{src:'src/characters/character-customization.js?v=1',name:'apariencia'},{src:'src/ui/character-customizer-ui.js?v=1',name:'apariencia'}]),
  properties:Object.freeze([{src:'src/property/property-system.js?v=4',name:'propiedades'},{src:'src/ui/house-instance-ui.js?v=1',name:'propiedades'}])
});
const loaded=Object.create(null);
const inflight=Object.create(null);
const failures=Object.create(null);
let build='V6.69';
let shown=false;

function registry(){return root.KELO_FEATURE_REGISTRY||null;}
function resolveName(name){
  const raw=String(name||'');
  const r=registry();
  if(r&&typeof r.resolve==='function')return r.resolve(raw);
  if(raw==='nobility'||raw==='emotes')return'social';
  return raw;
}
function featureIds(){const r=registry();return r&&Array.isArray(r.ids)?r.ids.slice():Object.keys(LEGACY_FALLBACK);}
function featureSpec(name){const r=registry();return r&&typeof r.get==='function'?r.get(name):null;}
function filesFor(name){const spec=featureSpec(name);return spec?.files||LEGACY_FALLBACK[name]||null;}
function dependenciesFor(name){const spec=featureSpec(name);return Array.isArray(spec?.dependencies)?spec.dependencies:[];}
function emit(type,detail){
  try{root.dispatchEvent(new CustomEvent(type,{detail:Object.freeze({...detail})}));}catch(_){}
  try{root.KELO_RECOVERY_MESH?.mark?.(String(type).replace(/^kelo:/,'').replace(/-/g,'_').toUpperCase(),detail);}catch(_){}
}
function recoveryQuery(){try{return new URLSearchParams(root.location?.search||'');}catch(_){return null;}}
function recoveryEnabled(){const q=recoveryQuery();return !!q&&(q.get('recoveryLab')==='1'||q.get('debugRecovery')==='1'||q.get('freezeLab')==='1');}
function quarantined(name){
  if(!recoveryEnabled())return false;
  try{if(root.KELO_RECOVERY_MESH?.shouldSkip?.(name))return true;}catch(_){}
  const q=recoveryQuery();
  return String(q?.get('recoverySkip')||'').split(',').map(v=>v.trim()).filter(Boolean).includes(String(name));
}
function assetAllowed(name){
  try{if(!root.KELO_ASSET_REGISTRY||typeof root.KELO_ASSET_REGISTRY.isEnabled!=='function')return true;return root.KELO_ASSET_REGISTRY.isEnabled(name)!==false;}catch(_){return true;}
}
function busy(){try{if(typeof input!=='undefined'&&input&&(Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02||input.active))return true;}catch(_){}return false;}
function box(){return document.getElementById('kelo-module-loader');}
function textEl(){return document.getElementById('kelo-ml-text');}
function barEl(){return document.getElementById('kelo-ml-bar');}
function show(msg,pct){const el=box();if(!el)return;el.hidden=false;shown=true;const t=textEl();if(t)t.textContent=msg;const b=barEl();if(b)b.style.width=Math.max(0,Math.min(100,pct||0))+'%';}
function hideChip(msg){const el=box();if(!el)return;if(shown){show(msg||'Listo',100);setTimeout(function(){el.hidden=true;},800);}else el.hidden=true;}
function base(src){return String(src||'').split('?')[0];}
function hasAsset(item){
  const target=base(item.src);
  if(item.type==='style')return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(function(link){return base(link.getAttribute('href'))===target;});
  return Array.from(document.scripts).some(function(script){return base(script.getAttribute('src'))===target;});
}
function loadOne(item,feature){
  return new Promise(function(resolve){
    if(hasAsset(item)){emit('kelo:module-load-end',{feature,src:item.src,type:item.type||'script',ok:true,ms:0,cached:true});resolve({ms:0,ok:true,cached:true});return;}
    const t0=performance.now(),type=item.type==='style'?'style':'script';
    emit('kelo:module-load-start',{feature,src:item.src,name:item.name,type});
    const node=type==='style'?document.createElement('link'):document.createElement('script');
    if(type==='style'){node.rel='stylesheet';node.href=item.src;}else{node.src=item.src;node.async=false;}
    node.onload=function(){const ms=performance.now()-t0;emit('kelo:module-load-end',{feature,src:item.src,type,ok:true,ms:Math.round(ms),cached:false});resolve({ms,ok:true,cached:false});};
    node.onerror=function(){const ms=performance.now()-t0;failures[item.src]=(failures[item.src]||0)+1;emit('kelo:module-load-error',{feature,src:item.src,type,ok:false,ms:Math.round(ms),error:type==='style'?'STYLE_LOAD_ERROR':'SCRIPT_LOAD_ERROR',count:failures[item.src]});resolve({ms,ok:false,cached:false});};
    document.head.appendChild(node);
  });
}
function loadFeature(name,opts){
  name=resolveName(name);
  const files=filesFor(name);
  if(!files)return Promise.resolve(true);
  if(!assetAllowed(name)){emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED'});return Promise.resolve(false);}
  if(quarantined(name)){emit('kelo:module-quarantined',{feature:name,src:'',ok:false,error:'RECOVERY_QUARANTINE'});return Promise.resolve(false);}
  if(loaded[name])return Promise.resolve(true);
  if(inflight[name])return inflight[name];
  const interactive=!!(opts&&opts.interactive);
  inflight[name]=new Promise(function(resolve){
    let i=0,errors=0;
    function step(){
      if(!assetAllowed(name)){delete inflight[name];emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED_DURING_LOAD'});resolve(false);return;}
      if(i>=files.length){loaded[name]=errors===0;delete inflight[name];try{if(errors===0)localStorage.setItem('kelo_modpack_'+name,build);}catch(_){}emit('kelo:module-feature-complete',{feature:name,ok:errors===0,files:files.length,errors});resolve(errors===0);return;}
      if(!interactive&&busy()){if(shown)show('En pausa · caminando',(i/files.length)*100);setTimeout(step,450);return;}
      const item=files[i];
      loadOne(item,name).then(function(result){const dt=Number(result&&result.ms)||0;if(!result||!result.ok)errors++;if(dt>=50)show('Descargando '+item.name+'  '+(i+1)+'/'+files.length,((i+1)/files.length)*100);i+=1;setTimeout(step,dt<50?80:360);});
    }
    step();
  });
  return inflight[name];
}
function ensureDependencies(name){
  const deps=dependenciesFor(name);
  let chain=Promise.resolve(true);
  for(const dep of deps)chain=chain.then(ok=>ok===false?false:loadFeature(resolveName(dep),{interactive:true}));
  return chain;
}
function ensure(name){
  if(name==='chat'||name==='profile')return Promise.resolve(true);
  if(name==='pvp'){
    if(root.KeloRuntimeBootstrap&&typeof root.KeloRuntimeBootstrap.ensure==='function')return root.KeloRuntimeBootstrap.ensure();
    return Promise.resolve(false);
  }
  name=resolveName(name);
  if(!filesFor(name))return Promise.resolve(true);
  if(!assetAllowed(name)){emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED'});hideChip('Desactivado en Assets');return Promise.resolve(false);}
  if(quarantined(name)){emit('kelo:module-quarantined',{feature:name,src:'',ok:false,error:'RECOVERY_QUARANTINE'});return Promise.resolve(false);}
  show('Cargando '+name+'…',8);
  return ensureDependencies(name).then(ok=>ok===false?false:loadFeature(name,{interactive:true})).then(function(ok){hideChip(ok?'Listo':'Fallo al cargar');return ok;});
}
function needs(name){
  if(name==='chat'||name==='profile')return false;
  if(name==='pvp')return !(root.KeloMeleeEngine&&root.KeloCombatEngine);
  name=resolveName(name);
  if(!filesFor(name))return false;
  if(!assetAllowed(name))return true;
  return !loaded[name];
}
function start(opts){
  if(opts&&opts.build)build=String(opts.build);
  const el=box();if(el)el.hidden=true;
  emit('kelo:module-loader-start',{build,version:VERSION,registryVersion:registry()?.version||'legacy-fallback',assetSelection:root.KELO_ASSET_REGISTRY?.getState?.().features||null});
}
function diagnostics(){
  const ids=featureIds();
  return Object.freeze({version:VERSION,registryVersion:registry()?.version||'legacy-fallback',build,features:ids,enabled:ids.filter(assetAllowed),disabled:ids.filter(function(k){return !assetAllowed(k);}),loaded:Object.keys(loaded).filter(function(k){return loaded[k];}),inflight:Object.keys(inflight),failures:{...failures},quarantined:ids.filter(quarantined)});
}
root.KELO_MODULE_LOADER=Object.freeze({version:VERSION,start,ensure,needs,isReady:function(n){return !!loaded[resolveName(n)];},canLoad:assetAllowed,features:featureIds(),diagnostics});
})(typeof globalThis!=='undefined'?globalThis:window);
