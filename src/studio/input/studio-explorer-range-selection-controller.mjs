/* KELO-INDEX
 * area: STUDIO / INPUT / EXPLORER RANGE SELECTION
 * owns: desktop-style Shift range selection and focused keyboard navigation inside the virtual Explorer
 * does-not-own: document mutation, CommandBus, authority, Explorer rendering or camera
 * public-api: createStudioExplorerRangeSelectionController(), resolveExplorerNavigationIndex()
 * online: selection-only state; never writes persistent world data
 */

const ENTITY_SELECTOR='#kelo-studio-live [data-entity]';
const PAGE_STEP=10;

export function resolveExplorerNavigationIndex({index=0,length=0,key}={}){
  if(length<=0)return -1;
  const current=Math.max(0,Math.min(length-1,Number(index)||0));
  if(key==='Home')return 0;
  if(key==='End')return length-1;
  if(key==='PageUp')return Math.max(0,current-PAGE_STEP);
  if(key==='PageDown')return Math.min(length-1,current+PAGE_STEP);
  if(key==='ArrowUp')return Math.max(0,current-1);
  if(key==='ArrowDown')return Math.min(length-1,current+1);
  return current;
}

export function resolveExplorerRange({ids=[],anchorId=null,targetId=null,current=[],append=false}={}){
  const order=ids.map(String),target=String(targetId??'');
  if(!target||!order.includes(target))return null;
  const selected=current.map(String);
  let anchor=anchorId==null?'':String(anchorId);
  if(!order.includes(anchor))anchor=[...selected].reverse().find(id=>order.includes(id))||target;
  const a=order.indexOf(anchor),b=order.indexOf(target),from=Math.min(a,b),to=Math.max(a,b),range=order.slice(from,to+1);
  if(!append)return {anchor,target,selection:range};
  const merged=[],seen=new Set();
  for(const id of [...selected,...range])if(!seen.has(id)){seen.add(id);merged.push(id);}
  return {anchor,target,selection:merged};
}

export function createStudioExplorerRangeSelectionController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document?.addEventListener||!kernel?.selection)return Object.freeze({destroy(){}});
  let destroyed=false,anchorId=null;
  const explorerRows=()=>Array.from(document.querySelectorAll?.(ENTITY_SELECTOR)||[]).filter(row=>String(row?.dataset?.entity||''));
  const visibleEntityIds=()=>explorerRows().map(row=>String(row.dataset?.entity||'')).filter(Boolean);

  function focusRow(row,{scroll=false}={}){
    if(!row)return;
    if(row.getAttribute?.('tabindex')==null)row.setAttribute?.('tabindex','-1');
    row.focus?.({preventScroll:true});
    if(scroll)row.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }

  function onclick(event){
    if(destroyed||event.defaultPrevented)return;
    const row=event.target?.closest?.(ENTITY_SELECTOR);
    if(!row)return;
    const id=String(row.dataset?.entity||'');
    if(!id)return;

    if(!event.shiftKey){
      anchorId=id;
      focusRow(row);
      return;
    }

    const result=resolveExplorerRange({
      ids:visibleEntityIds(),
      anchorId,
      targetId:id,
      current:kernel.selection.get?.()||[],
      append:!!(event.ctrlKey||event.metaKey)
    });
    if(!result)return;
    anchorId=result.anchor;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    kernel.selection.set(result.selection);
    focusRow(row);
  }

  function onkeydown(event){
    if(destroyed||event.defaultPrevented||event.altKey)return;
    const row=event.target?.closest?.(ENTITY_SELECTOR);
    if(!row)return;

    const command=!!(event.ctrlKey||event.metaKey);
    if(event.key==='Escape'&&!command&&!event.shiftKey){
      const current=kernel.selection.get?.()||[];
      if(!current.length)return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      anchorId=null;
      kernel.selection.set([]);
      return;
    }

    if(command&&String(event.key||'').toLowerCase()==='a'&&!event.shiftKey){
      const ids=visibleEntityIds();
      if(!ids.length)return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      anchorId=String(row.dataset?.entity||'')||anchorId;
      const current=(kernel.selection.get?.()||[]).map(String);
      if(current.length===ids.length&&current.every((id,index)=>id===ids[index]))return;
      kernel.selection.set(ids);
      return;
    }

    if(command&&(event.key===' '||event.code==='Space')&&!event.shiftKey){
      const id=String(row.dataset?.entity||'');
      if(!id)return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      anchorId=id;
      const current=(kernel.selection.get?.()||[]).map(String);
      const index=current.indexOf(id);
      if(index>=0)kernel.selection.set(current.filter(candidate=>candidate!==id));
      else kernel.selection.set([...current,id]);
      return;
    }

    if(command)return;
    if(!['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))return;
    const rows=explorerRows();
    if(!rows.length)return;
    let index=rows.indexOf(row);
    if(index<0){
      const id=String(row.dataset?.entity||'');
      index=rows.findIndex(candidate=>String(candidate.dataset?.entity||'')===id);
    }
    if(index<0)return;
    const nextIndex=resolveExplorerNavigationIndex({index,length:rows.length,key:event.key});
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    if(nextIndex===index)return;
    const next=rows[nextIndex],id=String(next.dataset?.entity||'');
    if(!id)return;

    if(event.shiftKey){
      const visibleIds=rows.map(candidate=>String(candidate.dataset?.entity||'')).filter(Boolean);
      const current=kernel.selection.get?.()||[];
      const currentId=String(row.dataset?.entity||'');
      if(!anchorId||!visibleIds.includes(String(anchorId)))anchorId=visibleIds.includes(currentId)?currentId:id;
      const result=resolveExplorerRange({ids:visibleIds,anchorId,targetId:id,current,append:false});
      if(!result)return;
      anchorId=result.anchor;
      kernel.selection.set(result.selection);
      focusRow(next,{scroll:true});
      return;
    }

    anchorId=id;
    kernel.selection.set([id]);
    focusRow(next,{scroll:true});
  }

  document.addEventListener('click',onclick,true);
  document.addEventListener('keydown',onkeydown,true);
  return Object.freeze({
    version:'studio-explorer-range-selection-v1.8.0-escape-clear',
    get anchor(){return anchorId;},
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('click',onclick,true);
      document.removeEventListener?.('keydown',onkeydown,true);
    }
  });
}
