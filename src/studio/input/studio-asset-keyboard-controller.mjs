/* KELO-INDEX
 * area: STUDIO / INPUT / ASSET PALETTE
 * owns: keyboard-only navigation for the existing floating asset palette
 * does-not-own: asset catalog, placement, world mutations, history or authority
 * public-api: createStudioAssetKeyboardController(), nextAssetPaletteIndex()
 * online: no; delegates final selection to assetPalette.choose()
 */

const NAV_KEYS=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
const isEditable=target=>!!target?.closest?.('input,textarea,select,[contenteditable="true"]');

export function nextAssetPaletteIndex(current,count,key,columns=4){
  count=Math.max(0,Number(count)||0);if(!count)return -1;
  current=Number.isInteger(current)&&current>=0&&current<count?current:0;
  columns=Math.max(1,Number(columns)||1);
  if(key==='ArrowRight')return Math.min(count-1,current+1);
  if(key==='ArrowLeft')return Math.max(0,current-1);
  if(key==='ArrowDown')return Math.min(count-1,current+columns);
  if(key==='ArrowUp')return Math.max(0,current-columns);
  return current;
}

export function createStudioAssetKeyboardController({root=globalThis,assetPalette}={}){
  const document=root?.document;
  if(!document||!assetPalette)return Object.freeze({destroy(){},open:()=>false});
  let destroyed=false,lastOpener=null;

  const shell=()=>document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
  const palette=()=>shell()?.querySelector?.('.ks-asset-palette')||null;
  const visibleItems=()=>[...(palette()?.querySelectorAll?.('[data-asset-palette-id]')||[])].filter(node=>node.offsetParent!==null||node.getClientRects?.().length);
  const searchInput=()=>palette()?.querySelector?.('.ks-asset-palette-search')||null;
  const columns=()=>{
    const items=visibleItems();if(items.length<2)return 1;
    const firstTop=Math.round(items[0].getBoundingClientRect?.().top||0);let n=0;
    for(const item of items){if(Math.abs(Math.round(item.getBoundingClientRect?.().top||0)-firstTop)>2)break;n++;}
    return Math.max(1,n||1);
  };
  function focusIndex(index){const items=visibleItems();if(!items.length)return false;const next=Math.max(0,Math.min(items.length-1,index));items[next].focus?.({preventScroll:true});items[next].scrollIntoView?.({block:'nearest',inline:'nearest'});return true;}
  function restoreOpener(){const target=lastOpener;lastOpener=null;if(!target||target.isConnected===false||target.closest?.('.ks-asset-palette'))return false;target.focus?.({preventScroll:true});return true;}
  function open(){const active=document.activeElement;if(active&&!active.closest?.('.ks-asset-palette'))lastOpener=active;const value=assetPalette.open?.();root.requestAnimationFrame?.(()=>searchInput()?.focus?.());return value!==false;}
  function closeAndRestore(){const value=assetPalette.close?.();root.requestAnimationFrame?.(restoreOpener);return value!==false;}
  function onKey(event){
    if(destroyed||event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey)return;
    const target=event.target;
    const inPalette=!!target?.closest?.('.ks-asset-palette');
    if(!assetPalette.openState){
      if(!isEditable(target)&&String(event.key).toLowerCase()==='a'){
        event.preventDefault();event.stopPropagation();open();
      }
      return;
    }
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();closeAndRestore();return;
    }
    if(event.key==='Enter'&&inPalette){
      const item=target?.closest?.('[data-asset-palette-id]')||visibleItems()[0];
      if(item){event.preventDefault();event.stopPropagation();assetPalette.choose?.(item.dataset.assetPaletteId);}
      return;
    }
    if(!NAV_KEYS.has(event.key)||!inPalette)return;
    const items=visibleItems();if(!items.length)return;
    event.preventDefault();event.stopPropagation();
    const current=items.indexOf(target?.closest?.('[data-asset-palette-id]'));
    const start=current>=0?current:0;
    focusIndex(nextAssetPaletteIndex(start,items.length,event.key,columns()));
  }
  document.addEventListener('keydown',onKey,true);
  return Object.freeze({open,close:closeAndRestore,destroy(){destroyed=true;lastOpener=null;document.removeEventListener('keydown',onKey,true);}});
}
