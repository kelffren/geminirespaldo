/* KELO-INDEX
 * area: CREATORS / CONTENT
 * owner: Universal Creator content schema registry
 * owns: tabular aliases, normalization and validation of semantic content definitions
 * does-not-own: bytes, rendering, inventory, gameplay authority or Supabase transport
 * reuse: Spreadsheet/CSV/XLSX/manual forms all normalize through this module
 */
const F=Object.freeze;
const split=v=>String(v??'').split(/[|;,]/).map(x=>x.trim()).filter(Boolean);
const slug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63)||'content';
const num=v=>v===''||v==null?null:(Number.isFinite(Number(v))?Number(v):null);
function json(v,fallback={}){if(v&&typeof v==='object')return v;if(!String(v||'').trim())return fallback;try{return JSON.parse(String(v));}catch{return fallback;}}

export const CONTENT_TYPE_ALIASES=F({
  prop:'world',environment:'world',world_asset:'world',tree:'world',building:'world',house:'world',decor:'world',
  tileset:'tile',ground:'tile',floor:'tile',
  armor:'equipment',armour:'equipment',weapon:'equipment',gear:'equipment',
  clothes:'appearance',clothing:'appearance',outfit:'appearance',costume:'appearance',hair:'appearance',cosmetic:'appearance',skin:'appearance',
  hero:'character',player:'character',npc_skin:'character',
  horse:'mount',pet_mount:'mount',
  effect:'vfx',fx:'vfx',sound:'audio',music:'audio'
});

export const CONTENT_SCHEMAS=F({
  world:F({label:'World Asset',owner:'KELO_PROPERTY_CATALOG',assetRoles:F(['primary']),required:F(['primary']),fields:F(['family','category','worldWidth','worldHeight','collisionMode','renderPhase','districts'])}),
  tile:F({label:'Tile / Ground',owner:'KELO_PROPERTY_CATALOG',assetRoles:F(['primary']),required:F(['primary']),fields:F(['family','category','worldWidth','worldHeight','districts'])}),
  appearance:F({label:'Appearance / Outfit',owner:'KeloAppearance',assetRoles:F(['primary','portrait']),required:F(['primary','slotId']),fields:F(['slotId','targetType','compatibleProfiles','rigProfileId','rarity','layerRules','transforms','animationMapping'])}),
  equipment:F({label:'Equipment / Armor / Weapon',owner:'KeloAppearance + Equipment content',assetRoles:F(['primary','portrait']),required:F(['primary','slotId']),fields:F(['slotId','family','rigProfileId','compatibleProfiles','rarity','baseStats','specialStats','weaponProfileId'])}),
  character:F({label:'Character',owner:'KeloCharacterContentPacks',assetRoles:F(['primary','idle','walk','run','attack','cast','hit','death','portrait']),required:F(['primary|idle']),fields:F(['rigProfileId','directions','animationSetId','slots','rarity'])}),
  mount:F({label:'Mount',owner:'KeloMountCatalog',assetRoles:F(['primary','idle','walk','run','attack','hit','portrait']),required:F(['primary','speciesId']),fields:F(['speciesId','movementProfileId','appearanceProfileId','equipmentSlotProfileId','animationSetId','riderAnchorProfileId','abilityIds','rarity'])}),
  vfx:F({label:'VFX',owner:'Kelo VFX definitions',assetRoles:F(['primary','mask','normal']),required:F(['primary']),fields:F(['anchor','durationMs','loop','blendMode','scale'])}),
  item:F({label:'Item',owner:'Item content',assetRoles:F(['primary','portrait']),required:F(['primary']),fields:F(['family','rarity','maxStack','baseStats','specialStats'])}),
  audio:F({label:'Audio',owner:'Audio content',assetRoles:F(['primary']),required:F(['primary']),fields:F(['audioType','loop','volumeProfile'])}),
  ui:F({label:'UI Asset',owner:'UI content',assetRoles:F(['primary']),required:F(['primary']),fields:F(['category','state'])})
});

export function normalizeContentType(value){const raw=String(value||'world').trim().toLowerCase().replace(/\s+/g,'_');return CONTENT_TYPE_ALIASES[raw]||raw;}
function assetRefs(row){
  const out=[];const seen=new Set();
  const add=(role,value)=>{for(const file of split(value)){const key=`${role}:${file}`.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(F({role:String(role||'primary').toLowerCase(),file}));}};
  add('primary',row.file||row.filename||row.asset||row.image||row.src);
  for(const key of Object.keys(row||{})){
    const m=String(key).match(/^(?:file|asset)[._-](.+)$/i);if(m)add(m[1],row[key]);
  }
  for(const role of ['idle','walk','run','attack','cast','hit','death','portrait','mask','normal'])if(row[role])add(role,row[role]);
  return F(out);
}
function commonPayload(row,type){
  return {
    subtype:String(row.subtype||'').trim()||null,
    family:String(row.family||'').trim()||null,
    category:String(row.category||'').trim()||null,
    rigProfileId:String(row.rigProfileId||row.rig||'').trim()||null,
    slotId:String(row.slotId||row.slot||'').trim()||null,
    targetType:String(row.targetType||'character').trim(),
    compatibleProfiles:split(row.compatibleProfiles||row.profiles),
    speciesId:String(row.speciesId||row.species||'').trim()||null,
    movementProfileId:String(row.movementProfileId||'').trim()||null,
    appearanceProfileId:String(row.appearanceProfileId||'').trim()||null,
    equipmentSlotProfileId:String(row.equipmentSlotProfileId||'').trim()||null,
    animationSetId:String(row.animationSetId||row.animationSet||'').trim()||null,
    riderAnchorProfileId:String(row.riderAnchorProfileId||'').trim()||null,
    weaponProfileId:String(row.weaponProfileId||'').trim()||null,
    abilityIds:split(row.abilityIds||[row.ability1Id,row.ability2Id,row.ability3Id].filter(Boolean).join('|')),
    directions:num(row.directions)||null,
    slots:split(row.slots),
    districts:split(row.districts||row.biomes),
    rarity:String(row.rarity||'common').trim(),
    worldWidth:num(row.worldWidth??row.world_w??row.width),
    worldHeight:num(row.worldHeight??row.world_h??row.height),
    collisionMode:String(row.collisionMode||row.collision||'none').trim(),
    renderPhase:String(row.renderPhase||row.layer||'world').trim(),
    baseStats:json(row.baseStats||row.stats,{}),
    specialStats:json(row.specialStats,{}),
    transforms:json(row.transforms,{}),
    layerRules:json(row.layerRules,{}),
    animationMapping:json(row.animationMapping,{}),
    metadata:Object.assign({},json(row.metadata,{}),{source:'spreadsheet',contentType:type})
  };
}

export function normalizeTabularContentRow(row,index=0){
  const type=normalizeContentType(row?.contentType||row?.type||row?.kind||'world');
  const schema=CONTENT_SCHEMAS[type]||F({label:type,owner:'Universal content only',required:F([]),assetRoles:F(['primary']),fields:F([])});
  const displayName=String(row?.displayName||row?.name||row?.title||'').trim();
  const idSource=row?.slug||row?.id||displayName||`row-${index+2}`;
  const refs=assetRefs(row||{});
  const tags=split(row?.tags);
  const publish=/^(1|true|yes|si|sí|global|official)$/i.test(String(row?.publish||row?.public||''));
  const visibility=/official/i.test(String(row?.publish||row?.visibility||''))?'official':'global';
  return F({schemaVersion:1,sourceRow:index+2,contentType:type,schema,slug:slug(idSource),displayName:displayName||slug(idSource),tags:F(tags),publish,visibility,assetRefs:refs,payload:F(commonPayload(row||{},type)),raw:row});
}

export function validateContentDraft(draft){
  const errors=[],warnings=[];if(!draft?.contentType)errors.push('CONTENT_TYPE_REQUIRED');if(!draft?.slug)errors.push('SLUG_REQUIRED');if(!draft?.displayName)errors.push('DISPLAY_NAME_REQUIRED');
  const roles=new Set((draft?.assetRefs||[]).map(x=>x.role));
  for(const req of draft?.schema?.required||[]){if(req.includes('|')){if(!req.split('|').some(x=>roles.has(x)))errors.push('ASSET_ROLE_REQUIRED:'+req);}else if(req==='slotId'){if(!draft.payload?.slotId)errors.push('SLOT_REQUIRED');}else if(req==='speciesId'){if(!draft.payload?.speciesId)errors.push('SPECIES_REQUIRED');}else if(!roles.has(req))errors.push('ASSET_ROLE_REQUIRED:'+req);}
  if(!CONTENT_SCHEMAS[draft?.contentType])warnings.push('UNKNOWN_CONTENT_TYPE_GENERIC_ONLY');
  if(draft?.contentType==='mount'&&(draft.payload?.abilityIds||[]).length!==3)warnings.push('MOUNT_NEEDS_3_ABILITIES_FOR_RUNTIME_REGISTER');
  if(['appearance','equipment'].includes(draft?.contentType)&&!(draft.payload?.compatibleProfiles||[]).length)warnings.push('COMPATIBLE_PROFILE_WILL_AUTO_RESOLVE');
  return F({ok:errors.length===0,errors:F(errors),warnings:F(warnings)});
}

export function contentSpreadsheetHeaders(){return F(['type','id','name','file','file_idle','file_walk','file_run','file_attack','file_hit','file_death','portrait','subtype','family','category','rig','slot','profiles','species','movementProfileId','appearanceProfileId','equipmentSlotProfileId','animationSetId','abilityIds','world_w','world_h','collision','layer','rarity','tags','publish']);}
