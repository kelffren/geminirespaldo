/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR PREVIEW THUMBNAIL TILESET PARCEL
 * hace: miniaturas del catálogo; refresca cuando llegan tilesets tarde de assets/
 * online: solo lectura de catálogo/atlas; no muta balances ni placements
 */
(function(){
  'use strict';
  const C=window.KELO_PROPERTY_CATALOG,A=window.KELO_ATLAS_CONTRACT;
  if(!C||!A){console.error('[Kelo property editor extras] property dependencies missing');return;}
  const images=new Map(),pending=new Map();let paintQueued=false;
  function acquire(key){
    if(images.has(key))return Promise.resolve(images.get(key));
    if(pending.has(key))return pending.get(key);
    const finish=img=>{if(img)images.set(key,img);pending.delete(key);queuePaint();return img;};
    const fromSrc=src=>new Promise(resolve=>{if(!src){resolve(null);return;}const img=new Image();img.onload=()=>resolve(finish(img));img.onerror=()=>resolve(finish(null));img.src=src;});
    const p=Promise.resolve(A.acquire(key)).then(img=>finish(img)).catch(()=>fromSrc(A.describe?.(key)?.src));
    pending.set(key,p);return p;
  }
  function drawPreview(canvas,t){
    if(!canvas||!t)return;const g=canvas.getContext('2d');if(!g)return;const W=canvas.width,H=canvas.height;g.clearRect(0,0,W,H);g.imageSmoothingEnabled=false;
    const scale=Math.min((W-8)/Math.max(1,t.width),(H-8)/Math.max(1,t.height),2),ox=(W-t.width*scale)/2,oy=(H-t.height*scale)/2;g.save();g.translate(ox,oy);g.scale(scale,scale);
    for(const part of t.parts){const img=images.get(part.assetKey);if(!img){acquire(part.assetKey);continue;}const old=g.globalAlpha;g.globalAlpha=old*(Number.isFinite(part.opacity)?part.opacity:1);g.drawImage(img,part.source.x,part.source.y,part.source.w,part.source.h,part.offset.x,part.offset.y,part.size.w,part.size.h);g.globalAlpha=old;}g.restore();
  }
  function filteredCatalog(){
    const q=(document.getElementById('pe-q')?.value||'').trim().toLowerCase(),cat=document.getElementById('pe-cat')?.value||'';let list=C.list({category:cat||undefined});if(q)list=list.filter(t=>`${t.label} ${t.id} ${t.family}`.toLowerCase().includes(q));return list;
  }
  function paintCards(){
    paintQueued=false;const list=document.getElementById('pe-list');if(!list)return;const templates=filteredCatalog(),cards=Array.from(list.querySelectorAll('.pe-card'));
    cards.forEach((card,i)=>{const t=templates[i];if(!t)return;card.dataset.asset=t.id;let c=card.querySelector('.pe-thumb');if(!c){c=document.createElement('canvas');c.className='pe-thumb';c.width=120;c.height=64;c.setAttribute('aria-hidden','true');card.prepend(c);}drawPreview(c,t);});
  }
  function queuePaint(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(paintCards);}
  function installUi(){
    const root=document.getElementById('kelo-property-editor'),list=document.getElementById('pe-list'),cat=document.getElementById('pe-cat');
    if(!root||!list)return false;
    if(!document.getElementById('kelo-property-editor-extras-style')){const st=document.createElement('style');st.id='kelo-property-editor-extras-style';st.textContent='.pe-card{min-height:112px!important}.pe-thumb{display:block;width:100%;height:54px;margin:0 0 5px;border-radius:8px;background:rgba(255,255,255,.025);image-rendering:pixelated}@media(max-width:600px){.pe-card{min-height:105px!important}}';document.head.appendChild(st);}
    if(cat&&!cat._keloTilesetDefault){const has=[].some.call(cat.options,o=>o.value==='tileset');if(has){cat.value='tileset';cat._keloTilesetDefault=true;cat.dispatchEvent(new Event('change'));}}
    if(!list._keloPreviewObserver){const o=new MutationObserver(queuePaint);o.observe(list,{childList:true,subtree:true});list._keloPreviewObserver=o;}
    ['pe-q','pe-cat'].forEach(id=>document.getElementById(id)?.addEventListener('input',queuePaint));
    ['pe-q','pe-cat'].forEach(id=>document.getElementById(id)?.addEventListener('change',queuePaint));
    queuePaint();return true;
  }
  C.onRegister(()=>queuePaint());
  const timer=setInterval(()=>{if(installUi()){/* keep refreshing thumbs as sheets load */}},80);
  setTimeout(()=>clearInterval(timer),15000);
  window.KELO_PROPERTY_EDITOR_EXTRAS=Object.freeze({version:'property-editor-extras-v1.2.0',thumbnails:true,lateTilesetRefresh:true,defaultTilesetFilter:true,moveWithoutConsumingUnits:true,moveOwner:'property-editor-core'});
})();
