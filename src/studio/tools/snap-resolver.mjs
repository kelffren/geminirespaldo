/* KELO-INDEX
 * area: STUDIO / QUICK BUILD SNAP
 * owns: semantic snap-point contracts, local candidate search, nearest compatible connection and cardinal orientation resolution
 * does-not-own: input, rendering, document mutation, commands or authority
 * public-api: createSnapResolver(), defaultSnapPointsForPiece(), worldSnapPoints()
 * online: local-only resolver; callers still commit through placement/CommandBus
 */

const DIR=Object.freeze({north:{x:0,y:-1},south:{x:0,y:1},east:{x:1,y:0},west:{x:-1,y:0},start:{x:-1,y:0},end:{x:1,y:0}});
const norm=value=>String(value||'').trim().toLowerCase();
const clampRotation=value=>{const n=Number(value)||0;return((n%360)+360)%360;};
const cardinalRotations=current=>{const base=clampRotation(current),out=[];for(const value of [base,base+90,base+180,base+270]){const rotation=clampRotation(value);if(!out.includes(rotation))out.push(rotation);}return out;};

export function defaultSnapPointsForPiece(type,bounds={}){
  const w=Math.max(1,Number(bounds.w)||1),h=Math.max(1,Number(bounds.h)||1),piece=norm(type),mx=w/2,my=h/2;
  if(piece==='wall'||piece==='fence')return[
    {id:'start',type:piece,x:0,y:my,direction:'start'},
    {id:'end',type:piece,x:w,y:my,direction:'end'}
  ];
  if(piece==='floor'||piece==='roof')return[
    {id:'north',type:piece,x:mx,y:0,direction:'north'},
    {id:'south',type:piece,x:mx,y:h,direction:'south'},
    {id:'west',type:piece,x:0,y:my,direction:'west'},
    {id:'east',type:piece,x:w,y:my,direction:'east'}
  ];
  if(piece==='corner')return[
    {id:'north',type:'wall',x:mx,y:0,direction:'north'},
    {id:'east',type:'wall',x:w,y:my,direction:'east'}
  ];
  if(piece==='door'||piece==='window')return[{id:'wall-slot',type:'wall-slot',accepts:['wall'],x:mx,y:my,direction:'north'}];
  return[];
}

function normalizedPoints(points,type,bounds){
  const source=Array.isArray(points)&&points.length?points:defaultSnapPointsForPiece(type,bounds);
  return source.map((point,index)=>({
    id:String(point?.id||`snap-${index}`),
    type:norm(point?.type||type),
    accepts:Array.isArray(point?.accepts)?point.accepts.map(norm).filter(Boolean):null,
    x:Number(point?.x)||0,
    y:Number(point?.y)||0,
    direction:norm(point?.direction||'')
  }));
}

function rotateLocal(point,bounds,rotation){
  const w=Math.max(1,Number(bounds?.w)||1),h=Math.max(1,Number(bounds?.h)||1),cx=w/2,cy=h/2,rad=clampRotation(rotation)*Math.PI/180;
  const dx=point.x-cx,dy=point.y-cy,cos=Math.cos(rad),sin=Math.sin(rad);
  return{x:cx+dx*cos-dy*sin,y:cy+dx*sin+dy*cos};
}

export function worldSnapPoints(entity){
  const piece=entity?.components?.buildingPiece||{},bounds=entity?.bounds||{},transform=entity?.transform||{};
  return normalizedPoints(piece.snapPoints,piece.type,bounds).map(point=>{
    const local=rotateLocal(point,bounds,transform.rotation);
    return{...point,x:(Number(transform.x)||0)+local.x,y:(Number(transform.y)||0)+local.y,entityId:String(entity?.id||'')};
  });
}

function compatible(a,b){
  if(!a?.type||!b?.type)return false;
  if(a.type===b.type)return true;
  if(a.accepts?.includes?.(b.type)||b.accepts?.includes?.(a.type))return true;
  return false;
}

export function createSnapResolver({spatial,radius=48}={}){
  if(!spatial?.queryRect)throw new Error('STUDIO_SNAP_SPATIAL_REQUIRED');
  let searchRadius=Math.max(4,Number(radius)||48);
  let last=Object.freeze({state:'none',candidateCount:0,checkedPairs:0,rotationChecks:0,connection:null});

  function resolve(preview,{radius:nextRadius=searchRadius,excludeIds=[],rotations=null}={}){
    if(!preview){last=Object.freeze({state:'none',candidateCount:0,checkedPairs:0,rotationChecks:0,connection:null});return last;}
    const r=Math.max(4,Number(nextRadius)||searchRadius),excluded=new Set((excludeIds||[]).map(String));
    const currentRotation=clampRotation(preview.transform?.rotation),rotationOptions=Array.isArray(rotations)&&rotations.length?[...new Set(rotations.map(clampRotation))]:cardinalRotations(currentRotation);
    const hasPoints=worldSnapPoints(preview).length>0;
    if(!hasPoints){last=Object.freeze({state:'none',candidateCount:0,checkedPairs:0,rotationChecks:0,connection:null});return last;}
    const x=Number(preview.transform?.x)||0,y=Number(preview.transform?.y)||0,w=Math.max(1,Number(preview.bounds?.w)||1),h=Math.max(1,Number(preview.bounds?.h)||1);
    const reach=Math.max(w,h)+r;
    const nearby=spatial.queryRect({x:x-reach,y:y-reach,w:w+reach*2,h:h+reach*2},{category:'entity'}).filter(row=>{
      const entity=row?.data;if(!entity||excluded.has(String(entity.id)))return false;
      return !!entity.components?.buildingPiece?.type;
    });
    let best=null,checkedPairs=0,rotationChecks=0;
    for(const rotation of rotationOptions){
      rotationChecks++;
      const candidatePreview={...preview,transform:{...(preview.transform||{}),rotation}};
      const sourcePoints=worldSnapPoints(candidatePreview);
      for(const row of nearby){
        const targetEntity=row.data;
        for(const source of sourcePoints){
          for(const target of worldSnapPoints(targetEntity)){
            checkedPairs++;
            if(!compatible(source,target))continue;
            const dx=target.x-source.x,dy=target.y-source.y,distance=Math.hypot(dx,dy);
            const betterTie=best&&Math.abs(distance-best.distance)<1e-9&&rotation===currentRotation&&best.rotation!==currentRotation;
            if(distance>r||(best&&distance>best.distance)||(!betterTie&&best&&Math.abs(distance-best.distance)<1e-9))continue;
            best={distance,dx,dy,source,target,targetEntityId:String(targetEntity.id),rotation};
          }
        }
      }
    }
    if(!best){last=Object.freeze({state:'valid',candidateCount:nearby.length,checkedPairs,rotationChecks,connection:null});return last;}
    const result={
      state:'snapped',candidateCount:nearby.length,checkedPairs,rotationChecks,
      x:x+best.dx,y:y+best.dy,rotation:best.rotation,autoRotated:best.rotation!==currentRotation,
      connection:{distance:best.distance,source:{...best.source},target:{...best.target},targetEntityId:best.targetEntityId}
    };
    last=Object.freeze(result);return last;
  }

  return Object.freeze({resolve,setRadius:value=>{searchRadius=Math.max(4,Number(value)||searchRadius);return searchRadius;},get radius(){return searchRadius;},getLast:()=>last});
}
