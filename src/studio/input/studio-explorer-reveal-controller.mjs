/* KELO-INDEX
 * area: STUDIO / INPUT / EXPLORER REVEAL
 * owns: local Explorer navigation that reveals the latest selection anchor
 * does-not-own: camera state, document mutation, CommandBus, authority or range selection
 * public-api: createStudioExplorerRevealController(), explorerRevealScrollTop()
 * online: local-only; reads selection/document and scrolls existing virtualized Explorer viewports
 */

const ROW_HEIGHT=46;
const EDGE_PAD=8;

export function explorerRevealScrollTop({index,rowHeight=ROW_HEIGHT,scrollTop=0,viewportHeight=0,pad=EDGE_PAD}={}){
  const i=Math.max(0,Math.floor(Number(index)||0));
  const h=Math.max(1,Number(rowHeight)||ROW_HEIGHT);
  const top=Math.max(0,Number(scrollTop)||0);
  const height=Math.max(0,Number(viewportHeight)||0);
  const edge=Math.max(0,Number(pad)||0);
  if(!height)return top;
  const rowTop=i*h,rowBottom=rowTop+h;
  if(rowTop<top+edge)return Math.max(0,rowTop-edge);
  if(rowBottom>top+height-edge)return Math.max(0,rowBottom-height+edge);
  return top;
}

export function createStudioExplorerRevealController({root=globalThis,kernel,rowHeight=ROW_HEIGHT}={}){
  const document=root?.document;
  if(!document||!kernel?.selection?.get||!kernel?.selection?.onChange)return Object.freeze({reveal:()=>false,destroy(){}});
  let destroyed=false,pending=null,lastSignature='';

  const schedule=fn=>{
    if(typeof root.requestAnimationFrame==='function')return {kind:'raf',id:root.requestAnimationFrame(fn)};
    return {kind:'timer',id:(root.setTimeout||setTimeout)(fn,0)};
  };
  const cancel=token=>{
    if(!token)return;
    if(token.kind==='raf')root.cancelAnimationFrame?.(token.id);
    else (root.clearTimeout||clearTimeout)(token.id);
  };

  function reveal(ids=kernel.selection.get()){
    if(destroyed)return false;
    const selected=Array.isArray(ids)?ids.map(String).filter(Boolean):[];
    if(!selected.length)return false;
    const anchor=selected[selected.length-1];
    const entities=kernel.document?.entities||[];
    const index=entities.findIndex(row=>String(row?.id)===anchor);
    if(index<0)return false;
    const shell=document.querySelector?.('#kelo-studio-live');
    if(!shell)return false;
    const viewports=shell.querySelectorAll?.('.ks-explorer')||[];
    let changed=false;
    for(const viewport of viewports){
      const current=Number(viewport.scrollTop)||0;
      const next=explorerRevealScrollTop({index,rowHeight,scrollTop:current,viewportHeight:Number(viewport.clientHeight)||0});
      if(Math.abs(next-current)<.5)continue;
      viewport.scrollTop=next;
      viewport.dispatchEvent?.(new Event('scroll'));
      changed=true;
    }
    return changed;
  }

  function onSelection(ids){
    const selected=Array.isArray(ids)?ids.map(String).filter(Boolean):kernel.selection.get().map(String).filter(Boolean);
    const signature=selected.join('\u001f');
    if(signature===lastSignature)return;
    lastSignature=signature;
    cancel(pending);
    pending=schedule(()=>{pending=null;reveal(selected);});
  }

  const unsubscribe=kernel.selection.onChange(onSelection)||(()=>{});
  onSelection(kernel.selection.get());
  return Object.freeze({
    version:'studio-explorer-reveal-v1.2.0-single-owner',reveal,
    destroy(){if(destroyed)return;destroyed=true;cancel(pending);pending=null;unsubscribe?.();}
  });
}
