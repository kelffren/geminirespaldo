/* KELO-INDEX
 * area: CREATORS / CONTENT INGEST
 * owner: Universal Creator content ingestion service
 * owns: validated job -> asset revisions -> semantic content revision -> runtime activation
 * does-not-own: spreadsheet parsing, auth UI, rendering, inventory or publication approval
 */
const MAX_BYTES=5*1024*1024,MAX_DIM=2048;
const F=Object.freeze;
const first=v=>Array.isArray(v)?v[0]:v;
const ext=file=>{const n=String(file?.name||'');const e=n.includes('.')?n.split('.').pop().toLowerCase():'';return e==='jpeg'?'jpg':(e||'bin');};
const safe=v=>String(v||'content').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63)||'content';
const kindFor=t=>({world:'prop',tile:'tile',appearance:'item',equipment:'item',character:'character',mount:'mount',vfx:'vfx',ui:'ui',audio:'audio',item:'item'}[t]||'other');
function stableJson(value){if(Array.isArray(value))return'['+value.map(stableJson).join(',')+']';if(value&&typeof value==='object')return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';return JSON.stringify(value);}
async function sha256(data,root=globalThis){let bytes;if(data instanceof ArrayBuffer)bytes=data;else if(ArrayBuffer.isView(data))bytes=data.buffer;else if(data?.arrayBuffer)bytes=await data.arrayBuffer();else bytes=new TextEncoder().encode(String(data)).buffer;if(root.crypto?.subtle){const digest=await root.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(const b of new Uint8Array(bytes)){h^=b;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0').repeat(4);}
async function imageInfo(file,root=globalThis){if(!/^image\/(png|webp|jpeg)$/.test(String(file?.type||'')))throw new Error('UNSUPPORTED_ASSET_MIME:'+String(file?.type||''));if(file.size<=0||file.size>MAX_BYTES)throw new Error('ASSET_FILE_SIZE_INVALID');if(root.createImageBitmap){const bmp=await root.createImageBitmap(file);const info={width:bmp.width,height:bmp.height};try{bmp.close();}catch{}if(info.width<1||info.height<1||info.width>MAX_DIM||info.height>MAX_DIM)throw new Error('ASSET_DIMENSIONS_INVALID');return info;}if(!root.document||!root.URL?.createObjectURL)throw new Error('IMAGE_DIMENSION_PROBE_UNAVAILABLE');const url=root.URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const info={width:img.naturalWidth,height:img.naturalHeight};if(info.width<1||info.height<1||info.width>MAX_DIM||info.height>MAX_DIM)reject(new Error('ASSET_DIMENSIONS_INVALID'));else resolve(info);};img.onerror=()=>reject(new Error('ASSET_IMAGE_INVALID'));img.src=url;});}finally{root.URL.revokeObjectURL(url);}}
async function dataUrl(file,root=globalThis){if(typeof FileReader==='undefined'&&!root.FileReader)return null;const Reader=root.FileReader||FileReader;return new Promise((resolve,reject)=>{const r=new Reader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('ASSET_DATA_URL_FAILED'));r.readAsDataURL(file);});}
async function ignoreConflict(fn){try{return await fn();}catch(error){if(Number(error?.status)===409||/duplicate|exists|conflict/i.test(String(error?.message||'')))return null;throw error;}}

export function createUniversalContentService({repository,runtimeRegistry,root=globalThis}={}){
  if(!repository)throw new Error('CONTENT_REPOSITORY_REQUIRED');if(!runtimeRegistry)throw new Error('CONTENT_RUNTIME_REGISTRY_REQUIRED');
  async function ingestAsset(draft,resolved,index){
    const file=resolved.file,role=String(resolved.role||'primary').toLowerCase(),uid=repository.userId();if(!uid)throw new Error('AUTH_REQUIRED');
    const info=await imageInfo(file,root),hash=await sha256(file,root),familySlug=safe(`${draft.slug}-${role}-${index}`),storagePath=`${uid}/${safe(draft.contentType)}/${draft.slug}/${role}/${hash.slice(0,16)}.${ext(file)}`;
    const family=first(await repository.createAssetFamily({p_slug:familySlug,p_name:`${draft.displayName} · ${role}`,p_kind:kindFor(draft.contentType),p_category:draft.payload?.category||draft.contentType,p_semantic_family:draft.payload?.family||draft.contentType,p_tags:Array.from(new Set([...(draft.tags||[]),draft.contentType,role])),p_districts:draft.payload?.districts||[],p_metadata:{contentType:draft.contentType,role,source:'universal-content-studio'}}));
    if(!family?.id)throw new Error('ASSET_FAMILY_CREATE_FAILED');
    await ignoreConflict(()=>repository.upload('creator-private',storagePath,file,{upsert:false}));
    const revision=first(await repository.registerAssetRevision({p_family_id:family.id,p_storage_path:storagePath,p_content_hash:hash,p_mime_type:file.type,p_byte_size:file.size,p_pixel_width:info.width,p_pixel_height:info.height,p_world_width:role==='primary'?draft.payload?.worldWidth:null,p_world_height:role==='primary'?draft.payload?.worldHeight:null,p_collision_mode:role==='primary'?(draft.payload?.collisionMode||'none'):'none',p_render_phase:role==='primary'?(draft.payload?.renderPhase||'world'):'world',p_metadata:{contentType:draft.contentType,role,sourceName:resolved.sourceName||file.name}}));
    if(!revision?.id)throw new Error('ASSET_REVISION_CREATE_FAILED');
    if(draft.publish)await repository.submitAssetRevision(revision.id);
    return F({role,assetRevisionId:revision.id,assetId:revision.asset_id,storageBucket:revision.storage_bucket||'creator-private',storagePath:revision.storage_path||storagePath,contentHash:hash,pixelWidth:info.width,pixelHeight:info.height,mimeType:file.type,byteSize:file.size,runtimeUrl:await dataUrl(file,root)});
  }
  async function importJob(job,{onProgress=null}={}){
    if(!job?.ok)throw new Error('CONTENT_JOB_INVALID:'+String(job?.errors||[]));const draft=job.draft;if(!repository.userId())throw new Error('AUTH_REQUIRED');
    onProgress?.({stage:'assets',row:draft.sourceRow,slug:draft.slug,done:0,total:job.resolvedAssets.length});
    const assets=[];for(let i=0;i<job.resolvedAssets.length;i++){assets.push(await ingestAsset(draft,job.resolvedAssets[i],i));onProgress?.({stage:'assets',row:draft.sourceRow,slug:draft.slug,done:i+1,total:job.resolvedAssets.length});}
    const definition=first(await repository.createContentDefinition({p_content_type:draft.contentType,p_slug:draft.slug,p_display_name:draft.displayName,p_tags:draft.tags,p_metadata:{schemaOwner:draft.schema?.owner||'universal',source:'spreadsheet'}}));if(!definition?.id)throw new Error('CONTENT_DEFINITION_CREATE_FAILED');
    const payload=Object.assign({},draft.payload,{assetRoles:Object.fromEntries(assets.map(a=>[a.role,a.assetId]))});const contentHash=await sha256(stableJson({payload,assets:assets.map(a=>({role:a.role,assetRevisionId:a.assetRevisionId}))}),root);
    const bindings=assets.map((a,ordinal)=>({assetRevisionId:a.assetRevisionId,role:a.role,ordinal,metadata:{assetId:a.assetId}}));
    const revision=first(await repository.registerContentRevision({p_definition_id:definition.id,p_content_hash:contentHash,p_schema_version:draft.schemaVersion||1,p_payload:payload,p_asset_bindings:bindings}));if(!revision?.id)throw new Error('CONTENT_REVISION_CREATE_FAILED');
    if(draft.publish)await repository.submitContentRevision(revision.id);
    const active=runtimeRegistry.register({contentId:revision.content_id,stableKey:definition.stable_key,revision:revision.revision,contentType:draft.contentType,displayName:draft.displayName,tags:draft.tags,payload,assets,contentHash,source:'supabase-creator'});
    onProgress?.({stage:'ready',row:draft.sourceRow,slug:draft.slug,contentId:revision.content_id,activation:active.activation});
    return F({row:draft.sourceRow,definition,revision,assets:F(assets),runtime:active,submitted:!!draft.publish});
  }
  async function importPlan(plan,{continueOnError=true,onProgress=null}={}){const results=[],errors=[];for(const job of plan?.validJobs||[]){try{results.push(await importJob(job,{onProgress}));}catch(error){const row=job?.draft?.sourceRow,entry={row,slug:job?.draft?.slug,error:String(error?.message||error)};errors.push(entry);onProgress?.({stage:'error',...entry});if(!continueOnError)throw error;}}return F({ok:errors.length===0,imported:F(results),errors:F(errors),requested:Number(plan?.validJobs?.length)||0});}
  return F({version:'universal-content-service-v1.0.0',importJob,importPlan});
}
