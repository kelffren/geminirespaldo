/* KELO-INDEX
 * area: UI / COMMERCE
 * owner: KeloCommerceUI
 * keys: MARKET STALL TRADE REQUEST ACCEPT REJECT DOUBLE CONFIRMATION OFFLINE MOBILE UI
 * purpose: interfaz única de mercado, puestos y trade; solo envía intenciones a KeloCommerceAuthority
 * public-api: KeloCommerceUI.enterMarket/openMarket/openStall/openTrade/openTradeWithPlayer/close
 * consumes: KeloCommerceAuthority, KeloMarketWorld, KeloContainers, KeloBackpack, KeloInputLocks
 * state-owned: vista/modal seleccionada y timer visual de expiración; NO posee items, oro, listings ni sesiones
 * online: consume exclusivamente snapshots server-authoritative para oro/items/trade y usa el mismo flujo visual que offline
 * do-not: no mutar STATE.inventory/STATE.gold ni contenedores directamente
 */
(function(root){
'use strict';
const VERSION='commerce-ui-v1.0.0';
const C=root.KeloCommerceAuthority;
if(!C){console.error('[Kelo commerce UI] authority unavailable');return;}
let modalLock=null;
let view={type:null,id:null};
let busy=false;
let requestExpiryTimer=null;

function toast(msg){if(typeof showToast==='function')showToast(msg);}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function isServer(){return C.getMode?.()==='server-authoritative';}
function snap(){return C.snapshot()||{};}
function myId(){return String(snap()?.player?.id||'local_pioneer');}
function clearExpiryTimer(){if(requestExpiryTimer){clearTimeout(requestExpiryTimer);requestExpiryTimer=null;}}
function armRequestExpiry(t){
  clearExpiryTimer();
  if(!isServer()||t?.status!=='REQUESTED'||!Number.isFinite(Number(t.expiresAt)))return;
  const delay=Math.max(80,Math.min(31000,Number(t.expiresAt)-Date.now()+120));
  requestExpiryTimer=setTimeout(async()=>{requestExpiryTimer=null;await refreshServerSnapshot();if(view.type==='trade')renderTrade();},delay);
}

function css(){
  if(document.getElementById('kelo-commerce-ui-style'))return;
  const s=document.createElement('style');s.id='kelo-commerce-ui-style';s.textContent=`
#kelo-commerce-dock{display:none;position:absolute;left:50%;bottom:max(12px,calc(env(safe-area-inset-bottom) + 8px));transform:translateX(-50%);z-index:146;pointer-events:auto;align-items:center;gap:6px;padding:7px;border:1px solid rgba(231,197,106,.34);border-radius:17px;background:rgba(6,13,15,.93);box-shadow:0 14px 40px rgba(0,0,0,.42);backdrop-filter:blur(12px)}
#kelo-commerce-dock.show{display:flex}#kelo-commerce-dock button{min-height:42px;padding:0 11px;border:1px solid rgba(231,197,106,.18);border-radius:11px;background:rgba(255,255,255,.035);color:#d8e3de;font:850 9px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.03em}#kelo-commerce-dock button.primary{border-color:rgba(231,197,106,.5);background:rgba(231,197,106,.12);color:#f1db9a}#kelo-commerce-dock button.exit{color:#e8aaaa;border-color:rgba(218,93,93,.3)}
#kelo-commerce-modal{display:none;position:absolute;inset:0;z-index:180;pointer-events:auto;background:rgba(1,5,7,.62);backdrop-filter:blur(5px);padding:max(54px,calc(env(safe-area-inset-top) + 44px)) 10px max(78px,calc(env(safe-area-inset-bottom) + 68px));align-items:flex-start;justify-content:center;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#kelo-commerce-modal.open{display:flex}.kc-shell{width:min(760px,100%);max-height:min(78vh,760px);overflow:auto;border:1px solid rgba(231,197,106,.42);border-radius:22px;background:linear-gradient(180deg,rgba(14,27,27,.99),rgba(6,13,16,.995));box-shadow:0 28px 80px rgba(0,0,0,.6);color:#edf3ee;padding:13px}.kc-head{display:flex;align-items:center;gap:8px;position:sticky;top:-13px;z-index:4;padding:10px 2px 11px;background:linear-gradient(180deg,#0e1b1b 82%,rgba(14,27,27,0))}.kc-kicker{font:900 9px/1 -apple-system,sans-serif;color:#8fa49b;letter-spacing:.14em}.kc-title{margin-top:4px;font:900 17px/1.05 Georgia,serif;color:#eed487}.kc-close{margin-left:auto;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#aebcb6;font-size:22px}.kc-sub{font:650 10px/1.45 -apple-system,sans-serif;color:#8fa29a}.kc-status{margin:8px 0;padding:9px 10px;border:1px solid rgba(231,197,106,.18);border-radius:11px;background:rgba(231,197,106,.06);font:800 10px -apple-system,sans-serif;color:#ddca87}.kc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kc-card{border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);padding:10px}.kc-card.gold{border-color:rgba(231,197,106,.28);background:rgba(231,197,106,.055)}.kc-card h3{margin:0 0 7px;font:900 11px -apple-system,sans-serif;color:#f0dfab}.kc-row{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid rgba(255,255,255,.055)}.kc-row:first-child{border-top:0}.kc-icon{width:38px;height:38px;flex:0 0 38px;border-radius:10px;display:grid;place-items:center;background:rgba(0,0,0,.2);font-size:20px}.kc-main{min-width:0;flex:1}.kc-name{font:850 10px -apple-system,sans-serif;color:#eef3ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-meta{margin-top:3px;font:650 8px -apple-system,sans-serif;color:#7f948b}.kc-price{font:900 9px -apple-system,sans-serif;color:#e7c56a;white-space:nowrap}.kc-btn{min-height:38px;padding:0 11px;border:1px solid rgba(231,197,106,.25);border-radius:10px;background:rgba(231,197,106,.08);color:#e8d48f;font:900 9px -apple-system,sans-serif}.kc-btn.primary{background:linear-gradient(180deg,rgba(231,197,106,.23),rgba(170,132,40,.17));border-color:rgba(231,197,106,.55);color:#f6e4aa}.kc-btn.good{border-color:rgba(81,190,132,.42);background:rgba(81,190,132,.09);color:#9de0ba}.kc-btn.danger{border-color:rgba(220,92,92,.42);background:rgba(220,92,92,.07);color:#efb0b0}.kc-btn:disabled{opacity:.38}.kc-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.kc-input{width:100%;height:40px;border:1px solid rgba(231,197,106,.2);border-radius:10px;background:#091315;color:#edf3ee;padding:0 10px;font:750 10px -apple-system,sans-serif;outline:none}.kc-input:focus{border-color:rgba(231,197,106,.6)}.kc-form{display:grid;grid-template-columns:1fr 92px auto;gap:7px;align-items:center}.kc-empty{min-height:85px;display:grid;place-items:center;text-align:center;color:#6f837b;font:700 10px -apple-system,sans-serif;padding:15px}.kc-sep{height:1px;background:rgba(255,255,255,.06);margin:10px 0}.kc-trade-cols{display:grid;grid-template-columns:1fr 1fr;gap:9px}.kc-ready{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.08);font:850 8px -apple-system,sans-serif;color:#869890}.kc-ready.on{color:#9fe0ba;border-color:rgba(81,190,132,.34);background:rgba(81,190,132,.07)}.kc-final{margin-top:10px;padding:11px;border-radius:14px;border:1px solid rgba(231,197,106,.35);background:rgba(231,197,106,.07)}.kc-final strong{color:#f2d98e}.kc-mini{font:700 8px/1.35 -apple-system,sans-serif;color:#74877f}.kc-badge{display:inline-block;padding:4px 7px;border-radius:999px;background:rgba(231,197,106,.08);color:#dfca88;font:900 8px -apple-system,sans-serif}.kc-stack{display:flex;flex-direction:column;gap:8px}.kc-request{padding:15px;border:1px solid rgba(231,197,106,.32);border-radius:16px;background:linear-gradient(180deg,rgba(231,197,106,.075),rgba(255,255,255,.018))}.kc-request-name{font:900 20px Georgia,serif;color:#f3d98d}.kc-distance{white-space:nowrap;color:#82978e;font:750 8px -apple-system,sans-serif}
@media(max-width:620px){#kelo-commerce-dock{max-width:calc(100vw - 14px);overflow-x:auto}#kelo-commerce-dock button{padding:0 9px;white-space:nowrap}.kc-grid,.kc-trade-cols{grid-template-columns:1fr}.kc-form{grid-template-columns:1fr 76px}.kc-form .kc-btn{grid-column:1/-1}.kc-shell{border-radius:18px;padding:11px}}
`;document.head.appendChild(s);
}

function dock(){
  css();let d=document.getElementById('kelo-commerce-dock');if(d)return d;
  d=document.createElement('div');d.id='kelo-commerce-dock';
  d.innerHTML='<button type="button" class="primary" data-kc="market">MERCADO</button><button type="button" data-kc="stall">MI PUESTO</button><button type="button" data-kc="trade">TRADE DEMO</button><button type="button" class="exit" data-kc="exit">SALIR</button>';
  document.body.appendChild(d);
  d.addEventListener('click',e=>{const b=e.target.closest('button[data-kc]');if(!b)return;const a=b.dataset.kc;if(a==='market')openMarket();if(a==='stall')openOwnStall();if(a==='trade')openTrade();if(a==='exit')leaveMarket();});
  return d;
}
function modal(){css();let m=document.getElementById('kelo-commerce-modal');if(m)return m;m=document.createElement('div');m.id='kelo-commerce-modal';m.innerHTML='<div class="kc-shell"></div>';m.addEventListener('pointerdown',e=>{if(e.target===m)close();});document.body.appendChild(m);return m;}
function acquireLock(){if(modalLock||!root.KeloInputLocks?.acquire)return;modalLock=root.KeloInputLocks.acquire('commerce-ui',{view:view.type});}
function releaseLock(){if(modalLock&&root.KeloInputLocks?.release)root.KeloInputLocks.release(modalLock);else root.KeloInputLocks?.releaseOwner?.('commerce-ui');modalLock=null;}
function shell(title,kicker){const m=modal(),s=m.querySelector('.kc-shell');s.innerHTML=`<div class="kc-head"><div><div class="kc-kicker">${escapeHtml(kicker||'KELO COMMERCE')}</div><div class="kc-title">${escapeHtml(title||'Mercado')}</div></div><button type="button" class="kc-close" aria-label="Cerrar">×</button></div><div class="kc-body"></div>`;s.querySelector('.kc-close').onclick=close;m.classList.add('open');acquireLock();return s.querySelector('.kc-body');}
function close(){clearExpiryTimer();const m=document.getElementById('kelo-commerce-modal');if(m)m.classList.remove('open');releaseLock();view={type:null,id:null};}

function ownClaim(){const me=myId();return (snap()?.stalls||[]).find(x=>x&&!x.demo&&(String(x.ownerId)===me||String(x.ownerId)==='local_pioneer'))||null;}
function itemDesc(item,index){try{return root.KeloBackpack?.describeItem?.(item,index||0)||{name:item?.name||'Objeto',icon:item?.icon||'▪',rarity:item?.rarity||item?.tier||'Normal',quantity:Math.max(1,Number(item?.quantity)||1)};}catch(_){return{name:item?.name||'Objeto',icon:item?.icon||'▪',rarity:item?.rarity||'Normal',quantity:Math.max(1,Number(item?.quantity)||1)};}}
function itemIdentity(item){return root.KeloMarketEscrow?.itemIdentity?.(item)||String(item?.id||item?.uid||item?._backpackId||item?.instanceId||'');}
function rowHtml(item,extra){const d=itemDesc(item,0);return `<div class="kc-row"><div class="kc-icon">${escapeHtml(d.icon)}</div><div class="kc-main"><div class="kc-name">${escapeHtml(d.name)}</div><div class="kc-meta">${escapeHtml(d.rarity)} · x${Math.max(1,Number(d.quantity)||1)}</div></div>${extra||''}</div>`;}
function localBackpackItems(){return (root.KeloContainers?.getSlots?.('backpack')||[]).filter(s=>s.item).map(s=>s.item);}
function commerceBackpackItems(){return isServer()?((snap()?.player?.items||[]).filter(Boolean)):localBackpackItems();}
async function refreshServerSnapshot(){if(isServer())return C.request('snapshot',{});return{ok:true,snapshot:snap()};}
function listingsForStall(stallId){return (snap()?.marketListings||[]).filter(x=>x&&x.status!=='sold'&&String(x.stallId||'')===String(stallId||''));}
function errorText(error){return({
  INSUFFICIENT_GOLD:'No tienes suficiente oro',DESTINATION_FULL:'Tu mochila no tiene espacio',STALL_OCCUPIED:'Ese puesto ya está ocupado',STALL_NOT_OWNED:'Ese puesto no es tuyo',ITEM_NOT_FOUND:'El objeto ya no está disponible',EQUIPPED_ITEM_PROTECTED:'Desequipa ese objeto primero',BOUND_ITEM_NOT_TRADABLE:'Ese objeto está vinculado y no se puede intercambiar',TRADE_ALREADY_ACTIVE:'Ya tienes un trade abierto',BOTH_NOT_READY:'Ambos deben marcar Listo primero',PLAYER_NOT_ONLINE:'Ese jugador ya no está conectado',PEER_TRADE_BUSY:'Ese jugador ya está en otro trade',PLAYERS_NOT_IN_TRADE_RANGE:'Acércate más al jugador para tradear',TRADE_NOT_ACCEPTED:'El otro jugador todavía no aceptó el trade',TRADE_REQUEST_NOT_PENDING:'La solicitud ya no está pendiente',TRADE_REQUEST_TARGET_REQUIRED:'Solo quien recibe la solicitud puede responder',TRADE_NOT_FOUND:'Ese trade ya no está activo',INVALID_TRADE_PEER:'Jugador no válido para trade'
}[error]||String(error||'Operación rechazada'));}

async function enterMarket(){if(busy)return;busy=true;try{if(typeof closeMenu==='function')closeMenu();root.KeloMarketUI?.close?.();await refreshServerSnapshot();await root.KeloMarketWorld?.enter?.();syncDock();toast('Entraste al Mercado Central');}catch(err){toast(String(err?.message||err)==='LEAVE_CURRENT_INSTANCE_FIRST'?'Sal de la instancia actual antes de viajar al mercado':'No se pudo entrar al mercado');}finally{busy=false;}}
async function leaveMarket(){if(busy)return;busy=true;try{close();await root.KeloMarketWorld?.leave?.();syncDock();toast('Saliste del Mercado Central');}catch(_){toast('No se pudo salir del mercado');}finally{busy=false;}}
function syncDock(){const d=dock(),active=!!root.KeloMarketWorld?.isActive?.();d.classList.toggle('show',active);const trade=d.querySelector('[data-kc="trade"]');if(trade)trade.textContent=isServer()?'TRADE':'TRADE DEMO';}

function listingCard(lst){const item=lst.item||{},d=itemDesc(item,0),own=String(lst.ownerId||'')===myId()||(!lst.demo&&String(lst.ownerId||'')==='local_pioneer');return `<div class="kc-row"><div class="kc-icon">${escapeHtml(d.icon)}</div><div class="kc-main"><div class="kc-name">${escapeHtml(d.name)}</div><div class="kc-meta">${escapeHtml(lst.sellerName||lst.seller||'Mercader')} · ${escapeHtml(d.rarity)} · x${Math.max(1,Number(lst.quantity)||1)}</div></div><div class="kc-price">${Math.max(0,Number(lst.price)||0)} Oro</div><button class="kc-btn ${own?'danger':'primary'}" data-listing-action="${own?'cancel':'buy'}" data-listing-id="${escapeHtml(lst.listingId)}">${own?'CANCELAR':'COMPRAR'}</button></div>`;}
function bindListingActions(body,rerender){body.querySelectorAll('[data-listing-action]').forEach(btn=>btn.onclick=async()=>{if(busy)return;busy=true;try{const action=btn.dataset.listingAction,id=btn.dataset.listingId,r=action==='buy'?await C.buyListing(id):await C.cancelMarketListing(id);if(r?.ok)toast(action==='buy'?'Compra completada':'Publicación cancelada');else toast(errorText(r?.error));rerender();}finally{busy=false;}});}
async function openMarket(){view={type:'market',id:null};await refreshServerSnapshot();renderMarket();}
function renderMarket(){
  if(view.type!=='market')return;const body=shell('Mercado Central',isServer()?'COMERCIO · SERVIDOR AUTORITATIVO':'COMERCIO OFFLINE · ONLINE READY'),rows=(snap()?.marketListings||[]).filter(x=>x&&x.status!=='sold');
  body.innerHTML=`<div class="kc-status">Oro disponible: ${Math.max(0,Number(snap()?.player?.gold)||0)} · ${escapeHtml(C.getMode?.()||'local')}</div><div class="kc-card"><h3>PUBLICACIONES ACTIVAS</h3><div class="kc-list">${rows.length?rows.map(listingCard).join(''):'<div class="kc-empty">No hay publicaciones activas.</div>'}</div></div><div class="kc-actions"><button class="kc-btn" data-open-own>Ir a mi puesto</button><button class="kc-btn" data-open-trade>${isServer()?'Abrir trade':'Abrir trade demo'}</button></div>`;
  bindListingActions(body,renderMarket);body.querySelector('[data-open-own]').onclick=openOwnStall;body.querySelector('[data-open-trade]').onclick=openTrade;
}

async function openStall(stallId){view={type:'stall',id:String(stallId||'')};await refreshServerSnapshot();renderStall();}
function renderPublishRows(){
  const rows=commerceBackpackItems().filter(item=>item&&!item.bound);
  if(!rows.length)return'<div class="kc-empty">No tienes objetos publicables en Mochila.</div>';
  return rows.map((item,i)=>{const d=itemDesc(item,i),iid=itemIdentity(item);return `<div class="kc-row"><div class="kc-icon">${escapeHtml(d.icon)}</div><div class="kc-main"><div class="kc-name">${escapeHtml(d.name)}</div><div class="kc-meta">${escapeHtml(d.rarity)} · x${Math.max(1,Number(d.quantity)||1)}</div></div><input class="kc-input" style="width:76px" type="number" min="1" inputmode="numeric" value="50" data-price-for="${escapeHtml(iid)}"><button class="kc-btn primary" data-publish="${escapeHtml(iid)}" data-qty="${Math.max(1,Number(d.quantity)||1)}">PUBLICAR</button></div>`;}).join('');
}
function renderStall(){
  if(view.type!=='stall')return;const stallId=view.id,ss=snap(),claim=(ss.stalls||[]).find(x=>x&&x.stallId===stallId)||null,own=claim&&!claim.demo&&(String(claim.ownerId)===myId()||String(claim.ownerId)==='local_pioneer'),rows=listingsForStall(stallId);const body=shell(claim?(own?'Mi puesto':String(claim.sellerName||'Puesto')):'Puesto libre',stallId.toUpperCase());
  if(!claim){body.innerHTML=`<div class="kc-card gold"><h3>PUESTO DISPONIBLE</h3><div class="kc-sub">Reclámalo para colocar tus objetos sobre esta alfombra. Al entrar en modo vendedor tu personaje queda quieto detrás del puesto.</div><div class="kc-actions"><button class="kc-btn primary" data-claim>RECLAMAR Y VENDER</button></div></div>`;body.querySelector('[data-claim]').onclick=async()=>{const r=await C.claimStall(stallId,'Mi puesto');if(r?.ok){root.KeloMarketWorld?.startSelling?.(stallId);toast('Puesto reclamado');renderStall();}else toast(errorText(r?.error));};return;}
  if(!own){body.innerHTML=`<div class="kc-card gold"><h3>${escapeHtml(claim.message||'Puesto de jugador')}</h3><div class="kc-sub">Vendedor: ${escapeHtml(claim.sellerName||'Mercader')}</div></div><div class="kc-card"><h3>ALFOMBRA DE VENTA</h3>${rows.length?rows.map(listingCard).join(''):'<div class="kc-empty">Este puesto no tiene objetos ahora mismo.</div>'}</div>`;bindListingActions(body,renderStall);return;}
  const selling=root.KeloMarketWorld?.getSellingStall?.()===stallId;
  body.innerHTML=`<div class="kc-status">${selling?'MODO VENDEDOR ACTIVO · movimiento bloqueado':'Puesto reclamado · puedes activar modo vendedor'}</div><div class="kc-card gold"><h3>MENSAJE DEL PUESTO</h3><div class="kc-form"><input class="kc-input" maxlength="60" data-stall-message value="${escapeHtml(claim.message||'Mi puesto')}"><span></span><button class="kc-btn" data-save-message>GUARDAR</button></div><div class="kc-actions"><button class="kc-btn ${selling?'danger':'good'}" data-selling>${selling?'DEJAR DE VENDER':'PONERME A VENDER'}</button><button class="kc-btn danger" data-release>LIBERAR PUESTO</button></div></div><div class="kc-grid"><div class="kc-card"><h3>MIS PUBLICACIONES</h3>${rows.length?rows.map(listingCard).join(''):'<div class="kc-empty">La alfombra está vacía.</div>'}</div><div class="kc-card"><h3>PUBLICAR DESDE MOCHILA</h3>${renderPublishRows()}</div></div>`;
  body.querySelector('[data-save-message]').onclick=async()=>{const msg=body.querySelector('[data-stall-message]').value,r=await C.setStallMessage(msg);toast(r?.ok?'Mensaje actualizado':errorText(r?.error));renderStall();};
  body.querySelector('[data-selling]').onclick=()=>{if(selling)root.KeloMarketWorld?.stopSelling?.();else{const r=root.KeloMarketWorld?.startSelling?.(stallId);if(!r?.ok)toast(errorText(r?.error));}renderStall();};
  body.querySelector('[data-release]').onclick=async()=>{root.KeloMarketWorld?.stopSelling?.();const r=await C.releaseStall(stallId);if(r?.ok){toast('Puesto liberado');renderStall();}else toast(errorText(r?.error));};
  bindListingActions(body,renderStall);
  body.querySelectorAll('[data-publish]').forEach(btn=>btn.onclick=async()=>{const iid=btn.dataset.publish,price=Math.floor(Number(body.querySelector(`[data-price-for="${CSS.escape(iid)}"]`)?.value)||0),qty=Math.max(1,Math.floor(Number(btn.dataset.qty)||1)),r=await C.createMarketListing(iid,qty,price,{stallId});if(r?.ok){toast('Objeto publicado en tu alfombra');renderStall();}else toast(errorText(r?.error));});
}
function openOwnStall(){const own=ownClaim();if(own)return openStall(own.stallId);const free=(root.KeloMarketWorld?.getStalls?.()||[]).find(s=>!(snap()?.stalls||[]).some(c=>c&&c.stallId===s.stallId));if(free)return openStall(free.stallId);toast('No hay puestos libres ahora mismo');}

function offerItemsHtml(rows){if(!rows?.length)return'<div class="kc-empty">Sin objetos</div>';return rows.map(x=>rowHtml(x.item,`<button class="kc-btn danger" data-remove-trade="${escapeHtml(x.instanceId)}">QUITAR</button>`)).join('');}
function peerItemsHtml(rows){if(!rows?.length)return'<div class="kc-empty">Sin objetos</div>';return rows.map(x=>rowHtml(x.item,'')).join('');}
function tradeCandidates(){
  const rows=Array.isArray(snap()?.tradeCandidates)?snap().tradeCandidates:[];
  if(rows.length)return rows;
  const peers=Object.values(root.keloNet?.peers||{}).filter(p=>p?.playerKey);
  return peers.map(p=>({id:String(p.playerKey),name:String(p.name||'Jugador'),zone:String(p.zone||''),distance:(typeof localPlayer!=='undefined'&&Number.isFinite(p.x)&&Number.isFinite(p.y))?Math.round(Math.hypot(p.x-localPlayer.x,p.y-localPlayer.y)):null}));
}
function latestTradeTx(){const rows=(snap()?.transactionHistory||[]).filter(x=>x.type==='player_trade');if(!rows.length)return null;return isServer()?rows[0]:rows[rows.length-1];}
async function requestTradeWithPeer(peer){
  if(!peer?.id)return{ok:false,error:'INVALID_TRADE_PEER'};
  const r=await C.request('trade:request',{peerId:String(peer.id),peerName:String(peer.name||peer.id)});
  if(!r?.ok)toast(errorText(r?.error));else toast('Solicitud de trade enviada a '+String(peer.name||'jugador'));
  return r;
}
async function openTrade(peer){
  view={type:'trade',id:null};
  if(isServer()){
    await refreshServerSnapshot();
    if(!snap()?.activeTrade&&peer?.id)await requestTradeWithPeer(peer);
    renderTrade();return;
  }
  let t=snap()?.activeTrade;
  if(!t){const r=await C.createTrade({peerId:'offline_demo_peer',peerName:'Mercader Demo',demo:true});if(!r?.ok){toast(errorText(r?.error));return;}t=r.trade;}
  renderTrade();
}
function renderTradeInventory(t){
  const offered=new Set((t?.offers?.local?.items||[]).map(x=>String(x.sourceInstanceId||''))),items=commerceBackpackItems().filter(item=>item&&!item.bound&&!offered.has(itemIdentity(item)));
  if(!items.length)return'<div class="kc-empty">No hay más objetos disponibles.</div>';
  return items.map((item,i)=>{const d=itemDesc(item,i),iid=itemIdentity(item);return rowHtml(item,`<button class="kc-btn" data-add-trade="${escapeHtml(iid)}" data-add-qty="${Math.max(1,Number(d.quantity)||1)}">AÑADIR</button>`);}).join('');
}
function renderTradeLobby(){
  clearExpiryTimer();const body=shell('Trade entre jugadores','INTERCAMBIO SEGURO'),candidates=tradeCandidates();
  body.innerHTML=`<div class="kc-status">${isServer()?'Servidor conectado · el servidor valida propiedad, oro y ejecución':'Modo local'}</div><div class="kc-card"><h3>JUGADORES DISPONIBLES</h3>${candidates.length?candidates.map(p=>`<div class="kc-row"><div class="kc-icon">👤</div><div class="kc-main"><div class="kc-name">${escapeHtml(p.name||p.id)}</div><div class="kc-meta">${escapeHtml(p.zone||'mundo')}</div></div>${p.distance==null?'':`<div class="kc-distance">${Math.max(0,Number(p.distance)||0)} px</div>`}<button class="kc-btn primary" data-request-trade="${escapeHtml(p.id)}" data-peer-name="${escapeHtml(p.name||p.id)}">TRADE</button></div>`).join(''):'<div class="kc-empty">No hay jugadores disponibles para solicitar trade. Cuando el online exponga candidatos, aparecerán aquí sin cambiar esta UI.</div>'}</div><div class="kc-actions"><button class="kc-btn" data-refresh-trade>ACTUALIZAR</button></div>`;
  body.querySelectorAll('[data-request-trade]').forEach(btn=>btn.onclick=async()=>{if(busy)return;busy=true;try{await requestTradeWithPeer({id:btn.dataset.requestTrade,name:btn.dataset.peerName});renderTrade();}finally{busy=false;}});
  body.querySelector('[data-refresh-trade]').onclick=async()=>{await refreshServerSnapshot();renderTrade();};
}
function renderRequestedTrade(t){
  armRequestExpiry(t);const incoming=t.requestDirection==='incoming',peer=t.participants?.peer||{},body=shell(incoming?'Solicitud de trade':'Solicitud enviada','TRADE SEGURO');
  if(incoming){
    body.innerHTML=`<div class="kc-request"><div class="kc-kicker">QUIERE INTERCAMBIAR CONTIGO</div><div class="kc-request-name">${escapeHtml(peer.name||'Jugador')}</div><div class="kc-sub">Acepta para abrir el panel. Ningún objeto ni Oro se mueve antes de tu aceptación.</div><div class="kc-actions"><button class="kc-btn good" data-accept-trade>ACEPTAR TRADE</button><button class="kc-btn danger" data-reject-trade>RECHAZAR</button></div></div>`;
    body.querySelector('[data-accept-trade]').onclick=async()=>{const r=await C.request('trade:accept',{});if(!r?.ok)toast(errorText(r?.error));else toast('Trade aceptado');renderTrade();};
    body.querySelector('[data-reject-trade]').onclick=async()=>{const r=await C.request('trade:reject',{});if(!r?.ok)toast(errorText(r?.error));else toast('Solicitud rechazada');renderTrade();};
  }else{
    body.innerHTML=`<div class="kc-request"><div class="kc-kicker">SOLICITUD ENVIADA</div><div class="kc-request-name">${escapeHtml(peer.name||'Jugador')}</div><div class="kc-sub">Esperando a que el otro jugador acepte. La solicitud expira automáticamente si no responde.</div><div class="kc-actions"><button class="kc-btn danger" data-cancel-trade>CANCELAR SOLICITUD</button></div></div>`;
    body.querySelector('[data-cancel-trade]').onclick=async()=>{const r=await C.cancelTrade();toast(r?.ok?'Solicitud cancelada':errorText(r?.error));renderTrade();};
  }
}
function renderTrade(){
  if(view.type!=='trade')return;const t=snap()?.activeTrade;
  if(!t){
    if(isServer())return renderTradeLobby();
    clearExpiryTimer();const body=shell('Trade completado','DOBLE CONFIRMACIÓN'),last=latestTradeTx();body.innerHTML=last?`<div class="kc-card gold"><h3>TRANSACCIÓN CERRADA</h3><div class="kc-status">${escapeHtml(last.transactionId)}</div><div class="kc-sub">Oro enviado: ${last.goldOut||0} · Oro recibido: ${last.goldIn||0}</div></div><div class="kc-actions"><button class="kc-btn primary" data-new-trade>NUEVO TRADE DEMO</button></div>`:'<div class="kc-empty">No hay trade activo.</div>';body.querySelector('[data-new-trade]')?.addEventListener('click',()=>openTrade());return;
  }
  if(t.status==='REQUESTED')return renderRequestedTrade(t);
  clearExpiryTimer();
  const local=t.offers.local,peer=t.offers.peer,bothReady=!!(local.ready&&peer.ready),demo=t.mode==='offline-demo',body=shell('Trade con '+t.participants.peer.name,'INTERCAMBIO SEGURO');
  body.innerHTML=`<div class="kc-status">Estado: ${escapeHtml(t.status)} · revisión ${Number(t.revision)||1}${isServer()?' · servidor autoritativo':''}</div><div class="kc-trade-cols"><div class="kc-card gold"><h3>TÚ <span class="kc-ready ${local.ready?'on':''}">${local.ready?'✓ LISTO':'NO LISTO'}</span></h3>${offerItemsHtml(local.items)}<div class="kc-sep"></div><div class="kc-form"><div><div class="kc-mini">ORO QUE ENTREGAS</div><input class="kc-input" type="number" min="0" max="${Math.max(0,Number(snap()?.player?.gold)||0)}" inputmode="numeric" value="${Math.max(0,Number(local.gold)||0)}" data-trade-gold></div><span></span><button class="kc-btn" data-set-gold>CAMBIAR</button></div></div><div class="kc-card"><h3>${escapeHtml(t.participants.peer.name)} <span class="kc-ready ${peer.ready?'on':''}">${peer.ready?'✓ LISTO':'NO LISTO'}</span></h3>${peerItemsHtml(peer.items)}<div class="kc-status">Ofrece ${Math.max(0,Number(peer.gold)||0)} Oro</div></div></div><div class="kc-card"><h3>AÑADIR DESDE MOCHILA</h3>${renderTradeInventory(t)}</div><div class="kc-actions"><button class="kc-btn ${local.ready?'danger':'good'}" data-local-ready>${local.ready?'QUITAR LISTO':'MARCAR LISTO'}</button>${demo?`<button class="kc-btn" data-peer-ready>${peer.ready?'RIVAL: QUITAR LISTO':'RIVAL: MARCAR LISTO'} · DEMO</button>`:''}<button class="kc-btn danger" data-cancel-trade>CANCELAR TRADE</button></div>${bothReady?`<div class="kc-final"><strong>SEGUNDA CONFIRMACIÓN</strong><div class="kc-sub">Ambos bloquearon la oferta. Revisa objetos y Oro una vez más. El servidor solo ejecuta el intercambio cuando los dos aceptan esta pantalla final.</div><div class="kc-actions"><button class="kc-btn ${local.finalAccepted?'good':'primary'}" data-final-local>${local.finalAccepted?'✓ TÚ CONFIRMASTE':'YO ACEPTO DEFINITIVAMENTE'}</button>${demo?`<button class="kc-btn ${peer.finalAccepted?'good':''}" data-final-peer>${peer.finalAccepted?'✓ RIVAL CONFIRMÓ':'RIVAL CONFIRMA · DEMO'}</button>`:peer.finalAccepted?'<span class="kc-ready on">✓ RIVAL CONFIRMÓ</span>':'<span class="kc-ready">ESPERANDO AL RIVAL</span>'}</div></div>`:''}<div class="kc-mini" style="margin-top:9px">Cambiar cualquier objeto o cantidad de Oro reinicia automáticamente las confirmaciones de ambos jugadores.</div>`;
  body.querySelectorAll('[data-add-trade]').forEach(btn=>btn.onclick=async()=>{const r=await C.addTradeItem(btn.dataset.addTrade,Math.max(1,Number(btn.dataset.addQty)||1));if(!r?.ok)toast(errorText(r?.error));renderTrade();});
  body.querySelectorAll('[data-remove-trade]').forEach(btn=>btn.onclick=async()=>{const r=await C.removeTradeItem(btn.dataset.removeTrade);if(!r?.ok)toast(errorText(r?.error));renderTrade();});
  body.querySelector('[data-set-gold]').onclick=async()=>{const r=await C.setTradeGold(Math.max(0,Math.floor(Number(body.querySelector('[data-trade-gold]').value)||0)));if(!r?.ok)toast(errorText(r?.error));renderTrade();};
  body.querySelector('[data-local-ready]').onclick=async()=>{const r=await C.setTradeReady(!local.ready);if(!r?.ok)toast(errorText(r?.error));renderTrade();};
  body.querySelector('[data-peer-ready]')?.addEventListener('click',async()=>{const r=await C.demoPeerReady(!peer.ready);if(!r?.ok)toast(errorText(r?.error));renderTrade();});
  body.querySelector('[data-cancel-trade]').onclick=async()=>{const r=await C.cancelTrade();toast(r?.ok?'Trade cancelado · los objetos reservados fueron liberados':errorText(r?.error));renderTrade();};
  body.querySelector('[data-final-local]')?.addEventListener('click',async()=>{const r=await C.finalAcceptTrade(!local.finalAccepted);if(r?.ok&&r.status==='COMPLETED')toast('Trade completado de forma atómica');else if(!r?.ok)toast(errorText(r?.error));renderTrade();});
  body.querySelector('[data-final-peer]')?.addEventListener('click',async()=>{const r=await C.demoPeerFinalAccept(!peer.finalAccepted);if(r?.ok&&r.status==='COMPLETED')toast('Trade completado de forma atómica');else if(!r?.ok)toast(errorText(r?.error));renderTrade();});
}

function onCommerceChange(payload){
  const incoming=payload?.snapshot?.activeTrade?.status==='REQUESTED'&&payload?.snapshot?.activeTrade?.requestDirection==='incoming';
  if(incoming&&isServer()&&view.type!=='trade'){view={type:'trade',id:null};toast((payload.snapshot.activeTrade.participants?.peer?.name||'Un jugador')+' quiere hacer trade contigo');renderTrade();syncDock();return;}
  if(view.type==='market')renderMarket();else if(view.type==='stall')renderStall();else if(view.type==='trade')renderTrade();syncDock();
}
const previousOpenSocialTool=root.openSocialTool;if(typeof previousOpenSocialTool==='function')root.openSocialTool=function(tool){if(tool==='market')return enterMarket();return previousOpenSocialTool.apply(this,arguments);};
root.addEventListener?.('kelo:scenechange',syncDock);
root.addEventListener?.('keydown',e=>{if(e.key==='Escape'&&document.getElementById('kelo-commerce-modal')?.classList.contains('open'))close();});
C.onChange?.(onCommerceChange);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{dock();modal();syncDock();},{once:true});else{dock();modal();syncDock();}
root.KeloCommerceUI=Object.freeze({version:VERSION,enterMarket,leaveMarket,openMarket,openStall,openOwnStall,openTrade,openTradeWithPlayer:openTrade,close,render:()=>onCommerceChange()});
root.KELO_COMMERCE_UI_AUDIT=Object.freeze({version:VERSION,mobileFirst:true,authorityOnly:true,directStateMutation:false,marketInstanceEntry:true,stallCarpetInteraction:true,stallClaim:true,stallMessage:true,sellingMode:true,listingCreateBuyCancel:true,tradeItems:true,tradeGold:true,doubleConfirmation:true,offerMutationResetVisible:true,offlineDemoPeer:true,serverSnapshotCompatible:true,tradeRequestAcceptReject:true,serverInventorySnapshot:true,incomingTradePrompt:true,plugAndPlayOnline:true});
})(typeof globalThis!=='undefined'?globalThis:window);
