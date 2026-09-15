/* KELO-INDEX
 * area: WORLD / MAP FORGE / SCENE PREFABS
 * owner: KeloMapForge deterministic generator core
 * purpose: materialize authored semantic scenes from existing generated decorations without creating a parallel world pipeline
 * public-api: materializeScenePrefabs(), scenePrefabTieScore()
 * consumes: generated Map Forge candidate parts + world bounds
 * state-owned: none
 * do-not: no DOM, renderer, catalog mutation, gameplay state or Math.random
 */
import {seed32} from './map-forge-prng.mjs';
import {insideBounds,pointSegmentDistance} from './map-forge-geometry.mjs';

const MEMBER_MIN_SPACING=68;
const MEMBER_MAX_SOURCE_DISTANCE=620;
const MEMBER_MIN_IMPROVEMENT=24;
const BLOCK_PAD=24;
const LANDMARK_PAD=22;
const LOCAL_NEIGHBOR_RADIUS=220;
const ADAPTIVE_SEARCH_STEPS=12;
const ROUND=value=>Math.round(Number(value||0)*10)/10;
const VARIANTS=Object.freeze([
  Object.freeze({id:'balanced',forwardScale:1,lateralScale:1}),
  Object.freeze({id:'wide',forwardScale:.94,lateralScale:1.12}),
  Object.freeze({id:'deep',forwardScale:1.12,lateralScale:.92})
]);

const slot=(role,family,forwardGap,lateral,alternates=[])=>Object.freeze({role,family,forwardGap,lateral,alternates:Object.freeze(alternates.map(Object.freeze))});
export const SCENE_PREFAB_PATTERNS=Object.freeze({
  central_fountain:Object.freeze({id:'royal-fountain-court-v1',kit:'royal-civic',roadBand:[35,190],slots:Object.freeze([
    slot('approach-lamp-left','lamp',46,-124),slot('approach-lamp-right','lamp',46,124),
    slot('rest-bench-left','bench',132,-192),slot('rest-bench-right','bench',132,192),
    slot('garden-left','flower',72,-244),slot('garden-right','flower',72,244)
  ])}),
  castle:Object.freeze({id:'royal-castle-forecourt-v1',kit:'royal-civic',roadBand:[35,190],slots:Object.freeze([
    slot('gate-lamp-left','lamp',48,-150),slot('gate-lamp-right','lamp',48,150),
    slot('rest-bench-left','bench',136,-220),slot('rest-bench-right','bench',136,220),
    slot('flower-left','flower',88,-286),slot('flower-right','flower',88,286)
  ])}),
  main_market:Object.freeze({id:'market-gateway-v1',kit:'commerce',roadBand:[35,190],slots:Object.freeze([
    slot('entry-lamp-left','lamp',38,-112),slot('entry-lamp-right','lamp',38,112),
    slot('stall-left','market_prop',102,-178),slot('stall-right','market_prop',102,178),
    slot('rest-bench-left','bench',166,-126),slot('rest-bench-right','bench',166,126)
  ])}),
  small_market:Object.freeze({id:'small-market-gateway-v1',kit:'commerce',roadBand:[35,190],slots:Object.freeze([
    slot('entry-lamp-left','lamp',34,-94),slot('entry-lamp-right','lamp',34,94),
    slot('stall-left','market_prop',94,-146),slot('stall-right','market_prop',94,146),
    slot('rest-bench','bench',150,0)
  ])}),
  ancient_tree:Object.freeze({id:'ancient-grove-v1',kit:'forest',roadBand:[24,320],slots:Object.freeze([
    slot('canopy-tree-left','tree',168,-184,[{forwardGap:100,lateral:-260}]),slot('canopy-tree-right','tree',168,184,[{forwardGap:100,lateral:260}]),
    slot('shrub-left','bush',50,-112),slot('shrub-right','bush',50,112),
    slot('stone-left','rock',132,-154),slot('stone-right','rock',132,154)
  ])}),
  windmill:Object.freeze({id:'windmill-yard-v1',kit:'rural',roadBand:[24,320],slots:Object.freeze([
    slot('flower-left','flower',40,-104),slot('flower-right','flower',40,104),
    slot('crate-left','crate',126,-148),slot('crate-right','crate',126,148)
  ])}),
  barn:Object.freeze({id:'barn-yard-v1',kit:'rural',roadBand:[24,320],slots:Object.freeze([
    slot('flower-left','flower',42,-104),slot('flower-right','flower',42,104),
    slot('crate-left','crate',122,-144),slot('crate-right','crate',122,144)
  ])}),
  mine_entrance:Object.freeze({id:'mine-threshold-v1',kit:'mine',roadBand:[24,340],slots:Object.freeze([
    slot('barrel-left','barrel',44,-96),slot('barrel-right','barrel',44,96),
    slot('crate-left','crate',122,-142),slot('crate-right','crate',122,142),
    slot('rock-marker','rock',174,0)
  ])}),
  mysterious_tower:Object.freeze({id:'ruin-threshold-v1',kit:'ruins',roadBand:[24,340],slots:Object.freeze([
    slot('shrub-left','bush',50,-106),slot('shrub-right','bush',50,106),
    slot('stone-left','rock',132,-148),slot('stone-right','rock',132,148)
  ])})
});

const pointDistance=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
const spacingForKind=kind=>kind==='forest'?70:88;
const isUrbanKind=kind=>kind==='plaza'||kind==='royal'||kind==='commerce';
function rotationAxes(rotation=0){const value=((Number(rotation)||0)%360+360)%360;if(value===90)return{forward:{x:-1,y:0},lateral:{x:0,y:1}};if(value===180)return{forward:{x:0,y:-1},lateral:{x:-1,y:0}};if(value===270)return{forward:{x:1,y:0},lateral:{x:0,y:-1}};return{forward:{x:0,y:1},lateral:{x:1,y:0}};}
function landmarkRadius(landmark){return Math.max(80,Number(landmark?.clearance?.radius)||Math.max(Number(landmark?.bounds?.w)||0,Number(landmark?.bounds?.h)||0)*.7);}
function variantFor(pattern,landmark){const p=landmark.position||landmark,index=seed32(`${pattern.id}|${landmark.id}|${ROUND(p.x)}|${ROUND(p.y)}`)%VARIANTS.length;return VARIANTS[index];}
function authoredPoint(landmark,member,variant){const center=landmark.position||landmark,axes=rotationAxes(landmark.rotation),radius=landmarkRadius(landmark),forward=(radius+member.forwardGap)*variant.forwardScale,lateral=member.lateral*variant.lateralScale;return{x:ROUND(center.x+axes.forward.x*forward+axes.lateral.x*lateral),y:ROUND(center.y+axes.forward.y*forward+axes.lateral.y*lateral)};}
function authoredPoints(landmark,member,variant){return [member,...(member.alternates||[]).map(alternate=>({...member,...alternate,alternates:[]}))].map(candidate=>authoredPoint(landmark,candidate,variant));}
function nearestRoadFrame(point,roads){let best=null;for(const road of roads||[]){const pts=road.polyline||[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0,x=a.x+dx*t,y=a.y+dy*t,distance=Math.hypot(x-point.x,y-point.y);if(!best||distance<best.distance)best={roadId:road.id,x,y,distance};}}return best;}
function districtOwnerAt(parts,p){let owner=null,best=Infinity;for(const d of parts.districts||[]){const dx=p.x-d.center.x,dy=p.y-d.center.y,cost=(dx*dx+dy*dy)/Math.max(.2,Number(d.weight)||1);if(cost<best){best=cost;owner=d.id;}}return owner;}
function pointInsideRect(p,r,pad=0){return p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;}
function localSameFamilyCount(rows){let count=0;for(let i=0;i<rows.length;i++){const current=rows[i];let nearest=null,best=Infinity;for(let j=0;j<rows.length;j++){if(i===j)continue;const candidate=rows[j];if(candidate.district!==current.district)continue;const distance=pointDistance(current,candidate);if(distance<best){best=distance;nearest=candidate;}}if(nearest&&best<=LOCAL_NEIGHBOR_RADIUS&&nearest.family===current.family)count++;}return count;}
function entersNewVista(parts,from,to){for(const vista of parts.scenicVistas||[]){if(!vista.reserved||!vista.from||!vista.to)continue;const corridor=Math.max(56,90*(Number(vista.weight)||1)),before=pointSegmentDistance(from,vista.from,vista.to),after=pointSegmentDistance(to,vista.from,vista.to);if(before>=corridor&&after<corridor)return true;}return false;}
function pointSafe(parts,rows,index,landmark,pattern,p,worldBounds){if(!insideBounds(p,worldBounds,36)||districtOwnerAt(parts,p)!==landmark.district)return false;const district=(parts.districts||[]).find(row=>row.id===landmark.district);if(district?.bounds&&!pointInsideRect(p,district.bounds,-18))return false;if((parts.blocks||[]).some(block=>pointInsideRect(p,block.bounds,BLOCK_PAD)))return false;for(const other of parts.landmarks||[]){if(other.id===landmark.id)continue;const radius=Math.max(0,Number(other?.clearance?.radius)||0)+LANDMARK_PAD;if(radius&&pointDistance(p,other.position||other)<radius)return false;}const road=nearestRoadFrame(p,parts.roads),band=pattern.roadBand||[20,340],districtRoadMin=isUrbanKind(district?.kind)?35:22,minRoad=Math.max(Number(band[0])||0,districtRoadMin),maxRoad=Math.min(Number(band[1])||340,isUrbanKind(district?.kind)?190:Infinity);if(!road||road.distance<minRoad||road.distance>maxRoad)return false;const districtKinds=new Map((parts.districts||[]).map(row=>[row.id,row.kind]));for(let i=0;i<rows.length;i++){if(i===index)continue;const other=rows[i],crossDistrict=other.district!==landmark.district,required=crossDistrict?Math.min(spacingForKind(district?.kind),spacingForKind(districtKinds.get(other.district))):MEMBER_MIN_SPACING;if(pointDistance(p,other)<required)return false;}if(entersNewVista(parts,rows[index],p))return false;return true;}
function candidatePoints(from,ideal){return Array.from({length:ADAPTIVE_SEARCH_STEPS},(_,index)=>{const t=ROUND(1-index/(ADAPTIVE_SEARCH_STEPS+1));return{x:ROUND(from.x+(ideal.x-from.x)*t),y:ROUND(from.y+(ideal.y-from.y)*t),t};});}
function chooseMember(rows,landmark,member,ideal,used){let best=null;for(let i=0;i<rows.length;i++){const row=rows[i];if(used.has(i)||row.district!==landmark.district||row.family!==member.family)continue;const distance=pointDistance(row,ideal);if(distance>MEMBER_MAX_SOURCE_DISTANCE)continue;if(!best||distance<best.distance-1e-6||Math.abs(distance-best.distance)<=1e-6&&i<best.index)best={index:i,distance};}return best;}
function connectorFor(parts,landmark){const center=landmark.position||landmark,frame=nearestRoadFrame(center,parts.roads);if(!frame)return null;return{id:'road-entry',kind:'road',required:true,roadId:frame.roadId,position:{x:ROUND(frame.x),y:ROUND(frame.y)},distance:ROUND(frame.distance),facing:String(landmark.frontage?.facing||landmark.facing||'south')};}
function pairedRoleKey(role){const match=String(role||'').match(/^(.*)-(left|right)$/);return match?match[1]:null;}
function rollbackOrphanPairs(pattern,rows,memberRows,originalRows,used,counters){
  const expected=new Map();
  for(const member of pattern.slots||[]){const key=pairedRoleKey(member.role);if(!key)continue;const sides=expected.get(key)||new Set();sides.add(member.role.endsWith('-left')?'left':'right');expected.set(key,sides);}
  const resolved=new Map();
  for(const member of memberRows){const key=pairedRoleKey(member.role);if(!key)continue;const list=resolved.get(key)||[];list.push(member);resolved.set(key,list);}
  const orphanIndexes=new Set();
  for(const [key,sides] of expected){if(sides.size!==2)continue;const list=resolved.get(key)||[];if(list.length===1)orphanIndexes.add(list[0].sourceIndex);}
  if(!orphanIndexes.size)return 0;
  for(const sourceIndex of orphanIndexes){
    const member=memberRows.find(row=>row.sourceIndex===sourceIndex);if(!member)continue;
    const original=originalRows.get(sourceIndex);if(original)rows[sourceIndex]=original;
    used.delete(sourceIndex);counters.members--;if(member.movement>=1){counters.moved--;counters.sceneMoved--;counters.totalMovement-=member.movement;counters.sceneMovement-=member.movement;}const improvement=member.sourceDistance-member.finalDistance;if(improvement>0){counters.totalImprovement-=improvement;counters.sceneImprovement-=improvement;}
  }
  for(let i=memberRows.length-1;i>=0;i--)if(orphanIndexes.has(memberRows[i].sourceIndex))memberRows.splice(i,1);
  return orphanIndexes.size;
}

export function materializeScenePrefabs(parts,{worldBounds}={}){
  if(!worldBounds)return parts;
  const rows=(parts.decorations||[]).map(row=>({...row})),scenePrefabs=[];let evaluated=0,resolved=0,moved=0,members=0,connectors=0,totalImprovement=0,totalMovement=0,rhythmProtected=0,safetyRejected=0,pairRollbackCount=0,adaptiveBackoffCount=0;
  for(const landmark of parts.landmarks||[]){
    const pattern=SCENE_PREFAB_PATTERNS[landmark.type];if(!pattern)continue;evaluated++;
    const variant=variantFor(pattern,landmark),used=new Set(),memberRows=[],originalRows=new Map(),connector=connectorFor(parts,landmark);let sceneMoved=0,sceneImprovement=0,sceneMovement=0;
    for(const member of pattern.slots){
      let ideal=null,source=null,accepted=null,beforeDistance=Infinity;
      for(const authored of authoredPoints(landmark,member,variant)){
        const candidateSource=chooseMember(rows,landmark,member,authored,used);if(!candidateSource)continue;
        const candidateRow=rows[candidateSource.index],distance=pointDistance(candidateRow,authored),beforeRhythm=localSameFamilyCount(rows);let candidateAccepted=null;
        if(distance<MEMBER_MIN_IMPROVEMENT){candidateAccepted={x:candidateRow.x,y:candidateRow.y,t:0};}
        else for(const candidate of candidatePoints(candidateRow,authored)){
          if(!pointSafe(parts,rows,candidateSource.index,landmark,pattern,candidate,worldBounds)){safetyRejected++;continue;}
          const oldX=candidateRow.x,oldY=candidateRow.y;candidateRow.x=candidate.x;candidateRow.y=candidate.y;const afterRhythm=localSameFamilyCount(rows);candidateRow.x=oldX;candidateRow.y=oldY;if(afterRhythm>beforeRhythm){rhythmProtected++;continue;}candidateAccepted=candidate;break;
        }
        if(candidateAccepted){ideal=authored;source=candidateSource;accepted=candidateAccepted;beforeDistance=distance;break;}
      }
      if(!accepted||!source||!ideal)continue;
      const row=rows[source.index];
      originalRows.set(source.index,{...row});
      const old={x:row.x,y:row.y},afterDistance=pointDistance(accepted,ideal),improvement=beforeDistance-afterDistance,movement=pointDistance(old,accepted);row.x=accepted.x;row.y=accepted.y;row.scenePrefabId=`scene-prefab:${landmark.id}:${pattern.id}`;row.sceneRole=member.role;row.sceneKit=pattern.kit;row.sceneVariant=variant.id;used.add(source.index);members++;if(movement>=1){moved++;sceneMoved++;totalMovement+=movement;sceneMovement+=movement;}if(improvement>0){totalImprovement+=improvement;sceneImprovement+=improvement;}memberRows.push({role:member.role,family:member.family,decorationId:row.id,position:{x:ROUND(row.x),y:ROUND(row.y)},ideal,sourceDistance:ROUND(beforeDistance),finalDistance:ROUND(afterDistance),movement:ROUND(movement),adaptiveBackoff:accepted.t>0&&accepted.t<.68,sourceIndex:source.index});
    }
    const counters={members,moved,sceneMoved,totalMovement,sceneMovement,totalImprovement,sceneImprovement};
    pairRollbackCount+=rollbackOrphanPairs(pattern,rows,memberRows,originalRows,used,counters);
    ({members,moved,sceneMoved,totalMovement,sceneMovement,totalImprovement,sceneImprovement}=counters);
    if(memberRows.length>=2){resolved++;adaptiveBackoffCount+=memberRows.filter(row=>row.adaptiveBackoff).length;if(connector)connectors++;scenePrefabs.push({id:`scene-prefab:${landmark.id}:${pattern.id}`,prefabId:pattern.id,kit:pattern.kit,variant:variant.id,landmarkId:landmark.id,district:landmark.district,anchor:{x:ROUND((landmark.position||landmark).x),y:ROUND((landmark.position||landmark).y)},rotation:Number(landmark.rotation)||0,connectors:connector?[connector]:[],members:memberRows.map(({sourceIndex,adaptiveBackoff,...member})=>member),memberCount:memberRows.length,movedCount:sceneMoved,distanceImprovement:ROUND(sceneImprovement),movementDistance:ROUND(sceneMovement)});}
  }
  return{...parts,decorations:rows,scenePrefabs,generationStats:{...parts.generationStats,scenePrefabEvaluatedCount:evaluated,scenePrefabSceneCount:resolved,scenePrefabMemberCount:members,scenePrefabMovedCount:moved,scenePrefabConnectorCount:connectors,scenePrefabDistanceImprovement:ROUND(totalImprovement),scenePrefabMovementDistance:ROUND(totalMovement),scenePrefabRhythmProtectedCount:rhythmProtected,scenePrefabSafetyRejectedCount:safetyRejected,scenePrefabPairRollbackCount:pairRollbackCount,scenePrefabAdaptiveBackoffCount:adaptiveBackoffCount}};
}

export function scenePrefabTieScore(map){const s=map?.generationStats||{},scenes=Number(s.scenePrefabSceneCount)||0,members=Number(s.scenePrefabMemberCount)||0,moved=Number(s.scenePrefabMovedCount)||0,connectors=Number(s.scenePrefabConnectorCount)||0,improvement=Number(s.scenePrefabDistanceImprovement)||0;return Math.min(14,scenes*1.2+members*.18+moved*.28+connectors*.45+Math.min(3,improvement/500));}
