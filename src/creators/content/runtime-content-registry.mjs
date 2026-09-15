/* KELO-INDEX
 * area: CREATORS / CONTENT RUNTIME
 * owner: KELO_CREATOR_CONTENT_REGISTRY
 * owns: semantic creator definitions + adapter dispatch into existing runtime owners
 * does-not-own: rendering, inventory, stats, game authority, asset bytes or editor state
 * rule: adapt to KELO_PROPERTY_CATALOG/KeloAppearance/KeloMountCatalog/KeloCreatorAvatars; never replace them
 */
const F=Object.freeze;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const phase=v=>String(v||'world')==='foreground'||String(v||'')==='aboveActor'?'props_front':'props_back';
const runtimeId=r=>`${String(r.stableKey||r.contentId||'creator.content').replace(/@/g,':')}:r${Number(r.revision)||1}`;
function collision(payload,w,h){const mode=String(payload?.collisionMode||'none');if(mode==='full')return{x:0,y:0,w,h};if(mode==='trunk')return{x:w*.25,y:h*.68,w:w*.5,h:h*.32};return null;}
function versionedRuntimeUrl(url,hash){const raw=String(url||'');if(raw.startsWith('data:')||raw.startsWith('blob:'))return raw;const token=String(hash||'1').slice(0,12);return raw.includes('?')?`${raw}&v=${token}`:`${raw}?v=${token}`;}

export function createRuntimeContentRegistry({root=globalThis}={}){
  const rows=new Map(),listeners=new Set();
  function adaptWorld(record){
    const asset=record.assets?.find(a=>a.role==='primary')||record.assets?.[0],A=root.KELO_ATLAS_CONTRACT,P=root.KELO_PROPERTY_CATALOG;
    if(!asset?.runtimeUrl||!asset.pixelWidth||!asset.pixelHeight)return{status:'deferred',reason:'PRIMARY_RUNTIME_ASSET_REQUIRED'};
    if(!A?.register||!P?.registerTemplate)return{status:'deferred',reason:'WORLD_RUNTIME_OWNER_MISSING'};
    const key=`creator:${asset.assetId||runtimeId(record)}`,src=versionedRuntimeUrl(asset.runtimeUrl,asset.contentHash||record.contentHash);
    A.register(key,{id:asset.assetId||key,src,width:Number(asset.pixelWidth),height:Number(asset.pixelHeight)},{role:'optional'});
    const w=Math.max(1,Number(record.payload?.worldWidth)||Number(asset.pixelWidth)),h=Math.max(1,Number(record.payload?.worldHeight)||Number(asset.pixelHeight));
    const template=P.registerTemplate({id:record.contentId,label:record.displayName,category:record.payload?.category||'creator',family:record.payload?.family||record.contentType,districts:record.payload?.districts?.length?record.payload.districts:['*'],width:w,height:h,snap:32,collision:collision(record.payload,w,h),source:'creator-content',sourceId:record.contentId,parts:[{assetKey:key,source:{x:0,y:0,w:Number(asset.pixelWidth),h:Number(asset.pixelHeight)},offset:{x:0,y:0},size:{w,h},phase:phase(record.payload?.renderPhase)}]});
    return{status:'active',owner:'KELO_PROPERTY_CATALOG',runtimeId:template?.id||record.contentId};
  }
  function adaptAppearance(record){
    const A=root.KeloAppearance,asset=record.assets?.find(a=>a.role==='primary')||record.assets?.[0];if(!A?.registerItem)return{status:'deferred',reason:'APPEARANCE_OWNER_MISSING'};if(!asset?.assetId)return{status:'deferred',reason:'PRIMARY_ASSET_ID_REQUIRED'};
    let profiles=(record.payload?.compatibleProfiles||[]).filter(Boolean);if(!profiles.length)profiles=(A.listProfiles?.()||[]).filter(p=>p.targetType===String(record.payload?.targetType||'character')&&(!record.payload?.slotId||p.slots?.includes(record.payload.slotId))).map(p=>p.id).slice(0,8);
    if(!profiles.length||!record.payload?.slotId)return{status:'deferred',reason:'APPEARANCE_PROFILE_OR_SLOT_REQUIRED'};
    const id=runtimeId(record);if(A.getItem?.(id))return{status:'active',owner:'KeloAppearance',runtimeId:id};
    const item=A.registerItem({id,displayName:record.displayName,targetType:record.payload?.targetType||'character',slotId:record.payload.slotId,compatibleProfiles:profiles,assetBundleId:asset.assetId,transforms:record.payload?.transforms||{},layerRules:record.payload?.layerRules||{},animationMapping:record.payload?.animationMapping||{},tags:record.tags||[],rarity:record.payload?.rarity||'common'});
    return{status:'active',owner:'KeloAppearance',runtimeId:item.id};
  }
  function adaptMount(record){
    const M=root.KeloMountCatalog,asset=record.assets?.find(a=>a.role==='primary')||record.assets?.[0];if(!M?.register)return{status:'deferred',reason:'MOUNT_OWNER_MISSING'};if(!asset?.assetId)return{status:'deferred',reason:'PRIMARY_ASSET_ID_REQUIRED'};
    const p=record.payload||{},id=runtimeId(record);if(M.get?.(id))return{status:'active',owner:'KeloMountCatalog',runtimeId:id};
    if(!p.speciesId||!p.movementProfileId||!p.appearanceProfileId||!p.equipmentSlotProfileId||(p.abilityIds||[]).length!==3)return{status:'deferred',reason:'MOUNT_RUNTIME_DEPENDENCIES_REQUIRED'};
    try{const row=M.register({id,displayName:record.displayName,speciesId:p.speciesId,rarity:p.rarity||'common',movementProfileId:p.movementProfileId,abilityIds:p.abilityIds,appearanceProfileId:p.appearanceProfileId,equipmentSlotProfileId:p.equipmentSlotProfileId,assetBundleId:asset.assetId,animationSetId:p.animationSetId||'',riderAnchorProfileId:p.riderAnchorProfileId||p.appearanceProfileId,tags:record.tags||[],baseStats:p.baseStats||{},metadata:{creatorContentId:record.contentId}});return{status:'active',owner:'KeloMountCatalog',runtimeId:row.id};}catch(error){return{status:'deferred',reason:String(error?.message||error)};}
  }
  function adaptCharacter(record){
    if(!record.payload?.avatarRuntime)return{status:'active',owner:'KELO_CREATOR_CONTENT_REGISTRY',runtimeId:runtimeId(record),note:'Character definition live; no quick-avatar runtime manifest.'};
    if(!root.KeloCreatorAvatars?.register)return{status:'deferred',reason:'CREATOR_AVATAR_RUNTIME_MISSING'};
    const row=root.KeloCreatorAvatars.register(record);return row?{status:'active',owner:'KeloCreatorAvatars',runtimeId:record.contentId}:{status:'deferred',reason:'AVATAR_MANIFEST_INVALID'};
  }
  function adapt(record){const type=String(record.contentType||'');if(type==='world'||type==='tile')return adaptWorld(record);if(type==='appearance'||type==='equipment')return adaptAppearance(record);if(type==='mount')return adaptMount(record);if(type==='character')return adaptCharacter(record);return{status:'active',owner:'KELO_CREATOR_CONTENT_REGISTRY',runtimeId:runtimeId(record),note:'Semantic definition is live; specialized runtime adapter can consume it by contentType.'};}
  function register(raw,{adaptRuntime=true}={}){
    if(!raw?.contentId)throw new Error('CONTENT_ID_REQUIRED');const key=String(raw.contentId);if(rows.has(key))return rows.get(key);
    const base=F({contentId:key,stableKey:String(raw.stableKey||key),revision:Number(raw.revision)||1,contentType:String(raw.contentType||'generic'),displayName:String(raw.displayName||key),tags:F((raw.tags||[]).map(String)),payload:F(copy(raw.payload||{})),assets:F((raw.assets||[]).map(a=>F(copy(a)))),contentHash:String(raw.contentHash||''),source:String(raw.source||'creator')});
    const activation=adaptRuntime?adapt(base):{status:'registered',owner:'KELO_CREATOR_CONTENT_REGISTRY'};const row=F({...base,activation:F(copy(activation))});rows.set(key,row);listeners.forEach(fn=>{try{fn(row);}catch{}});try{root.dispatchEvent?.(new CustomEvent('kelo:creator-content-ready',{detail:{contentId:key,contentType:row.contentType,activation:row.activation}}));}catch{}return row;
  }
  function query(filter={}){let out=[...rows.values()];if(filter.contentType)out=out.filter(x=>x.contentType===filter.contentType);if(filter.tag)out=out.filter(x=>x.tags.includes(filter.tag));if(filter.owner)out=out.filter(x=>x.activation.owner===filter.owner);return out;}
  return F({version:'kelo-creator-content-registry-v1.1.0',register,registerMany:(items,opts)=>Array.from(items||[]).map(x=>register(x,opts)),get:id=>rows.get(String(id))||null,has:id=>rows.has(String(id)),list:()=>[...rows.values()],query,onRegister(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);},get count(){return rows.size;}});
}
