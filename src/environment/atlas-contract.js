/* KELO-INDEX
 * area: ENVIRONMENT / ASSETS
 * owner: KELO_ATLAS_CONTRACT
 * keys: ATLAS ASSET ACQUIRE RELEASE REFCOUNT CORE DISTRICT OPTIONAL WARM EVICT MEMORY PERFORMANCE
 * purpose: única creación/carga de atlas y lifecycle refcount + warm eviction para recursos no-core
 * public-api: register/acquire/release/evict/describe/runtimeSnapshot/catalog
 * consumes: KELO_TILE_REGISTRY y contratos de atlas registrados
 * state-owned: records metadata + runtime Image/refcounts/warm timers
 * reuse: world, props y features adquieren por key; nunca reescriben src por su cuenta
 * online: N/A; assets son presentación local
 * do-not: NO crear Image en consumers gestionados, NO liberar core, NO polling de memoria
 */
(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  if(!R?.atlases){console.error('[Kelo atlas] TileRegistry missing');return;}

  const POLICY=Object.freeze({
    id:'kelo-atlas-contract-v1',version:'1.3.0',sampling:'nearest',maxDimension:2048,
    preferredDimensions:Object.freeze([128,256,512,1024]),
    tiers:Object.freeze({
      small:Object.freeze({maxDimension:256,use:'small tile/prop families'}),
      medium:Object.freeze({maxDimension:1024,use:'district/environment families'}),
      large:Object.freeze({maxDimension:2048,use:'rare large prefabs only'})
    }),
    packing:Object.freeze({
      grid:Object.freeze({paddingMin:0,spacingMin:0,requiresExactCellGrid:true}),
      packedSprites:Object.freeze({paddingMin:1,spacingMin:1,extrudeRecommended:true})
    }),
    cache:Object.freeze({strategy:'versioned-url-or-embedded',required:true,acceptedQueryKeys:Object.freeze(['art','v'])}),
    loading:Object.freeze({core:'eager',district:'lazy-when-district-needed',optional:'lazy-on-first-use'}),
    unloading:Object.freeze({core:'retain',district:'warm-then-evict',optional:'warm-then-evict',districtWarmMs:30000,optionalWarmMs:10000}),
    ownership:Object.freeze({imageCreation:'atlas-contract-only',consumerRule:'acquire-by-key-never-rewrite-src'}),
    missingAsset:Object.freeze({mode:'fail-visible-and-report',allowSilentMissing:false})
  });

  const ROLE_BY_KEY=Object.freeze({
    cesped:'core',plaza:'core',plazaGround:'core',transitions:'core',grassVariation:'core',marbleVariation:'core',plazaNature:'core',
    trainingDummy:'optional',plazaNpcs:'optional',
    ruralSoil:'district',ruralProps:'district',ruralLandmarks:'district',ruralNature:'district',
    gardensBase:'district',gardensJoins:'district',luxeBoutique:'optional'
  });
  const records=new Map();
  const runtime=new Map();

  function tierForAtlas(atlas){const d=Math.max(Number(atlas?.width)||0,Number(atlas?.height)||0);if(d<=256)return 'small';if(d<=1024)return 'medium';return 'large';}
  function cacheToken(src){if(typeof src==='string'&&src.startsWith('data:'))return ['embedded','content-addressed'];try{const u=new URL(src,location.href);return [...u.searchParams.entries()].find(([k])=>POLICY.cache.acceptedQueryKeys.includes(k))||null;}catch{return null;}}
  function normalize(key,atlas,role){return Object.freeze({key,id:atlas?.id||key,src:atlas?.src,width:Number(atlas?.width)||0,height:Number(atlas?.height)||0,role:role||ROLE_BY_KEY[key]||'optional',tier:tierForAtlas(atlas),cacheToken:cacheToken(atlas?.src),grid:Boolean(atlas?.tileWidth&&atlas?.tileHeight&&atlas?.columns),sampling:POLICY.sampling});}
  function register(key,atlas,opts={}){if(!key||!atlas)return null;const entry=normalize(key,atlas,opts.role);records.set(key,entry);refreshAudit();return entry;}
  function validate(entry){const v=[];if(!entry.src)v.push(`${entry.key}: missing src`);if(!(entry.width>0&&entry.height>0))v.push(`${entry.key}: invalid dimensions`);if(Math.max(entry.width,entry.height)>POLICY.maxDimension)v.push(`${entry.key}: exceeds ${POLICY.maxDimension}px`);if(POLICY.cache.required&&!entry.cacheToken)v.push(`${entry.key}: missing versioned URL cache token`);return v;}
  function defaultWarmMs(role){if(role==='district')return POLICY.unloading.districtWarmMs;if(role==='optional')return POLICY.unloading.optionalWarmMs;return 0;}
  function cancelEviction(state){if(state?.evictTimer){clearTimeout(state.evictTimer);state.evictTimer=0;}if(state)state.warmUntil=0;}
  function evict(key,reason){
    const state=runtime.get(key),entry=records.get(key);
    if(!state||entry?.role==='core'||state.refs>0)return false;
    cancelEviction(state);
    try{state.image.onload=null;state.image.onerror=null;state.image.src='';}catch(e){}
    runtime.delete(key);refreshAudit();
    try{window.dispatchEvent(new CustomEvent('kelo:atlas-evicted',{detail:{key,role:entry?.role||state.role,reason:reason||'release'}}));}catch(e){}
    return true;
  }
  function refreshAudit(){
    const violations=[...records.values()].flatMap(validate);
    const loadedEntries=[...runtime].filter(([,v])=>v.image?.complete&&v.image?.naturalWidth>0);
    const decodedBytes=loadedEntries.reduce((sum,[,v])=>sum+(v.image.naturalWidth*v.image.naturalHeight*4),0);
    const residentDistrictAtlasCount=loadedEntries.filter(([k])=>records.get(k)?.role==='district').length;
    const warm=Object.freeze([...runtime].filter(([,v])=>v.refs===0&&v.warmUntil>0).map(([k,v])=>Object.freeze({key:k,warmUntil:v.warmUntil})));
    window.KELO_ATLAS_AUDIT=Object.freeze({version:POLICY.version,policyId:POLICY.id,atlasCount:records.size,violations:Object.freeze(violations),roles:Object.freeze(Object.fromEntries([...records].map(([k,v])=>[k,v.role]))),loaded:Object.freeze(loadedEntries.map(([k])=>k)),refCounts:Object.freeze(Object.fromEntries([...runtime].map(([k,v])=>[k,v.refs]))),warm,decodedTextureMB:decodedBytes/(1024*1024),residentDistrictAtlasCount});
    try{window.dispatchEvent(new CustomEvent('kelo:atlas-audit'));}catch{}
    if(violations.length)console.error('[Kelo atlas] contract violations',violations);
  }
  function acquire(key){
    const entry=records.get(key);if(!entry)return Promise.reject(new Error(`[Kelo atlas] unknown asset ${key}`));
    let state=runtime.get(key);
    if(state){cancelEviction(state);state.refs++;refreshAudit();return state.promise;}
    const image=new Image();
    const promise=new Promise((resolve,reject)=>{
      image.onload=()=>{if(image.naturalWidth!==entry.width||image.naturalHeight!==entry.height){reject(new Error(`[Kelo atlas] ${key} dimension mismatch ${image.naturalWidth}x${image.naturalHeight}`));return;}refreshAudit();resolve(image);};
      image.onerror=()=>reject(new Error(`[Kelo atlas] failed to load ${key}`));
      image.src=entry.src;
    });
    state={image,promise,refs:1,role:entry.role,warmUntil:0,evictTimer:0};runtime.set(key,state);refreshAudit();return promise;
  }
  // KELO-INDEX ASSET/LIFECYCLE release baja refcount; district/optional pueden quedar WARM y luego se expulsan con un único timer, nunca polling.
  function release(key,opts={}){
    const state=runtime.get(key),entry=records.get(key);if(!state)return false;
    state.refs=Math.max(0,state.refs-1);
    if(state.refs>0||entry?.role==='core'){refreshAudit();return false;}
    cancelEviction(state);
    const warmMs=Math.max(0,Number(opts.warmMs==null?defaultWarmMs(entry?.role||state.role):opts.warmMs)||0);
    if(warmMs<=0)return evict(key,'release-immediate');
    state.warmUntil=Date.now()+warmMs;
    state.evictTimer=setTimeout(()=>{state.evictTimer=0;if(state.refs===0)evict(key,'warm-expired');},warmMs);
    refreshAudit();return true;
  }
  function describe(key){return records.get(key)||null;}
  function catalog(){return Object.freeze(Object.fromEntries(records));}
  function runtimeSnapshot(){return Object.freeze([...runtime].map(([key,state])=>Object.freeze({key,role:state.role,refs:state.refs,loaded:!!(state.image?.complete&&state.image?.naturalWidth>0),warmUntil:state.warmUntil||0})));}

  for(const [key,atlas] of Object.entries(R.atlases))register(key,atlas);
  if(window.KELO_GARDENS_ATLAS)register('gardensBase',window.KELO_GARDENS_ATLAS,{role:'district'});
  if(window.KELO_GARDENS_JOINS)register('gardensJoins',window.KELO_GARDENS_JOINS,{role:'district'});
  for(const [key,asset] of Object.entries(R.architectureAssets||{}))register(key,asset,{role:'optional'});
  refreshAudit();

  window.KELO_ATLAS_CONTRACT=Object.freeze({policy:POLICY,register,acquire,release,evict,describe,runtimeSnapshot,get catalog(){return catalog();},roleFor:key=>records.get(key)?.role||null,tierFor:key=>records.get(key)?.tier||null});
})();