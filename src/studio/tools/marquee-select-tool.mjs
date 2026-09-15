/* KELO-INDEX
 * area: STUDIO / MARQUEE SELECT
 * owns: local rectangular multi-selection preview and commit
 * does-not-own: pointer transport, camera gestures or drawing
 * public-api: createMarqueeSelectTool()
 * online: local-only
 */

export function createMarqueeSelectTool(kernel){
  if(!kernel)throw new Error('STUDIO_MARQUEE_KERNEL_REQUIRED');let state=null;
  const rect=()=>{if(!state)return null;const x=Math.min(state.x0,state.x1),y=Math.min(state.y0,state.y1);return{x,y,w:Math.max(1,Math.abs(state.x1-state.x0)),h:Math.max(1,Math.abs(state.y1-state.y0))};};
  const contained=(row,box)=>{const r=row?.rect;if(!r)return false;return r.x>=box.x&&r.y>=box.y&&r.x+r.w<=box.x+box.w&&r.y+r.h<=box.y+box.h;};
  function begin(x,y,{append=false}={}){const toggledFrom=append?[...(kernel.selection.get?.()||[])]:[];state={x0:Number(x)||0,y0:Number(y)||0,x1:Number(x)||0,y1:Number(y)||0,append:!!append,toggledFrom};return rect();}
  function move(x,y){if(!state)return null;state.x1=Number(x)||0;state.y1=Number(y)||0;return rect();}
  function commit(){if(!state)return[];const box=rect(),append=state.append,toggledFrom=state.toggledFrom||[],crossing=state.x1<state.x0;state=null;const rows=kernel.spatial.queryRect(box,{category:'entity'}),ids=(crossing?rows:rows.filter(row=>contained(row,box))).map(row=>row.id);if(append){const hits=new Set(ids.map(String)),selected=new Set(toggledFrom.map(String)),next=toggledFrom.filter(id=>!hits.has(String(id))),seen=new Set(next.map(String));for(const id of ids){const key=String(id);if(!selected.has(key)&&!seen.has(key)){seen.add(key);next.push(id);}}kernel.selection.set(next);}else kernel.selection.set(ids);return ids;}
  function cancel(){state=null;}
  return Object.freeze({id:'marquee',begin,move,commit,cancel,getPreview:rect,get active(){return!!state;}});
}