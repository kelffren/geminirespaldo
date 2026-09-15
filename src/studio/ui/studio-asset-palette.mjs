/* KELO-INDEX
 * area: STUDIO / ASSET PALETTE
 * owns: compact searchable floating asset browser, category folders and Forest Plaza visual grouping
 * does-not-own: placement semantics, asset catalog, authority or world mutations
 * public-api: createStudioAssetPalette(), filterAssetPaletteRows(), assetPaletteCategories(), forestPlazaFolderChoices(), sanitizeRecentAssetIds()
 * online: no; selecting delegates to existing Studio placement flow; recent choices persist locally only
 */

const STYLE_ID='kelo-studio-asset-palette-style';
const RECENT_STORAGE_KEY='kelo.studio.assetPalette.recent.v1';
const MAX_RECENT=10;
const MAX_VISIBLE=72;
const copyRows=rows=>(Array.isArray(rows)?rows:[]).filter(Boolean);
const text=value=>String(value??'').trim();

export const FOREST_PLAZA_FOLDERS=Object.freeze([
  Object.freeze({id:'plaza_core',label:'Plaza',icon:'✦'}),
  Object.freeze({id:'architecture',label:'Arquitectura',icon:'▦'}),
  Object.freeze({id:'garden_decor',label:'Jardines',icon:'✿'}),
  Object.freeze({id:'water_features',label:'Agua',icon:'≋'}),
  Object.freeze({id:'terrain_paths',label:'Caminos',icon:'⌁'}),
  Object.freeze({id:'market_props',label:'Mercado',icon:'▣'}),
  Object.freeze({id:'nature_trees_rocks',label:'Bosque',icon:'♧'})
]);

const CATEGORY_LABELS=Object.freeze(Object.fromEntries(FOREST_PLAZA_FOLDERS.map(folder=>[folder.id,folder.label])));
const rowCategory=row=>text(row?.category||row?.group||'general').toLowerCase()||'general';
const categoryLabel=id=>CATEGORY_LABELS[id]||text(id||'general').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export function sanitizeRecentAssetIds(ids=[],limit=MAX_RECENT){
  const out=[],seen=new Set();
  for(const raw of Array.isArray(ids)?ids:[]){
    const id=text(raw);
    if(!id||seen.has(id))continue;
    seen.add(id);out.push(id);
    if(out.length>=Math.max(1,Number(limit)||MAX_RECENT))break;
  }
  return out;
}

export function assetPaletteCategories(rows=[],limit=7){
  const counts=new Map();
  for(const row of copyRows(rows)){
    const category=rowCategory(row);
    counts.set(category,(counts.get(category)||0)+1);
  }
  return [...counts.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,Math.max(1,Number(limit)||7))
    .map(([id,count])=>({id,count}));
}

export function forestPlazaFolderChoices(rows=[]){
  const counts=new Map();
  for(const row of copyRows(rows)){
    const category=rowCategory(row);
    counts.set(category,(counts.get(category)||0)+1);
  }
  return FOREST_PLAZA_FOLDERS
    .map(folder=>({...folder,count:counts.get(folder.id)||0}))
    .filter(folder=>folder.count>0);
}

export function filterAssetPaletteRows(rows=[],{query='',category='all',recentIds=[],limit=MAX_VISIBLE}={}){
  const q=text(query).toLowerCase();
  const cat=text(category).toLowerCase()||'all';
  const recent=new Map(sanitizeRecentAssetIds(recentIds,MAX_RECENT).map((id,index)=>[id,index]));
  let out=copyRows(rows).filter(row=>{
    const id=String(row.id||'');
    const categoryId=rowCategory(row);
    if(cat==='recent'&&!recent.has(id))return false;
    if(cat!=='all'&&cat!=='recent'&&categoryId!==cat)return false;
    if(!q)return true;
    return `${row.label||''} ${row.name||''} ${id} ${categoryId} ${categoryLabel(categoryId)}`.toLowerCase().includes(q);
  });
  if(cat==='recent')out.sort((a,b)=>(recent.get(String(a.id))??999)-(recent.get(String(b.id))??999));
  return out.slice(0,Math.max(1,Number(limit)||MAX_VISIBLE));
}

function loadRecentIds(root){
  try{return sanitizeRecentAssetIds(JSON.parse(root?.localStorage?.getItem?.(RECENT_STORAGE_KEY)||'[]'));}catch{return [];}
}
function persistRecentIds(root,ids){
  try{root?.localStorage?.setItem?.(RECENT_STORAGE_KEY,JSON.stringify(sanitizeRecentAssetIds(ids)));return true;}catch{return false;}
}

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-asset-palette-toggle{display:none!important}
    #kelo-studio-live .ks-asset-palette{
      position:fixed;left:50%;bottom:max(90px,calc(env(safe-area-inset-bottom) + 78px));transform:translateX(-50%);
      z-index:326;width:min(680px,calc(100vw - 24px));max-height:min(62vh,560px);display:none;overflow:hidden;
      border:1px solid rgba(231,197,106,.42);border-radius:18px;background:rgba(6,16,18,.975);
      box-shadow:0 20px 70px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.035);
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);pointer-events:auto
    }
    #kelo-studio-live .ks-asset-palette.on{display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto}
    #kelo-studio-live .ks-asset-palette-head{display:flex;align-items:center;gap:8px;padding:9px 10px 7px}
    #kelo-studio-live .ks-asset-palette-head strong{font-family:Georgia,"Times New Roman",serif;color:#f0d77d;font-size:10px;letter-spacing:.09em}
    #kelo-studio-live .ks-asset-palette-count{font-size:6px;color:#809b90;margin-left:2px}
    #kelo-studio-live .ks-asset-palette-spacer{flex:1}
    #kelo-studio-live .ks-asset-palette-close{width:34px;height:32px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0f1b1d;color:#dfe8e3;font-size:16px;padding:0}
    #kelo-studio-live .ks-asset-palette-search-wrap{padding:0 9px 7px}
    #kelo-studio-live .ks-asset-palette-search{width:100%;height:39px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:#0d181a;color:#f5f8f6;padding:0 12px;font-size:9px;outline:none}
    #kelo-studio-live .ks-asset-palette-search:focus{border-color:rgba(231,197,106,.55);box-shadow:0 0 0 2px rgba(231,197,106,.07)}
    #kelo-studio-live .ks-asset-palette-cats{display:flex;gap:5px;overflow-x:auto;padding:0 9px 8px;scrollbar-width:none}
    #kelo-studio-live .ks-asset-palette-cats::-webkit-scrollbar{display:none}
    #kelo-studio-live .ks-asset-palette-cat{
      flex:0 0 auto;height:31px;border:1px solid rgba(255,255,255,.07);border-radius:999px;
      background:#0e1a1c;color:#95aaa1;padding:0 10px;font-size:6px;font-weight:900;text-transform:uppercase;letter-spacing:.05em
    }
    #kelo-studio-live .ks-asset-palette-cat[data-forest-folder="1"]{
      border-radius:10px;border-color:rgba(94,142,113,.34);background:linear-gradient(180deg,#10231e,#0c1918);color:#c7ddd2;
      min-width:82px;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)
    }
    #kelo-studio-live .ks-asset-palette-cat[data-forest-folder="1"]::before{content:"▱";margin-right:5px;color:#dfc76f}
    #kelo-studio-live .ks-asset-palette-cat.on{border-color:rgba(231,197,106,.62);background:#1b342d;color:#f4dfa0}
    #kelo-studio-live .ks-asset-palette-grid{overflow:auto;padding:1px 9px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:start}
    #kelo-studio-live .ks-asset-palette-item{min-width:0;height:104px;border:1px solid rgba(255,255,255,.065);border-radius:12px;background:rgba(12,24,25,.9);color:#e8efeb;padding:6px;display:grid;grid-template-rows:64px auto;gap:4px;text-align:left}
    #kelo-studio-live .ks-asset-palette-item:hover,#kelo-studio-live .ks-asset-palette-item:focus-visible{border-color:rgba(231,197,106,.46);background:#152923;outline:none}
    #kelo-studio-live .ks-asset-palette-item canvas{width:64px;height:64px;max-width:100%;justify-self:center;border-radius:9px;background:linear-gradient(145deg,#111e20,#091113);image-rendering:pixelated}
    #kelo-studio-live .ks-asset-palette-copy{min-width:0;line-height:1.1}
    #kelo-studio-live .ks-asset-palette-copy strong{display:block;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #kelo-studio-live .ks-asset-palette-copy small{display:block;margin-top:3px;color:#769087;font-size:5.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
    #kelo-studio-live .ks-asset-palette-empty{grid-column:1/-1;padding:28px 10px;text-align:center;color:#789087;font-size:8px;line-height:1.6}
    #kelo-studio-live .ks-asset-palette-foot{padding:6px 9px;border-top:1px solid rgba(255,255,255,.055);font-size:6px;color:#708a80;display:flex;align-items:center;gap:8px}
    #kelo-studio-live .ks-asset-palette-foot span:first-child{flex:1}
    #kelo-studio-live .ks-asset-palette-library{height:31px;border:1px solid rgba(231,197,106,.22);border-radius:9px;background:#101d1f;color:#d8e3de;font-size:6px;font-weight:900;padding:0 9px;white-space:nowrap}
    @media(max-width:760px){
      #kelo-studio-live .ks-asset-palette{left:8px;right:8px;width:auto;transform:none;bottom:max(78px,calc(env(safe-area-inset-bottom) + 70px));max-height:min(58vh,480px);border-radius:16px}
      #kelo-studio-live .ks-asset-palette-head{padding:8px 9px 6px}
      #kelo-studio-live .ks-asset-palette-search{height:42px;font-size:10px}
      #kelo-studio-live .ks-asset-palette-cat{height:34px;font-size:6.2px}
      #kelo-studio-live .ks-asset-palette-cat[data-forest-folder="1"]{min-width:86px}
      #kelo-studio-live .ks-asset-palette-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:1px 7px 8px}
      #kelo-studio-live .ks-asset-palette-item{height:98px;padding:5px;grid-template-rows:60px auto}
      #kelo-studio-live .ks-asset-palette-item canvas{width:60px;height:60px}
    }
    @media(max-width:370px){#kelo-studio-live .ks-asset-palette-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

export function createStudioAssetPalette({root=globalThis,getAssets=()=>[],onSelect=null,renderAssetPreview=()=>{}}={}){
  const document=root?.document;
  if(!document)return Object.freeze({attach:()=>false,open(){},close(){},toggle(){},refresh(){},destroy(){}});
  ensureStyle(document);

  let shell=null,palette=null,toggleButton=null,observer=null,destroyed=false,opened=false,query='',category='all',bypassLegacy=false;
  const recentIds=loadRecentIds(root);
  const allRows=()=>copyRows(getAssets?.()).filter(row=>row?.id!=null);
  const isMobile=()=>typeof root.matchMedia==='function'?root.matchMedia('(max-width:760px)').matches:Number(root.innerWidth||0)<=760;

  function remember(id){
    const next=sanitizeRecentAssetIds([String(id),...recentIds]);
    recentIds.splice(0,recentIds.length,...next);persistRecentIds(root,recentIds);
  }
  function dispatchInput(input){
    const EventCtor=root.Event||globalThis.Event;
    input?.dispatchEvent?.(new EventCtor('input',{bubbles:true}));
  }
  function selectThroughShell(id){
    if(!shell)return false;
    const search=shell.querySelector('.ks-asset-search')||shell.querySelector('.ks-asset-search-mobile');
    if(!search)return false;
    const previous=search.value;
    search.value=String(id);dispatchInput(search);
    const target=[...shell.querySelectorAll('[data-asset]')].find(node=>String(node.dataset.asset)===String(id))||null;
    if(target)target.click();
    search.value=previous;dispatchInput(search);
    return !!target;
  }
  function choose(id){
    remember(id);close();
    const result=typeof onSelect==='function'?onSelect(id):selectThroughShell(id);
    if(result===false&&typeof root.showToast==='function')root.showToast('No pude abrir ese asset en el catálogo actual');
    return result;
  }
  function openLegacyLibrary(){
    close();
    if(!shell)return false;
    if(!isMobile()){shell.classList.add('ks-clean-show-assets');shell.classList.remove('ks-clean-show-inspector');return true;}
    const legacy=[...shell.querySelectorAll('[data-act="edit-assets"]')].find(node=>!node.closest('.ks-asset-palette'))||null;
    if(!legacy)return false;
    bypassLegacy=true;legacy.click();return true;
  }
  function build(){
    palette=document.createElement('section');
    palette.className='ks-asset-palette';
    palette.dataset.keloStudioUi='1';
    palette.setAttribute('aria-label','Paleta de assets');
    palette.innerHTML=`
      <div class="ks-asset-palette-head"><strong>ASSETS</strong><span class="ks-asset-palette-count"></span><span class="ks-asset-palette-spacer"></span><button type="button" class="ks-asset-palette-close" data-asset-palette-close aria-label="Cerrar Assets">×</button></div>
      <div class="ks-asset-palette-search-wrap"><input class="ks-asset-palette-search" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar árbol, camino, fuente…"></div>
      <div class="ks-asset-palette-cats" aria-label="Carpetas de assets"></div>
      <div class="ks-asset-palette-grid"></div>
      <div class="ks-asset-palette-foot"><span>TOCA UN ASSET → COLOCAR</span><button type="button" class="ks-asset-palette-library" data-asset-palette-library>BIBLIOTECA COMPLETA</button></div>`;
    shell.appendChild(palette);
    const search=palette.querySelector('.ks-asset-palette-search');
    search.addEventListener('input',()=>{query=search.value;render();});
    palette.addEventListener('click',event=>{
      if(event.target.closest('[data-asset-palette-close]')){event.preventDefault();close();return;}
      if(event.target.closest('[data-asset-palette-library]')){event.preventDefault();openLegacyLibrary();return;}
      const cat=event.target.closest('[data-asset-palette-category]');
      if(cat){event.preventDefault();category=cat.dataset.assetPaletteCategory||'all';render();return;}
      const item=event.target.closest('[data-asset-palette-id]');
      if(item){event.preventDefault();event.stopPropagation();choose(item.dataset.assetPaletteId);}
    });
    palette.addEventListener('pointerdown',event=>event.stopPropagation());
  }
  function installToggle(){
    toggleButton=document.createElement('button');
    toggleButton.type='button';
    toggleButton.className='ks-asset-palette-toggle';
    toggleButton.dataset.studioAssetPaletteToggle='1';
    toggleButton.dataset.keloStudioUi='1';
    toggleButton.setAttribute('aria-hidden','true');
    toggleButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggle();});
    shell.appendChild(toggleButton);
  }
  function attach(){
    if(destroyed)return false;
    const next=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
    if(!next)return false;
    if(shell===next&&palette?.isConnected&&toggleButton?.isConnected)return true;
    palette?.remove();toggleButton?.remove();shell=next;build();installToggle();render();return true;
  }
  function render(){
    if(!palette)return;
    const rows=allRows();
    const available=new Set(rows.map(rowCategory));
    const forest=forestPlazaFolderChoices(rows);
    const generic=assetPaletteCategories(rows,7).filter(item=>!CATEGORY_LABELS[item.id]);
    if(category!=='all'&&category!=='recent'&&!available.has(category))category='all';
    const filtered=filterAssetPaletteRows(rows,{query,category,recentIds,limit:MAX_VISIBLE});

    const count=palette.querySelector('.ks-asset-palette-count');
    if(count)count.textContent=`${filtered.length}${filtered.length<rows.length?' visibles':''}`;

    const choices=[
      {id:'all',label:'Todos',count:rows.length},
      ...(recentIds.length?[{id:'recent',label:'Recientes',count:recentIds.length}]:[]),
      ...forest,
      ...generic.map(item=>({...item,label:categoryLabel(item.id)}))
    ];

    const catHost=palette.querySelector('.ks-asset-palette-cats');
    catHost.replaceChildren();
    for(const row of choices){
      const b=document.createElement('button');
      b.type='button';
      b.className='ks-asset-palette-cat'+(row.id===category?' on':'');
      b.dataset.assetPaletteCategory=row.id;
      if(CATEGORY_LABELS[row.id])b.dataset.forestFolder='1';
      b.title=CATEGORY_LABELS[row.id]?`Carpeta ${row.label}`:`Categoría ${row.label}`;
      b.textContent=`${row.icon?`${row.icon} `:''}${row.label} ${row.count}`;
      catHost.appendChild(b);
    }

    const grid=palette.querySelector('.ks-asset-palette-grid');
    grid.replaceChildren();
    if(!filtered.length){
      const empty=document.createElement('div');
      empty.className='ks-asset-palette-empty';
      empty.textContent='No encontré assets con ese filtro.';
      grid.appendChild(empty);
      return;
    }
    for(const asset of filtered){
      const b=document.createElement('button');
      b.type='button';
      b.className='ks-asset-palette-item';
      b.dataset.assetPaletteId=String(asset.id);
      const canvas=document.createElement('canvas');
      canvas.width=64;canvas.height=64;canvas.setAttribute('aria-hidden','true');
      const copy=document.createElement('span');
      copy.className='ks-asset-palette-copy';
      const strong=document.createElement('strong');
      strong.textContent=asset.label||asset.name||asset.id;
      const small=document.createElement('small');
      small.textContent=categoryLabel(rowCategory(asset));
      copy.append(strong,small);b.append(canvas,copy);grid.appendChild(b);
      Promise.resolve(renderAssetPreview?.(canvas,asset)).catch(()=>{});
    }
  }
  function open(){
    attach();if(!palette)return false;opened=true;
    shell?.classList?.remove('ks-clean-show-assets','ks-clean-show-inspector');
    if(shell?.dataset)shell.dataset.sheetOpen='0';
    shell?.querySelectorAll?.('.ks-clean-popover,.ks-clean-trigger')?.forEach?.(node=>node.classList.remove('on'));
    palette.classList.add('on');palette.setAttribute('aria-hidden','false');render();
    root.requestAnimationFrame?.(()=>palette?.querySelector('.ks-asset-palette-search')?.focus?.());
    return true;
  }
  function close(){opened=false;palette?.classList.remove('on');palette?.setAttribute('aria-hidden','true');return false;}
  function toggle(){return opened?close():open();}
  function onKey(event){if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();close();}}
  function onPointer(event){if(!opened||event.target?.closest?.('.ks-asset-palette,[data-studio-asset-palette-toggle]'))return;close();}
  function onWindowClick(event){
    const opener=event.target?.closest?.('[data-clean-action="assets"],[data-act="edit-assets"]');
    if(!opener||opener.closest?.('.ks-asset-palette'))return;
    if(bypassLegacy){bypassLegacy=false;return;}
    event.preventDefault?.();event.stopImmediatePropagation?.();toggle();
  }

  document.addEventListener('keydown',onKey,true);
  document.addEventListener('pointerdown',onPointer,true);
  root.addEventListener?.('click',onWindowClick,true);
  attach();
  if(typeof root.MutationObserver==='function'&&document.body){
    observer=new root.MutationObserver(()=>{if(!destroyed)attach();});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  return Object.freeze({
    attach,open,close,toggle,refresh:render,choose,
    destroy(){
      destroyed=true;observer?.disconnect?.();
      document.removeEventListener('keydown',onKey,true);
      document.removeEventListener('pointerdown',onPointer,true);
      root.removeEventListener?.('click',onWindowClick,true);
      palette?.remove();toggleButton?.remove();palette=null;toggleButton=null;shell=null;
    },
    get openState(){return opened;},
    get category(){return category;},
    get query(){return query;},
    get recent(){return recentIds.slice();}
  });
}
