/* KELO-INDEX
 * area: STUDIO / GRID OVERLAY
 * owns: editor-only snap grid visualization
 * does-not-own: snapping rules, terrain or world rendering
 * public-api: createCreatorGridOverlay()
 * online: local-only
 */

export function createCreatorGridOverlay({size=32,visible=true}={}){
  let gridSize=Math.max(1,Number(size)||32),isVisible=!!visible;
  function configure({size:nextSize,visible:nextVisible}={}){if(nextSize!=null)gridSize=Math.max(1,Number(nextSize)||1);if(nextVisible!=null)isVisible=!!nextVisible;return state();}
  function draw(ctx,{camera={x:0,y:0},viewWidth=1000,viewHeight=800,zoom=1}={}){
    if(!ctx||!isVisible||gridSize<4)return;const z=Math.max(.05,Number(zoom)||1),halfW=viewWidth/(2*z),halfH=viewHeight/(2*z),minX=Math.floor((camera.x-halfW)/gridSize)*gridSize,maxX=Math.ceil((camera.x+halfW)/gridSize)*gridSize,minY=Math.floor((camera.y-halfH)/gridSize)*gridSize,maxY=Math.ceil((camera.y+halfH)/gridSize)*gridSize;
    const maxLines=260;if((maxX-minX)/gridSize+(maxY-minY)/gridSize>maxLines)return;
    ctx.save();ctx.lineWidth=1/z;ctx.strokeStyle='rgba(231,197,106,.10)';ctx.beginPath();for(let x=minX;x<=maxX;x+=gridSize){ctx.moveTo(x,minY);ctx.lineTo(x,maxY);}for(let y=minY;y<=maxY;y+=gridSize){ctx.moveTo(minX,y);ctx.lineTo(maxX,y);}ctx.stroke();ctx.restore();
  }
  function state(){return{size:gridSize,visible:isVisible};}
  return Object.freeze({configure,draw,state});
}
