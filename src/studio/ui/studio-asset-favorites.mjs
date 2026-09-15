/* KELO-INDEX
 * area: STUDIO / ASSET FAVORITES
 * owns: local persistent favorite shortcuts layered onto the floating asset palette
 * does-not-own: asset placement, world state, CommandBus, history or authority
 * public-api: createStudioAssetFavorites(), normalizeFavoriteIds()
 * online: no; editor preference only
 */

const STYLE_ID='kelo-studio-asset-favorites-style';
const STORAGE_KEY='kelo.studio.assetFavorites.v1';
const MAX_FAVORITES=18;

export function normalizeFavoriteIds(value,limit=MAX_FAVORITES){
  const source=Array.isArray(value)?value:[];
  const seen=new Set(),out=[];
  for(const raw of source){const id=String(raw||'').trim();if(!id||seen.has(id))continue;seen.add(id);out.push(id);if(out.length>=Math.max(1,Number(limit)||MAX_FAVORITES))break;}
  return out;
}

function ensureStyle(document){
  if(!document?.head||document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-asset-favorites{display:none;gap:5px;overflow-x:auto;padding:0 9px 8px;scrollbar-width:none}
    #kelo-studio-live .ks-asset-favorites.on{display:flex}
    #kelo-studio-live .ks-asset-favorites::-webkit-scrollbar{display:none}
    #kelo-studio-live .ks-asset-favorite-chip{flex:0 0 auto;max-width:128px;height:31px;border:1px solid rgba(231,197,106,.25);border-radius:999px;background:#111f20;color:#eadb9e;padding:0 10px;font-size:6px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #kelo-studio-live .ks-asset-palette-item{position:relative}
    #kelo-studio-live .ks-asset-favorite-star{position:absolute;right:5px;top:5px;z-index:2;width:27px;height:27px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(6,16,18,.88);color:#81958e;font-size:14px;line-height:1;padding:0}
    #kelo-studio-live .ks-asset-favorite-star.on{color:#f2d46f;border-color:rgba(231,197,106,.46);background:#1b302a}
    @media(max-width:760px){#kelo-studio-live .ks-asset-favorite-star{width:30px;height:30px;font-size:15px}}
  `;
  document.head.appendChild(style);
}

export function createStudioAssetFavorites({root=globalThis,paletteApi,getAssets=()=>[]}={}){
  const document=root?.document;
  if(!document||!paletteApi)return Object.freeze({refresh(){},destroy(){},toggle(){return false;},get ids(){return [];}});
  ensureStyle(document);
  let destroyed=false,observer=null,host=null,refreshPending=false;
  let ids=[];
  try{ids=normalizeFavoriteIds(JSON.parse(root.localStorage?.getItem?.(STORAGE_KEY)||'[]'));}catch{ids=[];}
  const save=()=>{try{root.localStorage?.setItem?.(STORAGE_KEY,JSON.stringify(ids));}catch{}};
  const assetsById=()=>new Map((getAssets?.()||[]).filter(Boolean).map(row=>[String(row.id),row]));
  function toggle(id){id=String(id||'');if(!id)return false;const index=ids.indexOf(id);if(index>=0)ids.splice(index,1);else ids=normalizeFavoriteIds([id,...ids]);save();refresh();return ids.includes(id);}
  function ensureHost(palette){
    if(host?.isConnected)return host;
    host=document.createElement('div');host.className='ks-asset-favorites';host.dataset.keloStudioUi='1';host.setAttribute('aria-label','Assets favoritos');
    const cats=palette.querySelector('.ks-asset-palette-cats');palette.insertBefore(host,cats||palette.querySelector('.ks-asset-palette-grid'));return host;
  }
  function refresh(){
    if(destroyed)return;
    const palette=document.querySelector('#kelo-studio-live .ks-asset-palette');if(!palette)return;
    const favHost=ensureHost(palette),byId=assetsById();ids=ids.filter(id=>byId.has(id));save();favHost.replaceChildren();favHost.classList.toggle('on',ids.length>0);
    for(const id of ids){const asset=byId.get(id);const b=document.createElement('button');b.type='button';b.className='ks-asset-favorite-chip';b.dataset.favoriteAssetId=id;b.textContent=`★ ${asset?.label||asset?.name||id}`;b.title=asset?.label||asset?.name||id;favHost.appendChild(b);}
    for(const item of palette.querySelectorAll('[data-asset-palette-id]')){
      const id=String(item.dataset.assetPaletteId||'');let star=item.querySelector('.ks-asset-favorite-star');if(!star){star=document.createElement('button');star.type='button';star.className='ks-asset-favorite-star';star.dataset.favoriteToggle=id;star.setAttribute('aria-label','Marcar como favorito');star.title='Favorito';star.textContent='★';item.appendChild(star);}star.classList.toggle('on',ids.includes(id));star.setAttribute('aria-pressed',ids.includes(id)?'true':'false');
    }
  }
  function scheduleRefresh(){
    if(destroyed||refreshPending)return;
    refreshPending=true;
    const run=()=>{refreshPending=false;if(!destroyed)refresh();};
    if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(run);else Promise.resolve().then(run);
  }
  function isFavoriteUiNode(node){
    return node===host||node?.classList?.contains?.('ks-asset-favorite-star')||node?.classList?.contains?.('ks-asset-favorite-chip');
  }
  function mutationNeedsRefresh(record){
    const target=record?.target;
    if(host&&(target===host||host.contains?.(target)))return false;
    const changed=[...Array.from(record?.addedNodes||[]),...Array.from(record?.removedNodes||[])];
    if(changed.length&&changed.every(isFavoriteUiNode))return false;
    return true;
  }
  function onClick(event){
    const star=event.target?.closest?.('[data-favorite-toggle]');if(star){event.preventDefault();event.stopImmediatePropagation?.();toggle(star.dataset.favoriteToggle);return;}
    const chip=event.target?.closest?.('[data-favorite-asset-id]');if(chip){event.preventDefault();event.stopImmediatePropagation?.();paletteApi.choose?.(chip.dataset.favoriteAssetId);}
  }
  document.addEventListener('click',onClick,true);
  if(typeof root.MutationObserver==='function'&&document.body){observer=new root.MutationObserver(records=>{if(Array.from(records||[]).some(mutationNeedsRefresh))scheduleRefresh();});observer.observe(document.body,{childList:true,subtree:true});}
  refresh();
  return Object.freeze({refresh,toggle,destroy(){destroyed=true;observer?.disconnect?.();document.removeEventListener('click',onClick,true);host?.remove();host=null;},get ids(){return ids.slice();}});
}