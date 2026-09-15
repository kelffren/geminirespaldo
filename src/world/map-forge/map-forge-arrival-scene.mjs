/* KELO-INDEX
 * area: WORLD / MAP FORGE / ARRIVAL SCENE
 * owner: KeloMapForge deterministic generator core
 * purpose: turn spawn and world-edge exits into authored gateway scenes using already-generated decorations
 * public-api: materializeArrivalScene()
 * consumes: generated Map Forge candidate parts + world bounds
 * state-owned: none
 * do-not: no DOM, renderer, catalog mutation, gameplay state or Math.random
 */
import {insideBounds} from './map-forge-geometry.mjs';
import {hasApprovedDecorationSprite} from './map-forge-sprite-manifest.mjs';

const ROUND=value=>Math.round(Number(value||0)*10)/10;
const MAX_SOURCE_DISTANCE=760;
const MIN_SPACING=64;
const BLOCK_PAD=20;
const LANDMARK_PAD=20;
const EXIT_GATE_DEPTH=184;

const PAIRS=Object.freeze({
  plaza:Object.freeze([{family:'lamp',roles:['arrival-light-left','arrival-light-right'],forward:72,lateral:112},{family:'bench',roles:['arrival-rest-left','arrival-rest-right'],forward:-50,lateral:156}]),
  royal:Object.freeze([{family:'lamp',roles:['arrival-light-left','arrival-light-right'],forward:72,lateral:112},{family:'bench',roles:['arrival-rest-left','arrival-rest-right'],forward:-50,lateral:156}]),
  commerce:Object.freeze([{family:'lamp',roles:['arrival-light-left','arrival-light-right'],forward:66,lateral:104},{family:'bench',roles:['arrival-rest-left','arrival-rest-right'],forward:-46,lateral:148}]),
  farm:Object.freeze([{family:'flower',roles:['arrival-flower-left','arrival-flower-right'],forward:58,lateral:108},{family:'crate',roles:['arrival-crate-left','arrival-crate-right'],forward:-52,lateral:148}]),
  forest:Object.freeze([{family:'bush',roles:['arrival-shrub-left','arrival-shrub-right'],forward:56,lateral:108},{family:'tree',roles:['arrival-tree-left','arrival-tree-right'],forward:-54,lateral:146}]),
  mine:Object.freeze([{family:'barrel',roles:['arrival-barrel-left','arrival-barrel-right'],forward:54,lateral:100},{family:'crate',roles:['arrival-crate-left','arrival-crate-right'],forward:-48,lateral:142}]),
  default:Object.freeze([{family:'tree',roles:['arrival-tree-left','arrival-tree-right'],forward:62,lateral:118},{family:'rock',roles:['arrival-stone-left','arrival-stone-right'],forward:-56,lateral:150}])
});

const pointDistance=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
const spacingForKind=kind=>kind==='forest'?70:88;
function pointInsideRect(p,r,pad=0){return p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;}
function nearestRoadFrame(point,roads){let best=null;for(const road of roads||[]){const pts=road.polyline||[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0,x=a.x+dx*t,y=a.y+dy*t,distance=Math.hypot(x-point.x,y-point.y);if(!best||distance<best.distance)best={roadId:road.id,x,y,distance,tx:dx/len,ty:dy/len};}}if(!best)return null;let fx=best.x-point.x,fy=best.y-point.y,flen=Math.hypot(fx,fy);if(flen<1){fx=-best.ty;fy=best.tx;flen=1;}fx/=flen;fy/=flen;return{...best,fx,fy,lx:-fy,ly:fx};}
function districtOwnerAt(parts,p){let owner=null,best=Infinity;for(const district of parts.districts||[]){const dx=p.x-district.center.x,dy=p.y-district.center.y,cost=(dx*dx+dy*dy)/Math.max(.2,Number(district.weight)||1);if(cost<best){best=cost;owner=district.id;}}return owner;}
function districtKind(parts,districtId){return(parts.districts||[]).find(row=>row.id===districtId)?.kind;}
function roadClearanceForDistrict(parts,districtId){return districtKind(parts,districtId)==='commerce'?35:22;}
function targetPoint(spawn,frame,forward,lateral){return{x:ROUND(spawn.x+frame.fx*forward+frame.lx*lateral),y:ROUND(spawn.y+frame.fy*forward+frame.ly*lateral)};}
function safePoint(parts,rows,index,p,worldBounds){const source=rows[index];if(!source||!insideBounds(p,worldBounds,36))return false;if(districtOwnerAt(parts,p)!==source.district)return false;const road=nearestRoadFrame(p,parts.roads);if(!road||road.distance<roadClearanceForDistrict(parts,source.district))return false;if((parts.blocks||[]).some(block=>pointInsideRect(p,block.bounds,BLOCK_PAD)))return false;for(const landmark of parts.landmarks||[]){const radius=Math.max(0,Number(landmark?.clearance?.radius)||0)+LANDMARK_PAD;if(radius&&pointDistance(p,landmark.position||landmark)<radius)return false;}const sourceKind=districtKind(parts,source.district);for(let i=0;i<rows.length;i++){if(i===index)continue;const other=rows[i],required=other.district===source.district?MIN_SPACING:Math.min(spacingForKind(sourceKind),spacingForKind(districtKind(parts,other.district)));if(pointDistance(p,other)<required)return false;}return true;}
function chooseSource(rows,district,family,target,used){let best=null;for(let i=0;i<rows.length;i++){const row=rows[i];if(used.has(i)||row.scenePrefabId||row.district!==district||row.family!==family)continue;const distance=pointDistance(row,target);if(distance>MAX_SOURCE_DISTANCE)continue;if(!best||distance<best.distance-1e-6||Math.abs(distance-best.distance)<=1e-6&&i<best.index)best={index:i,distance};}return best;}
function acceptedPoint(parts,rows,index,target,worldBounds){const source=rows[index];for(const t of[1,.84,.68,.52]){const p={x:ROUND(source.x+(target.x-source.x)*t),y:ROUND(source.y+(target.y-source.y)*t)};if(safePoint(parts,rows,index,p,worldBounds))return p;}return null;}
function rotationFromFrame(frame){const degrees=Math.atan2(-frame.fx,frame.fy)*180/Math.PI;return((Math.round(degrees/90)*90)%360+360)%360;}
function exitRoadFrame(parts,exit){const road=(parts.roads||[]).find(row=>row.id===`road:exit:${exit.id}`||row.to===`exit:${exit.id}`),points=road?.polyline||[];if(points.length<2)return null;const first=points[0],last=points.at(-1),lastIsExit=pointDistance(last,exit)<=pointDistance(first,exit),edge=lastIsExit?last:first,inside=lastIsExit?points.at(-2):points[1],dx=inside.x-edge.x,dy=inside.y-edge.y,len=Math.hypot(dx,dy)||1,fx=dx/len,fy=dy/len;return{roadId:road.id,fx,fy,lx:-fy,ly:fx,x:edge.x,y:edge.y,distance:pointDistance(edge,exit)};}
function exitAnchor(exit,frame){return{x:ROUND(exit.x+frame.fx*EXIT_GATE_DEPTH),y:ROUND(exit.y+frame.fy*EXIT_GATE_DEPTH)};}
function materializeExitGateways(parts,{worldBounds}={}){
  if(!worldBounds)return parts;
  const rows=(parts.decorations||[]).map(row=>({...row})),scenes=[...(parts.scenePrefabs||[]).filter(row=>row.sceneType!=='exit')];let resolved=0,members=0,moved=0,totalMovement=0;
  for(const exit of parts.exits||[]){
    const district=(parts.districts||[]).find(row=>row.id===exit.district),frame=exitRoadFrame(parts,exit);if(!district||!frame)continue;
    const anchor=exitAnchor(exit,frame);let placement=null;
    for(const pair of PAIRS[district.kind]||PAIRS.default){
      if(!hasApprovedDecorationSprite(pair.family))continue;
      const lateral=Math.max(pair.lateral,112),leftTarget=targetPoint(anchor,frame,0,-lateral),rightTarget=targetPoint(anchor,frame,0,lateral),used=new Set(),left=chooseSource(rows,exit.district,pair.family,leftTarget,used);if(!left)continue;used.add(left.index);const right=chooseSource(rows,exit.district,pair.family,rightTarget,used);if(!right)continue;
      const originalLeft={...rows[left.index]},originalRight={...rows[right.index]},leftAccepted=acceptedPoint(parts,rows,left.index,leftTarget,worldBounds);if(!leftAccepted)continue;rows[left.index].x=leftAccepted.x;rows[left.index].y=leftAccepted.y;const rightAccepted=acceptedPoint(parts,rows,right.index,rightTarget,worldBounds);if(!rightAccepted){rows[left.index]=originalLeft;rows[right.index]=originalRight;continue;}rows[right.index].x=rightAccepted.x;rows[right.index].y=rightAccepted.y;placement={pair,left,right,leftTarget,rightTarget,originalLeft,originalRight};break;
    }
    if(!placement)continue;
    const {pair,left,right,leftTarget,rightTarget,originalLeft,originalRight}=placement;
    const sceneId=`scene-prefab:exit:${exit.id}:edge-gateway-v1`,sceneMembers=[];
    for(const [sourceIndex,role,target,before] of[[left.index,'exit-marker-left',leftTarget,originalLeft],[right.index,'exit-marker-right',rightTarget,originalRight]]){const row=rows[sourceIndex],movement=pointDistance(before,row);row.scenePrefabId=sceneId;row.sceneRole=role;row.sceneKit='arrival';row.sceneVariant='edge-gateway';sceneMembers.push({role,family:pair.family,decorationId:row.id,position:{x:ROUND(row.x),y:ROUND(row.y)},ideal:target,sourceDistance:ROUND(pointDistance(before,target)),finalDistance:ROUND(pointDistance(row,target)),movement:ROUND(movement)});if(movement>=1)moved++;totalMovement+=movement;}
    scenes.push({id:sceneId,prefabId:'exit-edge-gateway-v1',sceneType:'exit',kit:'arrival',variant:'edge-gateway',landmarkId:null,exitId:exit.id,district:exit.district,anchor,rotation:rotationFromFrame(frame),connectors:[{id:'road-egress',kind:'road',required:true,roadId:frame.roadId,position:{x:ROUND(frame.x),y:ROUND(frame.y)},distance:ROUND(frame.distance),facing:'boundary'}],members:sceneMembers,memberCount:2,movedCount:sceneMembers.filter(row=>row.movement>=1).length,distanceImprovement:0,movementDistance:ROUND(sceneMembers.reduce((sum,row)=>sum+row.movement,0))});resolved++;members+=2;
  }
  return{...parts,decorations:rows,scenePrefabs:scenes,generationStats:{...parts.generationStats,exitSceneResolvedCount:resolved,exitSceneMemberCount:members,exitSceneMovedCount:moved,exitSceneMovementDistance:ROUND(totalMovement)}};
}

export function materializeArrivalScene(parts,{worldBounds}={}){
  const spawn=(parts.spawnPoints||[])[0];if(!spawn||!worldBounds)return parts;
  const district=(parts.districts||[]).find(row=>row.id===spawn.district),frame=nearestRoadFrame(spawn,parts.roads);if(!district||!frame)return parts;
  const rows=(parts.decorations||[]).map(row=>({...row})),sceneId='scene-prefab:spawn:arrival-gateway-v1',used=new Set(),members=[];let moved=0,totalMovement=0;
  const pairs=PAIRS[district.kind]||PAIRS.default;
  for(const pair of pairs){
    if(!hasApprovedDecorationSprite(pair.family))continue;
    const leftTarget=targetPoint(spawn,frame,pair.forward,-pair.lateral),rightTarget=targetPoint(spawn,frame,pair.forward,pair.lateral),left=chooseSource(rows,spawn.district,pair.family,leftTarget,used);if(!left)continue;used.add(left.index);const right=chooseSource(rows,spawn.district,pair.family,rightTarget,used);if(!right){used.delete(left.index);continue;}used.add(right.index);
    const originalLeft={...rows[left.index]},originalRight={...rows[right.index]},leftAccepted=acceptedPoint(parts,rows,left.index,leftTarget,worldBounds);if(!leftAccepted){used.delete(left.index);used.delete(right.index);continue;}rows[left.index].x=leftAccepted.x;rows[left.index].y=leftAccepted.y;const rightAccepted=acceptedPoint(parts,rows,right.index,rightTarget,worldBounds);if(!rightAccepted){rows[left.index]=originalLeft;rows[right.index]=originalRight;used.delete(left.index);used.delete(right.index);continue;}
    rows[right.index].x=rightAccepted.x;rows[right.index].y=rightAccepted.y;
    for(const [sourceIndex,role,target] of[[left.index,pair.roles[0],leftTarget],[right.index,pair.roles[1],rightTarget]]){const before=sourceIndex===left.index?originalLeft:originalRight,row=rows[sourceIndex],movement=pointDistance(before,row);row.scenePrefabId=sceneId;row.sceneRole=role;row.sceneKit='arrival';row.sceneVariant='gateway';members.push({role,family:pair.family,decorationId:row.id,position:{x:ROUND(row.x),y:ROUND(row.y)},ideal:target,sourceDistance:ROUND(pointDistance(before,target)),finalDistance:ROUND(pointDistance(row,target)),movement:ROUND(movement)});if(movement>=1)moved++;totalMovement+=movement;}
  }
  const scenes=[...(parts.scenePrefabs||[]).filter(row=>row.id!==sceneId)];
  if(members.length>=2){const rotation=rotationFromFrame(frame),scene={id:sceneId,prefabId:'spawn-arrival-gateway-v1',sceneType:'arrival',kit:'arrival',variant:'gateway',landmarkId:null,district:spawn.district,anchor:{x:ROUND(spawn.x),y:ROUND(spawn.y)},rotation,connectors:[{id:'road-entry',kind:'road',required:true,roadId:frame.roadId,position:{x:ROUND(frame.x),y:ROUND(frame.y)},distance:ROUND(frame.distance),facing:'road'}],members,memberCount:members.length,movedCount:moved,distanceImprovement:0,movementDistance:ROUND(totalMovement)};scenes.push(scene);}
  return materializeExitGateways({...parts,decorations:rows,scenePrefabs:scenes,generationStats:{...parts.generationStats,arrivalSceneResolvedCount:members.length>=2?1:0,arrivalSceneMemberCount:members.length>=2?members.length:0,arrivalSceneMovedCount:members.length>=2?moved:0,arrivalSceneMovementDistance:members.length>=2?ROUND(totalMovement):0}},{worldBounds});
}
