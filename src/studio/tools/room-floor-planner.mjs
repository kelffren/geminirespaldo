/* KELO-INDEX
 * area: STUDIO / QUICK BUILD ROOM FLOOR
 * owns: plug-and-play interior floor tiling for semantic ROOM plans
 * does-not-own: input, document mutation, CommandBus, authority, rendering
 * public-api: planRoomFloor()
 * online: pure planner; callers commit rows through placement.commitBatch()
 */

export function planRoomFloor({roomId,floorPiece,floorPrefab,x0,y0,x1,y1}={}){
  if(!floorPiece?.prefabId||!floorPrefab)return[];
  const bounds={w:Math.max(1,Number(floorPrefab?.bounds?.w)||1),h:Math.max(1,Number(floorPrefab?.bounds?.h)||1)};
  const width=Math.max(0,Number(x1)-Number(x0)),height=Math.max(0,Number(y1)-Number(y0));
  const cols=Math.floor((width+1e-6)/bounds.w),rows=Math.floor((height+1e-6)/bounds.h);
  if(cols<1||rows<1)return[];
  const snapPoints=[
    {id:'north',type:'floor',x:bounds.w/2,y:0,direction:'north'},
    {id:'south',type:'floor',x:bounds.w/2,y:bounds.h,direction:'south'},
    {id:'west',type:'floor',x:0,y:bounds.h/2,direction:'west'},
    {id:'east',type:'floor',x:bounds.w,y:bounds.h/2,direction:'east'}
  ];
  const result=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    result.push({
      prefabId:String(floorPiece.prefabId),
      transform:{x:Number(x0)+col*bounds.w,y:Number(y0)+row*bounds.h,rotation:0},
      bounds:{...bounds},
      components:{buildingPiece:{type:'floor',system:'quick-build',version:3,roomGenerated:true,roomId,roomInterior:true,roomFloorCol:col,roomFloorRow:row,prefabId:String(floorPiece.prefabId),snapPoints:snapPoints.map(point=>({...point}))}}
    });
  }
  return result;
}
