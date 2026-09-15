/* KELO-INDEX
 * area: WORLD EDIT
 * keys: LOCAL AUTHORITY DRAFT REVIEW PUBLISH REVISION ROLLBACK AUDIT PROPERTY TERRAIN COLLISION
 * hace: simula offline las mismas reglas que aplicará el servidor; persiste drafts/revisiones y delega placements activos a Property
 * online: se sustituye por RemoteWorldEditAuthority sin cambiar UI ni formato de operaciones
 */
(function(){
'use strict';
if(window.LocalWorldEditAuthority)return;

const VERSION='local-world-edit-authority-v1.0.0';
const SCHEMA=1;
const WORLD_ID='world:kelo-main';
const WORLD_PARCEL_ID='parcel:world:editor';
const VALID_DRAFT_STATUSES=new Set(['DRAFT','SUBMITTED','APPROVED','REJECTED','PUBLISHED','DISCARDED']);
const MUTABLE_DRAFT_STATUSES=new Set(['DRAFT','REJECTED']);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const now=()=>Date.now();

class LocalWorldEditAuthority{
  constructor(){
    this.source='local';
    this.store=window.KELO_WORLD_DRAFT_STORE;
    this.rev=window.KELO_WORLD_REVISIONS;
    if(!this.store||!this.rev)throw new Error('WORLD_EDIT_LOCAL_DEPENDENCIES_MISSING');
    this.state=this._loadOrCreate();
  }

  _actor(payload){
    return String(payload?.actorId||window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  }
  _keyFor(actorId,scope){
    const rows=window.KELO_ADMIN_KEYS?.getActiveKeys?.(actorId)||[];
    return rows.find(k=>Array.isArray(k.scopes)&&k.scopes.includes(scope))||rows[0]||null;
  }
  _require(scope,actorId){
    if(!window.KELO_ADMIN_KEYS?.can?.(scope,actorId))throw new Error('ADMIN_KEY_PERMISSION_DENIED');
    return this._keyFor(actorId,scope);
  }
  _property(){
    const s=window.KELO_PROPERTY_SYSTEM;
    if(!s)throw new Error('PROPERTY_SYSTEM_NOT_READY');
    return s;
  }
  _worldBuilder(){return window.KELO_WORLD_BUILDER||null;}
  _legacySeed(){
    const legacy=this.store.readLegacyWorldBuilder?.()||null;
    let placements=[];
    try{placements=this._property().getPlacements(WORLD_PARCEL_ID)||[];}catch(e){}
    return this.rev.normalizeSnapshot({
      worldId:WORLD_ID,
      cells:legacy?.cells||{},
      collisions:legacy?.collisions||{},
      placements
    });
  }
  _freshState(){
    const snapshot=this._legacySeed();
    const r=this.rev.createRevision({worldId:WORLD_ID,number:1,snapshot,createdBy:'offline-bootstrap'});
    return {
      schema:SCHEMA,
      worldId:WORLD_ID,
      revisionVersion:1,
      currentPublishedRevisionId:r.revisionId,
      nextRevisionNumber:2,
      activeDraftByActor:{},
      drafts:{},
      revisions:{[r.revisionId]:r},
      audit:[],
      createdAt:now(),
      updatedAt:now(),
      migratedFromLegacy:!!this.store.readLegacyWorldBuilder?.()
    };
  }
  _loadOrCreate(){
    const loaded=this.store.load();
    if(!loaded){
      const fresh=this._freshState();this.store.save(fresh);return fresh;
    }
    loaded.schema=SCHEMA;
    loaded.worldId=loaded.worldId||WORLD_ID;
    loaded.revisionVersion=Math.max(1,Number(loaded.revisionVersion)||1);
    loaded.activeDraftByActor=loaded.activeDraftByActor||{};
    loaded.drafts=loaded.drafts||{};
    loaded.revisions=loaded.revisions||{};
    loaded.audit=Array.isArray(loaded.audit)?loaded.audit:[];
    if(!loaded.currentPublishedRevisionId||!loaded.revisions[loaded.currentPublishedRevisionId]){
      const r=this.rev.createRevision({worldId:WORLD_ID,number:1,snapshot:this._legacySeed(),createdBy:'offline-recovery'});
      loaded.revisions[r.revisionId]=r;loaded.currentPublishedRevisionId=r.revisionId;
    }
    const nums=Object.values(loaded.revisions).map(r=>Number(r.number)||0);
    loaded.nextRevisionNumber=Math.max(Number(loaded.nextRevisionNumber)||0,(nums.length?Math.max(...nums):0)+1,2);
    this.store.save(loaded);
    return loaded;
  }
  _persist(){
    this.state.revisionVersion=(Number(this.state.revisionVersion)||0)+1;
    this.state.updatedAt=now();
    this.store.save(this.state);
  }
  _published(){
    return this.state.revisions[this.state.currentPublishedRevisionId]||null;
  }
  _draft(id){
    return id?this.state.drafts[String(id)]||null:null;
  }
  _currentDraft(actorId){
    const id=this.state.activeDraftByActor[String(actorId)];
    const d=this._draft(id);
    return d&&d.status!=='DISCARDED'?d:null;
  }
  _setCurrent(actorId,draftId){
    if(draftId)this.state.activeDraftByActor[String(actorId)]=String(draftId);
    else delete this.state.activeDraftByActor[String(actorId)];
  }
  _publicDraft(d){
    if(!d)return null;
    const out=clone(d);delete out.snapshot;return out;
  }
  _publicRevision(r){
    if(!r)return null;
    const out=clone(r);delete out.snapshot;return out;
  }
  _assertDraftVersion(d,payload){
    if(payload?.expectedRevisionVersion==null)return;
    if(Number(payload.expectedRevisionVersion)!==Number(d.revisionVersion))throw new Error('WORLD_REVISION_CONFLICT');
  }
  _requireMutableDraft(payload,actorId){
    const d=this._draft(payload?.draftId)||this._currentDraft(actorId);
    if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');
    if(!MUTABLE_DRAFT_STATUSES.has(d.status))throw new Error('WORLD_DRAFT_NOT_EDITABLE');
    this._assertDraftVersion(d,payload);
    return d;
  }
  _audit(operation,{actorId,key,draftId=null,objectId=null,before=null,after=null}={}){
    const rec={
      auditId:this.rev.stableId('audit'),
      timestamp:now(),
      actorId:String(actorId||'unknown'),
      adminKeyId:key?.keyId?String(key.keyId):null,
      operation:String(operation),
      worldId:WORLD_ID,
      draftId:draftId?String(draftId):null,
      objectId:objectId?String(objectId):null,
      before:clone(before),
      after:clone(after)
    };
    this.state.audit.push(rec);
    if(this.state.audit.length>1000)this.state.audit.splice(0,this.state.audit.length-1000);
    return rec;
  }
  _touchDraft(d){
    d.revisionVersion=(Number(d.revisionVersion)||0)+1;
    d.updatedAt=now();
    d.changeCount=(Number(d.changeCount)||0)+1;
  }
  _reply(data={},viewSnapshot=null,viewMeta=null,projectPlacements=false){
    return Object.assign({},clone(data),{
      viewSnapshot:viewSnapshot?this.rev.normalizeSnapshot(viewSnapshot):undefined,
      viewMeta:viewMeta?clone(viewMeta):undefined,
      projectPlacements:!!projectPlacements
    });
  }
  _viewMeta(kind,id,extra={}){
    return Object.assign({
      kind,
      id:id||null,
      worldId:WORLD_ID,
      revisionVersion:Number(this.state.revisionVersion)||0,
      publishedRevisionId:this.state.currentPublishedRevisionId
    },extra);
  }
  async _ensureWorldParcel(){
    const S=this._property();
    const existing=S.parcel?.(WORLD_PARCEL_ID);
    if(existing)return existing;
    return S.request('ensureWorldEditorParcel',{ownerId:'developer'});
  }
  _capturePlacements(){
    try{return this._property().getPlacements(WORLD_PARCEL_ID)||[];}catch(e){return[];}
  }
  _brushCells(x,y,size){
    const WB=this._worldBuilder(),T=Math.max(1,Number(WB?.tileSize)||32);
    const n=Math.max(1,Math.min(9,Math.floor(Number(size)||1)));
    const sx=Math.floor(Math.max(0,Number(x)||0)/T)*T,sy=Math.floor(Math.max(0,Number(y)||0)/T)*T;
    const ww=Math.max(T,Number(window.CONFIG?.worldWidth)||3600),wh=Math.max(T,Number(window.CONFIG?.worldHeight)||3200);
    const out=[],start=-Math.floor(n/2);
    for(let oy=0;oy<n;oy++)for(let ox=0;ox<n;ox++){
      const px=sx+(start+ox)*T,py=sy+(start+oy)*T;
      if(px>=0&&py>=0&&px+T<=ww&&py+T<=wh)out.push([px,py]);
    }
    return out;
  }
  _cellKey(x,y){return `${Math.floor(Number(x)||0)},${Math.floor(Number(y)||0)}`;}
  _normalizeCollision(data,id,actorId){
    const T=Math.max(1,Number(this._worldBuilder()?.tileSize)||32);
    const snap=v=>Math.floor(Math.max(0,Number(v)||0)/T)*T;
    const x=snap(data.x),y=snap(data.y);
    const w=Math.max(T,Math.min(640,Math.ceil((Number(data.w)||T)/T)*T));
    const h=Math.max(T,Math.min(640,Math.ceil((Number(data.h)||T)/T)*T));
    const ww=Math.max(T,Number(window.CONFIG?.worldWidth)||3600),wh=Math.max(T,Number(window.CONFIG?.worldHeight)||3200);
    if(x+w>ww||y+h>wh)throw new Error('OUTSIDE_WORLD');
    return {
      collisionId:String(id||this.rev.stableId('collision')),
      x,y,w,h,
      label:String(data.label||'Bloqueo Admin'),
      actorId:String(actorId),
      updatedAt:now()
    };
  }
  _material(material){
    const id=String(material||'');
    const mats=this._worldBuilder()?.materials||[];
    if(mats.length&&!mats.includes(id))throw new Error('MATERIAL_NOT_FOUND');
    return id;
  }

  async request(op,payload={}){
    const actorId=this._actor(payload);
    const published=this._published();

    // Public/read operations. Normal players only need the published snapshot.
    if(op==='world:published:get'){
      return this._reply({revision:this._publicRevision(published)},published?.snapshot,this._viewMeta('published',published?.revisionId),true);
    }
    if(op==='world:published:meta'){
      return {revision:this._publicRevision(published)};
    }
    if(op==='world:state:get'){
      this._require('world.edit',actorId);
      const d=this._currentDraft(actorId);
      return {
        source:this.source,
        worldId:WORLD_ID,
        revisionVersion:this.state.revisionVersion,
        currentDraft:this._publicDraft(d),
        publishedRevision:this._publicRevision(published)
      };
    }

    if(op==='world:draft:current'){
      this._require('world.edit',actorId);
      return {draft:this._publicDraft(this._currentDraft(actorId))};
    }
    if(op==='world:draft:list'){
      this._require('world.edit',actorId);
      return {drafts:Object.values(this.state.drafts).map(d=>this._publicDraft(d)).sort((a,b)=>b.updatedAt-a.updatedAt)};
    }
    if(op==='world:revision:list'){
      this._require('world.edit',actorId);
      return {revisions:Object.values(this.state.revisions).map(r=>this._publicRevision(r)).sort((a,b)=>b.number-a.number)};
    }
    if(op==='world:revision:get'){
      this._require('world.edit',actorId);
      const r=this.state.revisions[String(payload.revisionId||'')];if(!r)throw new Error('WORLD_REVISION_NOT_FOUND');
      return {revision:this._publicRevision(r),snapshot:clone(r.snapshot)};
    }
    if(op==='world:audit:list'){
      this._require('world.publish',actorId);
      return {audit:clone(this.state.audit)};
    }

    if(op==='world:draft:create'){
      const key=this._require('world.edit',actorId);
      let d=this._currentDraft(actorId);
      if(d&&['DRAFT','REJECTED'].includes(d.status)&&payload.forceNew!==true){
        return this._reply({draft:this._publicDraft(d),resumed:true},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),true);
      }
      const base=this._published();if(!base)throw new Error('WORLD_PUBLISHED_REVISION_MISSING');
      d={
        draftId:this.rev.stableId('draft'),
        worldId:WORLD_ID,
        baseRevisionId:base.revisionId,
        status:'DRAFT',
        revisionVersion:1,
        createdBy:actorId,
        createdAt:now(),
        updatedAt:now(),
        submittedAt:null,
        approvedAt:null,
        rejectedAt:null,
        publishedAt:null,
        discardedAt:null,
        changeCount:0,
        savedAt:now(),
        snapshot:this.rev.normalizeSnapshot(base.snapshot)
      };
      this.state.drafts[d.draftId]=d;this._setCurrent(actorId,d.draftId);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,after:this._publicDraft(d)});
      this._persist();
      return this._reply({draft:this._publicDraft(d),created:true},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),true);
    }

    if(op==='world:draft:get'){
      this._require('world.edit',actorId);
      const d=this._draft(payload.draftId)||this._currentDraft(actorId);if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');
      this._setCurrent(actorId,d.draftId);this._persist();
      return this._reply({draft:this._publicDraft(d)},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),true);
    }

    if(op==='world:draft:save'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),before={savedAt:d.savedAt,revisionVersion:d.revisionVersion};
      d.savedAt=now();d.updatedAt=now();
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:{savedAt:d.savedAt,revisionVersion:d.revisionVersion}});
      this._persist();
      return {draft:this._publicDraft(d),saved:true};
    }

    if(op==='world:draft:discard'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),before=this._publicDraft(d);
      d.status='DISCARDED';d.discardedAt=now();d.updatedAt=now();this._setCurrent(actorId,null);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:this._publicDraft(d)});
      this._persist();
      return this._reply({draft:this._publicDraft(d)},published.snapshot,this._viewMeta('published',published.revisionId),true);
    }

    if(op==='world:draft:submit'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),before=this._publicDraft(d);
      d.status='SUBMITTED';d.submittedAt=now();d.updatedAt=now();
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:this._publicDraft(d)});
      this._persist();
      return {draft:this._publicDraft(d),submitted:true};
    }

    if(op==='world:draft:approve'){
      const key=this._require('world.publish',actorId),d=this._draft(payload.draftId)||this._currentDraft(actorId);
      if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');if(d.status!=='SUBMITTED')throw new Error('WORLD_DRAFT_NOT_SUBMITTED');
      const before=this._publicDraft(d);d.status='APPROVED';d.approvedAt=now();d.approvedBy=actorId;d.updatedAt=now();
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:this._publicDraft(d)});
      this._persist();return{draft:this._publicDraft(d),approved:true};
    }

    if(op==='world:draft:reject'){
      const key=this._require('world.publish',actorId),d=this._draft(payload.draftId)||this._currentDraft(actorId);
      if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');if(!['SUBMITTED','APPROVED'].includes(d.status))throw new Error('WORLD_DRAFT_NOT_REVIEWABLE');
      const before=this._publicDraft(d);d.status='REJECTED';d.rejectedAt=now();d.rejectedBy=actorId;d.rejectionReason=String(payload.reason||'');d.updatedAt=now();
      this._setCurrent(d.createdBy,d.draftId);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:this._publicDraft(d)});
      this._persist();return{draft:this._publicDraft(d),rejected:true};
    }

    if(op==='world:publish'){
      const key=this._require('world.publish',actorId),d=this._draft(payload.draftId)||this._currentDraft(actorId);
      if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');if(d.status!=='APPROVED')throw new Error('WORLD_DRAFT_NOT_APPROVED');
      const before={draft:this._publicDraft(d),published:this._publicRevision(this._published())};
      const r=this.rev.createRevision({
        worldId:WORLD_ID,
        number:this.state.nextRevisionNumber++,
        snapshot:d.snapshot,
        createdBy:actorId,
        sourceDraftId:d.draftId
      });
      this.state.revisions[r.revisionId]=r;this.state.currentPublishedRevisionId=r.revisionId;
      d.status='PUBLISHED';d.publishedAt=now();d.publishedRevisionId=r.revisionId;d.updatedAt=now();
      this._setCurrent(d.createdBy,null);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:r.revisionId,before,after:{draft:this._publicDraft(d),published:this._publicRevision(r)}});
      this._persist();
      return this._reply({draft:this._publicDraft(d),revision:this._publicRevision(r),published:true},r.snapshot,this._viewMeta('published',r.revisionId),true);
    }

    if(op==='world:rollback'){
      const key=this._require('world.publish',actorId),target=this.state.revisions[String(payload.revisionId||'')];
      if(!target)throw new Error('WORLD_REVISION_NOT_FOUND');
      const before=this._publicRevision(this._published());
      const r=this.rev.createRevision({
        worldId:WORLD_ID,
        number:this.state.nextRevisionNumber++,
        snapshot:target.snapshot,
        createdBy:actorId,
        rolledBackFromRevisionId:target.revisionId
      });
      this.state.revisions[r.revisionId]=r;this.state.currentPublishedRevisionId=r.revisionId;
      this._audit(op,{actorId,key,objectId:r.revisionId,before,after:{revision:this._publicRevision(r),rolledBackFromRevisionId:target.revisionId}});
      this._persist();
      return this._reply({revision:this._publicRevision(r),rolledBack:true},r.snapshot,this._viewMeta('published',r.revisionId),true);
    }

    if(op==='world:preview:enter'){
      this._require('world.edit',actorId);
      const d=this._draft(payload.draftId)||this._currentDraft(actorId);if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');
      return this._reply({draft:this._publicDraft(d),preview:true},d.snapshot,this._viewMeta('preview',d.draftId,{status:d.status}),true);
    }
    if(op==='world:preview:exit'||op==='world:view:published'){
      return this._reply({revision:this._publicRevision(published),preview:false},published.snapshot,this._viewMeta('published',published.revisionId),true);
    }

    if(op==='world:draft:export'){
      const key=this._require('world.export',actorId),d=this._draft(payload.draftId)||this._currentDraft(actorId);if(!d)throw new Error('WORLD_DRAFT_NOT_FOUND');
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,after:{exported:true}});
      this._persist();
      return {bundle:{contract:'kelo-world-edit-draft-v1',schema:1,worldId:WORLD_ID,exportedAt:now(),draft:this._publicDraft(d),snapshot:clone(d.snapshot)}};
    }
    if(op==='world:draft:import'){
      const key=this._require('world.import',actorId),d=this._requireMutableDraft(payload,actorId);
      const raw=payload.bundle?.snapshot||payload.snapshot;if(!raw)throw new Error('WORLD_DRAFT_IMPORT_INVALID');
      const before=clone(d.snapshot);d.snapshot=this.rev.normalizeSnapshot({...raw,worldId:WORLD_ID});this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:d.snapshot});
      this._persist();
      return this._reply({draft:this._publicDraft(d),imported:true},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),true);
    }
    if(op==='world:draft:clear-overrides'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),before={cells:clone(d.snapshot.cells),collisions:clone(d.snapshot.collisions)};
      d.snapshot.cells={};d.snapshot.collisions={};this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:d.draftId,before,after:{cells:{},collisions:{}}});
      this._persist();
      return this._reply({draft:this._publicDraft(d),cleared:true},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }

    // Terrain / path overrides.
    if(op==='world:tile:paint'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),material=this._material(payload.material);
      const role=payload.role==='path'?'path':'terrain',brush=this._brushCells(payload.x,payload.y,payload.brushSize),before={};
      for(const [x,y] of brush){
        const k=this._cellKey(x,y);before[k]=clone(d.snapshot.cells[k]||null);
        const prior=d.snapshot.cells[k];
        d.snapshot.cells[k]={
          tileChangeId:String(prior?.tileChangeId||this.rev.stableId('tile-change')),
          x,y,material,role,actorId,updatedAt:now()
        };
      }
      this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:brush.map(([x,y])=>this._cellKey(x,y)).join('|'),before,after:{count:brush.length,material,role}});
      this._persist();
      return this._reply({draft:this._publicDraft(d),count:brush.length},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }
    if(op==='world:tile:clear'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),brush=this._brushCells(payload.x,payload.y,payload.brushSize),before={},removed=[];
      for(const [x,y] of brush){
        const k=this._cellKey(x,y);if(d.snapshot.cells[k]){before[k]=clone(d.snapshot.cells[k]);delete d.snapshot.cells[k];removed.push(k);}
      }
      if(removed.length){
        this._touchDraft(d);this._audit(op,{actorId,key,draftId:d.draftId,objectId:removed.join('|'),before,after:null});this._persist();
      }
      return this._reply({draft:this._publicDraft(d),count:removed.length},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }

    // Collision overrides.
    if(op==='world:collision:create'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),rec=this._normalizeCollision(payload,null,actorId);
      d.snapshot.collisions[rec.collisionId]=rec;this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:rec.collisionId,before:null,after:rec});this._persist();
      return this._reply({draft:this._publicDraft(d),collision:clone(rec)},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }
    if(op==='world:collision:update'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),id=String(payload.collisionId||''),old=d.snapshot.collisions[id];
      if(!old)throw new Error('COLLISION_NOT_FOUND');
      const rec=this._normalizeCollision({...old,...payload},id,actorId);d.snapshot.collisions[id]=rec;this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:id,before:old,after:rec});this._persist();
      return this._reply({draft:this._publicDraft(d),collision:clone(rec)},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }
    if(op==='world:collision:remove'){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),id=String(payload.collisionId||''),old=d.snapshot.collisions[id];
      if(!old)throw new Error('COLLISION_NOT_FOUND');delete d.snapshot.collisions[id];this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId:id,before:old,after:null});this._persist();
      return this._reply({draft:this._publicDraft(d),collision:clone(old)},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }

    // Property remains the active placement engine; drafts/revisions only snapshot its layout.
    if(['world:placement:create','world:placement:move','world:placement:rotate','world:placement:scale','world:placement:remove'].includes(op)){
      const key=this._require('world.edit',actorId),d=this._requireMutableDraft(payload,actorId),S=this._property();
      await this._ensureWorldParcel();
      let result=null,before=null,objectId=null;
      if(op==='world:placement:create'){
        result=await S.request('place',{ownerId:'developer',parcelId:WORLD_PARCEL_ID,assetId:payload.assetId,x:payload.x,y:payload.y,rotation:payload.rotation||0,scale:payload.scale});
        objectId=result.placementId;
      }else{
        objectId=String(payload.placementId||'');
        before=S.getPlacements(WORLD_PARCEL_ID).find(x=>x.placementId===objectId)||null;
        if(op==='world:placement:move')result=await S.request('move',{ownerId:'developer',placementId:objectId,x:payload.x,y:payload.y});
        if(op==='world:placement:rotate')result=await S.request('rotate',{ownerId:'developer',placementId:objectId,delta:payload.delta||1});
        if(op==='world:placement:scale')result=await S.request('scale',{ownerId:'developer',placementId:objectId,scale:payload.scale});
        if(op==='world:placement:remove')result=await S.request('remove',{ownerId:'developer',placementId:objectId});
      }
      d.snapshot.placements=this.rev.normalizeSnapshot({placements:this._capturePlacements()}).placements;
      this._touchDraft(d);
      this._audit(op,{actorId,key,draftId:d.draftId,objectId,before,after:op==='world:placement:remove'?null:result});
      this._persist();
      return this._reply({draft:this._publicDraft(d),placement:clone(result)},d.snapshot,this._viewMeta('draft',d.draftId,{status:d.status}),false);
    }

    throw new Error('UNKNOWN_WORLD_EDIT_OPERATION');
  }
}

window.LocalWorldEditAuthority=LocalWorldEditAuthority;
window.KELO_LOCAL_WORLD_EDIT_AUTHORITY_AUDIT=Object.freeze({
  version:VERSION,
  source:'local',
  draftReviewPublish:true,
  immutableRevisions:true,
  rollbackCreatesRevision:true,
  auditLog:true,
  optimisticConflictGuard:true,
  propertyDelegation:true,
  storageBehindStore:true
});
})();
