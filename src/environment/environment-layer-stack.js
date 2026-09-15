(function(){
'use strict';
const base=window.KELO_WORLD_RENDERER;
if(!base||typeof base.draw!=='function'){console.error('[Kelo environment layers] world renderer missing');return;}
const DECORATION_RESET=false;
window.KELO_WORLD_DECORATION_RESET=DECORATION_RESET;
const PHASES=Object.freeze(['ground','ground_variation','transitions','paths_floors','decals_details','props_back','props_front','vfx_weather_lighting']);
const PRE_ACTOR_PHASES=new Set(['props_back']);
const POST_ACTOR_PHASES=new Set(['props_front','vfx_weather_lighting']);
const ORDERING_POLICY='phase-priority-id-v1';
const SPATIAL_POLICY='same-phase-aabb-priority-resolution-v1';
const phaseRank=new Map(PHASES.map((name,i)=>[name,i]));
const layers=[];
let auditDirty=true;
let lastAuditAt=0;
function timingForPhase(phase){if(PRE_ACTOR_PHASES.has(phase))return'pre_actor';if(POST_ACTOR_PHASES.has(phase))return'post_actor';return'base';}
function sortLayers(){layers.sort((a,b)=>(phaseRank.get(a.phase)??999)-(phaseRank.get(b.phase)??999)||(a.priority||0)-(b.priority||0)||a.id.localeCompare(b.id));}
function normalizeBounds(value){
  const raw=typeof value==='function'?value():value;
  if(!Array.isArray(raw))return [];
  return raw.filter(Boolean).map((b,i)=>Object.freeze({id:String(b.id||i),x:Number(b.x)||0,y:Number(b.y)||0,w:Math.max(0,Number(b.w)||0),h:Math.max(0,Number(b.h)||0)})).filter(b=>b.w>0&&b.h>0);
}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function markAuditDirty(){auditDirty=true;}
function registerLayer(spec){
  if(!spec||!spec.id||typeof spec.draw!=='function'||!phaseRank.has(spec.phase))throw new Error('[Kelo environment layers] invalid layer');
  if(layers.some(l=>l.id===spec.id))throw new Error('[Kelo environment layers] duplicate layer '+spec.id);
  const layer=Object.freeze({id:String(spec.id),phase:spec.phase,priority:Number(spec.priority)||0,required:spec.required!==false,visibleDuringReset:spec.visibleDuringReset===true,draw:spec.draw,ready:typeof spec.ready==='function'?spec.ready:()=>true,bounds:spec.bounds||null,ownership:String(spec.ownership||'unspecified')});
  layers.push(layer);sortLayers();markAuditDirty();syncAudit(true);return layer.id;
}
function priorityTies(){
  const groups=new Map();
  for(const layer of layers){const key=`${layer.phase}:${layer.priority}`;const list=groups.get(key)||[];list.push(layer.id);groups.set(key,list);}
  return Array.from(groups.entries()).filter(([,ids])=>ids.length>1).map(([key,ids])=>Object.freeze({key,ids:Object.freeze(ids.slice().sort())}));
}
function spatialOverlaps(){
  const out=[];
  for(let i=0;i<layers.length;i++)for(let j=i+1;j<layers.length;j++){
    const a=layers[i],b=layers[j];
    if(a.phase!==b.phase)continue;
    const ab=normalizeBounds(a.bounds),bb=normalizeBounds(b.bounds);
    const hits=[];
    for(const x of ab)for(const y of bb)if(overlaps(x,y))hits.push(Object.freeze({a:x.id,b:y.id,x:Math.max(x.x,y.x),y:Math.max(x.y,y.y),w:Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x),h:Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y)}));
    if(hits.length){
      const ambiguous=a.priority===b.priority;
      out.push(Object.freeze({phase:a.phase,a:a.id,b:b.id,aPriority:a.priority,bPriority:b.priority,aOwnership:a.ownership,bOwnership:b.ownership,ambiguous,resolvedBy:ambiguous?'id-tiebreak':'priority',overlapCount:hits.length,overlaps:Object.freeze(hits)}));
    }
  }
  return out;
}
function syncAudit(force){
  if(!window.KELO_ENVIRONMENT_LAYER_AUDIT)return false;
  if(!force&&!auditDirty){window.KELO_ENVIRONMENT_LAYER_AUDIT.skippedSyncs++;return false;}
  const now=typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const ties=priorityTies(),spatial=spatialOverlaps(),ambiguous=spatial.filter(x=>x.ambiguous);
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layerCount=layers.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.baseLayerCount=layers.filter(l=>timingForPhase(l.phase)==='base').length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.preActorLayerCount=layers.filter(l=>timingForPhase(l.phase)==='pre_actor').length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.postActorLayerCount=layers.filter(l=>timingForPhase(l.phase)==='post_actor').length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.priorityTieCount=ties.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.priorityTies=ties;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialOverlapCount=spatial.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialOverlaps=spatial;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialTieCount=ambiguous.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialTies=ambiguous;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.decorationReset=DECORATION_RESET;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layers=layers.map((l,index)=>Object.freeze({id:l.id,phase:l.phase,priority:l.priority,required:l.required,ready:!!l.ready(),timing:timingForPhase(l.phase),ownership:l.ownership,visibleDuringReset:l.visibleDuringReset,boundsCount:normalizeBounds(l.bounds).length,orderIndex:index,orderKey:`${String(phaseRank.get(l.phase)).padStart(2,'0')}:${String(l.priority).padStart(4,'0')}:${l.id}`}));
  auditDirty=false;
  lastAuditAt=now;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.rebuildCount++;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.lastRebuildAt=Date.now();
  return true;
}
function drawTiming(g,timing){
  for(const layer of layers){if(timingForPhase(layer.phase)!==timing)continue;if(DECORATION_RESET&&!layer.visibleDuringReset)continue;if(layer.ready())layer.draw(g);}
}
function drawBlankWorld(g){
  const w=window.CONFIG?.worldWidth||3600,h=window.CONFIG?.worldHeight||3200;
  g.save();g.fillStyle='#ffffff';g.fillRect(0,0,w,h);g.restore();
}
function draw(g){
  if(DECORATION_RESET){drawBlankWorld(g);drawTiming(g,'base');syncAudit(false);return true;}
  const drew=base.draw(g);
  if(!drew)return false;
  drawTiming(g,'base');
  syncAudit(false);return true;
}
function drawPreActors(g){drawTiming(g,'pre_actor');syncAudit(false);return true;}
function drawPostActors(g){drawTiming(g,'post_actor');syncAudit(false);return true;}
window.KELO_ENVIRONMENT_LAYER_AUDIT={version:'environment-layer-stack-v2.5',ready:true,mode:DECORATION_RESET?'blank-world-reset-visible-landmarks-v2':'formal-base-back-actor-front-order-v1',decorationReset:DECORATION_RESET,orderingPolicy:ORDERING_POLICY,spatialPolicy:SPATIAL_POLICY,phases:PHASES,preActorPhases:Array.from(PRE_ACTOR_PHASES),postActorPhases:Array.from(POST_ACTOR_PHASES),layerCount:0,baseLayerCount:0,preActorLayerCount:0,postActorLayerCount:0,priorityTieCount:0,priorityTies:[],spatialOverlapCount:0,spatialOverlaps:[],spatialTieCount:0,spatialTies:[],layers:[],auditMode:'dirty-only-v2',maxStaleMs:null,rebuildCount:0,skippedSyncs:0,lastRebuildAt:0,lastPerfAt:()=>lastAuditAt};
window.KELO_ENVIRONMENT_LAYERS=Object.freeze({version:'environment-layer-stack-v2.5',decorationReset:DECORATION_RESET,orderingPolicy:ORDERING_POLICY,spatialPolicy:SPATIAL_POLICY,phases:PHASES,preActorPhases:Object.freeze(Array.from(PRE_ACTOR_PHASES)),postActorPhases:Object.freeze(Array.from(POST_ACTOR_PHASES)),register:registerLayer,refreshAudit:()=>syncAudit(true),markAuditDirty,drawPreActors,drawPostActors,get layers(){return layers.slice();}});
window.KELO_WORLD_RENDERER=Object.freeze({draw,drawPreActors,drawPostActors,districts:base.districts,chunkSize:base.chunkSize,get ready(){return DECORATION_RESET?true:(base.ready&&layers.every(l=>!l.required||l.ready()));},environmentLayerStack:true,preActorLayerStack:true,postActorLayerStack:true,decorationReset:DECORATION_RESET});
syncAudit(true);
})();