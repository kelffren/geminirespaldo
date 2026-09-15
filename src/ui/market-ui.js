(function(){
'use strict';
const VERSION='market-ui-v1.1.0-commerce-compat';
let tab='browse',selectedListing=null;
function toast(t){if(typeof showToast==='function')showToast(t);}
function css(){
  if(document.getElementById('kelo-market-v1-style'))return;
  const s=document.createElement('style');s.id='kelo-market-v1-style';s.textContent=`
#kelo-market-v1.km-panel{display:none;position:absolute;top:max(66px,calc(env(safe-area-inset-top) + 58px));left:50%;transform:translateX(-50%);width:min(350px,calc(100vw - 20px));max-height:min(78vh,665px);overflow-y:auto;z-index:134;padding:12px;border:1px solid rgba(231,197,106,.5);border-radius:18px;background:linear-gradient(180deg,rgba(14,26,27,.99),rgba(8,15,18,.995));box-shadow:0 22px 60px rgba(0,0,0,.52);color:#eef2e9;pointer-events:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
#kelo-market-v1 .km-head{display:flex;align-items:center;gap:7px}.km-title{font-size:13px;font-weight:900;letter-spacing:.12em;color:#e7c56a}.km-close{margin-left:auto;width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.04);color:#9da8a3;font-size:22px}
#kelo-market-v1 .km-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0}.km-tab{min-height:42px;border-radius:11px;border:1px solid rgba(231,197,106,.16);background:rgba(255,255,255,.035);color:#9eaaa4;font-size:10px;font-weight:900}.km-tab.active{background:rgba(231,197,106,.12);border-color:rgba(231,197,106,.48);color:#f0db9b}
#kelo-market-v1 .km-note{font-size:9px;color:#81918a;margin-bottom:9px}.kb-market-box{margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(231,197,106,.08);color:#e5d18b;font-size:9px}.kb-market-step{display:flex;align-items:center;gap:8px;margin-top:7px;flex-wrap:wrap}.kb-market-step button{min-width:40px;height:40px;border:1px solid rgba(231,197,106,.32);border-radius:10px;background:rgba(255,255,255,.04);color:#ead892;font-size:16px;font-weight:900}.kb-market-step .kb-market-go{padding:0 12px;font-size:10px;background:rgba(231,197,106,.12);border-color:rgba(231,197,106,.5)}.kb-market-value{min-width:38px;text-align:center;font-size:12px;font-weight:900;color:#fff}.km-list{display:flex;flex-direction:column;gap:7px}.km-card{width:100%;min-height:58px;border:1px solid rgba(184,197,188,.16);border-radius:12px;background:rgba(255,255,255,.035);padding:8px 9px;color:#e8ede8;display:flex;align-items:center;gap:9px;text-align:left}.km-card.selected{border-color:#e7c56a;box-shadow:0 0 0 2px rgba(231,197,106,.12)}.km-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:rgba(0,0,0,.18);font-size:22px;flex:0 0 42px}.km-main{min-width:0;flex:1}.km-name{font-size:11px;font-weight:900;color:#f4efd9}.km-sub{margin-top:3px;font-size:9px;color:#8fa198}.km-price{font-size:9px;font-weight:900;color:#e7c56a;white-space:nowrap}.km-empty{display:grid;place-items:center;min-height:120px;color:#71817a;font-size:10px;text-align:center;padding:20px}.km-detail{margin-top:10px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(0,0,0,.16)}.km-cancel{min-height:40px;padding:0 12px;border-radius:10px;border:1px solid rgba(222,88,88,.45);background:rgba(222,88,88,.07);color:#f0aaaa;font-size:10px;font-weight:900}
`;document.head.appendChild(s);
}
function panel(){css();let r=document.getElementById('kelo-market-v1');if(!r){r=document.createElement('div');r.id='kelo-market-v1';document.body.appendChild(r);}r.className='km-panel';r.setAttribute('role','dialog');r.setAttribute('aria-label','Mercado');return r;}
function escrowItem(instanceId){return window.KeloContainers.getSlots('market_escrow').find(function(s){return s.item&&window.KeloMarketEscrow.itemIdentity(s.item)===String(instanceId);})?.item||null;}
function describe(item,index){if(window.KeloBackpack&&typeof window.KeloBackpack.describeItem==='function')return window.KeloBackpack.describeItem(item,index||0);return{name:item?.name||'Objeto',icon:item?.icon||'▪',quantity:Math.max(1,Number(item?.quantity)||1),rarity:item?.rarity||item?.tier||'Normal',category:item?.kind||'item'};}
function legacyRows(){return Array.isArray(STATE.marketListings)?STATE.marketListings.slice():[];}
function render(){
  const r=panel();
  if(!window.KeloMarketEscrow||!window.KeloContainers){r.innerHTML='<div class="km-empty">Mercado cargando…</div>';return;}
  const mine=window.KeloMarketEscrow.getActiveListings();
  if(selectedListing&&!mine.some(function(x){return x.listingId===selectedListing;}))selectedListing=null;
  r.innerHTML=`<div class="km-head"><div class="km-title">MERCADO</div><button class="km-close" aria-label="Cerrar">×</button></div><div class="km-tabs"><button class="km-tab ${tab==='browse'?'active':''}" data-tab="browse">EXPLORAR</button><button class="km-tab ${tab==='mine'?'active':''}" data-tab="mine">MIS PUBLICACIONES (${mine.length})</button></div><div class="km-note">${tab==='browse'?'Vista legacy de compatibilidad · el Mercado Central nuevo ejecuta compras':'Tus objetos publicados viven físicamente en Escrow hasta cancelar'}</div><div class="km-list"></div><div class="km-detail"></div>`;
  r.querySelector('.km-close').onclick=close;
  r.querySelectorAll('.km-tab').forEach(function(b){b.onclick=function(){tab=b.dataset.tab;selectedListing=null;render();};});
  const list=r.querySelector('.km-list'),detail=r.querySelector('.km-detail');
  if(tab==='browse'){
    const rows=legacyRows();
    if(!rows.length){list.innerHTML='<div class="km-empty">No hay publicaciones legacy.</div>';detail.style.display='none';return;}
    rows.forEach(function(lst){
      const item=lst.item||{name:lst.name,icon:lst.icon,rarity:lst.tier,quantity:1,kind:lst.type};
      const d=describe(item,0),card=document.createElement('div');card.className='km-card';
      card.innerHTML='<div class="km-icon"></div><div class="km-main"><div class="km-name"></div><div class="km-sub"></div></div><div class="km-price"></div>';
      card.querySelector('.km-icon').textContent=d.icon;card.querySelector('.km-name').textContent=d.name;card.querySelector('.km-sub').textContent=(lst.seller||'Mercado')+' · '+d.rarity;card.querySelector('.km-price').textContent=Number.isFinite(Number(lst.price))?String(lst.price)+' Oro':'—';
      list.appendChild(card);
    });
    detail.innerHTML='<div class="km-sub">Usa el acceso Mercado del menú para entrar a la zona comercial completa.</div>';return;
  }
  if(!mine.length){list.innerHTML='<div class="km-empty">Aún no tienes objetos en Escrow.<br>Publícalos desde Mochila.</div>';detail.style.display='none';return;}
  mine.forEach(function(lst){
    const item=escrowItem(lst.escrowItemInstanceId),d=describe(item,0),card=document.createElement('button');card.type='button';card.className='km-card'+(selectedListing===lst.listingId?' selected':'');card.dataset.listing=lst.listingId;
    card.innerHTML='<div class="km-icon"></div><div class="km-main"><div class="km-name"></div><div class="km-sub"></div></div><div class="km-price"></div>';
    card.querySelector('.km-icon').textContent=d.icon;card.querySelector('.km-name').textContent=d.name;card.querySelector('.km-sub').textContent=d.rarity+' · x'+lst.quantity+' · EN ESCROW';card.querySelector('.km-price').textContent=lst.price==null?'LISTADO':String(lst.price)+' Oro';
    card.onclick=function(){selectedListing=selectedListing===lst.listingId?null:lst.listingId;render();};list.appendChild(card);
  });
  const selected=mine.find(function(x){return x.listingId===selectedListing;});
  if(!selected){detail.innerHTML='<div class="km-sub">Selecciona una publicación propia para cancelarla.</div>';return;}
  const item=escrowItem(selected.escrowItemInstanceId),d=describe(item,0);
  detail.innerHTML='<div class="km-name"></div><div class="km-sub"></div><div style="margin-top:9px"><button class="km-cancel">CANCELAR PUBLICACIÓN</button></div>';
  detail.querySelector('.km-name').textContent=d.icon+' '+d.name;detail.querySelector('.km-sub').textContent='x'+selected.quantity+' · identidad '+selected.escrowItemInstanceId;
  detail.querySelector('.km-cancel').onclick=async function(){const out=window.KeloCommerceAuthority?await window.KeloCommerceAuthority.cancelMarketListing(selected.listingId):{ok:false,error:'COMMERCE_AUTHORITY_UNAVAILABLE'};if(out.ok){toast('Publicación cancelada · objeto devuelto a Mochila');selectedListing=null;}else if(out.error==='DESTINATION_FULL')toast('Mochila llena · el objeto sigue seguro en Escrow');else toast('Cancelación rechazada');render();if(window.KeloBackpackUI)window.KeloBackpackUI.render();};
}
function decorateBackpack(){
  if(!window.KeloBackpack||!window.KeloMarketEscrow)return;
  const root=document.getElementById('kelo-bag');if(!root||getComputedStyle(root).display==='none')return;
  const selected=root.querySelector('.kb-slot.selected'),actions=root.querySelector('.kb-detail .kb-actions');if(!selected||!actions)return;
  const index=Math.floor(Number(selected.dataset.slot)),slot=window.KeloBackpack.getSlots()[index];if(!slot||!slot.item)return;
  if(actions.querySelector('.kb-market-publish'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='kb-action primary kb-market-publish';btn.textContent='Publicar';actions.appendChild(btn);
  btn.onclick=function(){
    root.querySelector('.kb-market-box')?.remove();
    const d=slot.descriptor||window.KeloBackpack.describeItem(slot.item,index),max=Math.max(1,Number(d?.quantity)||1);
    let value=max;
    const box=document.createElement('div');box.className='kb-market-box';
    box.innerHTML='<div>Publicar vía Commerce Authority · el objeto saldrá de Mochila.</div><div class="kb-market-step"><button type="button" class="kb-market-minus">−</button><span class="kb-market-value"></span><button type="button" class="kb-market-plus">+</button><button type="button" class="kb-market-go">CONFIRMAR · 150 ORO</button></div>';
    const valueEl=box.querySelector('.kb-market-value'),sync=function(){valueEl.textContent=String(value);};sync();
    box.querySelector('.kb-market-minus').onclick=function(){value=Math.max(1,value-1);sync();};
    box.querySelector('.kb-market-plus').onclick=function(){value=Math.min(max,value+1);sync();};
    box.querySelector('.kb-market-go').onclick=async function(){
      const instanceId=window.KeloMarketEscrow.itemIdentity(slot.item);
      const out=window.KeloCommerceAuthority?await window.KeloCommerceAuthority.createMarketListing(instanceId,value,150,{priceSource:'legacy-market-compat'}):{ok:false,error:'COMMERCE_AUTHORITY_UNAVAILABLE'};
      if(out.ok){toast('Publicado · objeto movido a Escrow');window.KeloBackpackUI?.render();if(window.KeloCommerceUI?.enterMarket)window.KeloCommerceUI.enterMarket();else open();}
      else if(out.error==='EQUIPPED_ITEM_PROTECTED')toast('Desequipa el objeto antes de publicarlo');
      else if(out.error==='INVALID_AMOUNT')toast('Cantidad inválida');
      else toast('Publicación rechazada');
    };
    root.querySelector('.kb-detail')?.appendChild(box);
  };
}
function installBackpackDecorator(){
  decorateBackpack();
  const root=document.getElementById('kelo-bag')||document.body;
  const obs=new MutationObserver(function(){queueMicrotask(decorateBackpack);});
  obs.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
}
function open(){if(window.KeloCommerceUI?.enterMarket)return window.KeloCommerceUI.enterMarket();if(typeof closeMenu==='function')closeMenu();if(window.KeloBackpackUI)window.KeloBackpackUI.close();if(window.KeloWarehouseUI)window.KeloWarehouseUI.close();tab='mine';selectedListing=null;render();panel().style.display='block';}
function close(){const r=document.getElementById('kelo-market-v1');if(r)r.style.display='none';selectedListing=null;}
const previousOpenSocialTool=window.openSocialTool;
if(typeof previousOpenSocialTool==='function')window.openSocialTool=function(tool){if(tool==='market')return open();return previousOpenSocialTool.apply(this,arguments);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installBackpackDecorator);else installBackpackDecorator();
setTimeout(decorateBackpack,300);
window.KeloMarketUI=Object.freeze({version:VERSION,open,close,render,decorateBackpack});
window.KELO_MARKET_UI_AUDIT=Object.freeze({version:VERSION,interaction:'legacy-compat-to-commerce-v1',mobile:true,authorityBoundary:'KeloCommerceAuthority',directEscrowWrites:false,ownListings:true,cancelAction:true,backpackPublishAction:true,publishQuantityStepper:true,newMarketRoute:'KeloCommerceUI/KeloMarketWorld',dragDrop:false});
})();