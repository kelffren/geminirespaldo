/* KELO-INDEX
 * area: UI / LOGISTICS
 * owner: KeloLogisticsAdminUI
 * keys: ADMIN ECONOMY LOGISTICS CART CARAVAN ROUTE RISK CONTRACT FACTION CLAN MOBILE DEBUG INPUT LOCK
 * purpose: panel táctil/desktop de observabilidad y simulación que delega toda mutación en KeloLogisticsDevtools y owners de dominio
 * public-api: KeloLogisticsAdminUI.open/close/toggle/refresh/isOpen
 * consumes: KeloLogisticsDevtools, KeloRegionalEconomy, KeloCaravans, KeloFactions, KELO_ADMIN_KEYS, KeloInputLocks
 * state-owned: estado efímero de UI (open/tab/busy); NO posee economía, carretas, facciones ni clanes
 * online: UI solo llama request/devtool APIs; autoridad de gameplay sigue en los owners y puede migrar al servidor
 * reuse: QA móvil, pruebas manuales, demostraciones de economía/logística
 * do-not: NO escribir STATE, NO mutar oro/stock/cart/clan directamente, NO crear timers de corrección
 */
(function(root){
'use strict';
if(root.KeloLogisticsAdminUI)return;

const VERSION='logistics-admin-ui-v1.0.0';
const LOCK_OWNER='logistics-admin-ui';
const TABS=Object.freeze(['overview','economy','routes','carts','factions']);
let open=false,tab='overview',lockToken=null,busy=false,permissionUnsub=null;

const $=id=>document.getElementById(id);
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const pct=n=>Math.round(clamp(n,0,1)*100)+'%';
const money=n=>'$'+(Number(n)||0).toFixed(2).replace(/\.00$/,'');
const currentPlayerId=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.KeloFactions?.currentPlayerId?.()||root.localPlayer?.id||'local_pioneer');
const allowed=()=>!!root.KELO_ADMIN_KEYS?.can?.('admin.issue',currentPlayerId());
const ready=()=>!!(root.KeloLogisticsDevtools&&root.KeloRegionalEconomy&&root.KeloCaravans&&root.KeloFactions);
const toast=message=>{if(typeof root.showToast==='function')root.showToast(message);else console.info('[LogisticsAdmin]',message);};

function ensureStyle(){
  if($('kelo-logistics-admin-style'))return;
  const style=document.createElement('style');
  style.id='kelo-logistics-admin-style';
  style.textContent=`
#kelo-logistics-admin-fab{position:fixed;z-index:258;right:max(10px,env(safe-area-inset-right));bottom:max(70px,calc(env(safe-area-inset-bottom) + 64px));display:none;pointer-events:auto;border:1px solid rgba(226,190,93,.66);border-radius:14px;padding:10px 12px;background:linear-gradient(145deg,#132238,#08111f);color:#f3d77d;font:900 9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.06em;box-shadow:0 10px 30px rgba(0,0,0,.48)}
#kelo-logistics-admin{position:fixed;z-index:278;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));bottom:max(8px,env(safe-area-inset-bottom));width:min(560px,calc(100vw - 16px));display:none;flex-direction:column;pointer-events:auto;overflow:hidden;border:1px solid rgba(226,190,93,.5);border-radius:22px;background:linear-gradient(180deg,rgba(8,18,33,.99),rgba(5,11,20,.99));color:#edf4ff;box-shadow:0 28px 90px rgba(0,0,0,.72);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#kelo-logistics-admin *{box-sizing:border-box}.kla-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(90deg,rgba(38,71,112,.35),rgba(7,15,28,.2))}.kla-title{flex:1;font-size:13px;font-weight:950;color:#f1d174;letter-spacing:.06em}.kla-mode{font-size:8px;border:1px solid rgba(100,180,255,.25);border-radius:999px;padding:5px 7px;color:#9fc8eb;background:#0d263a}.kla-close,.kla-refresh{width:34px;height:34px;border:1px solid rgba(226,190,93,.28);border-radius:10px;background:#0c1929;color:#efd175;font-weight:900}.kla-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06)}.kla-tab{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0c1828;color:#829bb5;padding:8px 3px;font-size:7px;font-weight:950;letter-spacing:.03em}.kla-tab.on{color:#ffe597;border-color:rgba(226,190,93,.55);background:#172943}.kla-body{flex:1;overflow:auto;padding:9px;-webkit-overflow-scrolling:touch}.kla-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kla-card{border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(15,28,45,.83);padding:9px;min-width:0}.kla-card.wide{grid-column:1/-1}.kla-card h3{margin:0 0 6px;color:#f0d482;font-size:10px;letter-spacing:.04em}.kla-card h4{margin:7px 0 5px;color:#b9d5ee;font-size:9px}.kla-row{display:flex;gap:6px;align-items:center;padding:4px 0;font-size:8px;color:#9fb0c2}.kla-row strong{color:#edf5ff}.kla-row .grow{flex:1;min-width:0}.kla-pill{border-radius:999px;padding:3px 6px;font-size:7px;font-weight:900;background:#10263a;color:#9dc5e9;border:1px solid rgba(111,177,233,.18)}.kla-pill.warn{background:#392611;color:#ffd287;border-color:rgba(255,190,91,.28)}.kla-pill.danger{background:#3a1518;color:#ffaaa9;border-color:rgba(255,100,100,.27)}.kla-pill.good{background:#123326;color:#9de0bd;border-color:rgba(91,211,151,.22)}.kla-meter{height:6px;border-radius:999px;background:#08101b;overflow:hidden;margin-top:4px}.kla-meter>i{display:block;height:100%;background:linear-gradient(90deg,#2b8f72,#d1b354);border-radius:inherit}.kla-btns{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.kla-btn,.kla-select,.kla-input{border:1px solid rgba(226,190,93,.23);border-radius:9px;background:#0a1727;color:#e9d28a;padding:8px;font-size:8px;font-weight:850}.kla-btn.primary{background:#24405f;color:#fff0b0;border-color:#d6b95e}.kla-btn.danger{color:#ffaaaa;border-color:rgba(255,99,99,.34)}.kla-btn:disabled{opacity:.4}.kla-input{width:100%;font-weight:700;color:#e8f3ff}.kla-form{display:grid;grid-template-columns:1fr 82px auto;gap:5px;margin-top:7px}.kla-muted{font-size:7px;color:#71869a;line-height:1.4}.kla-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#a9c0d7;font-size:7px;word-break:break-all}.kla-empty{padding:22px;text-align:center;color:#748ba2;font-size:9px}.kla-banner{margin-bottom:8px;padding:8px 9px;border-radius:11px;background:rgba(38,73,111,.2);border:1px solid rgba(111,177,233,.13);font-size:8px;color:#a8c4df}.kla-busy{opacity:.58;pointer-events:none}
@media(max-width:620px){#kelo-logistics-admin{top:auto;height:min(82vh,720px)}.kla-grid{grid-template-columns:1fr}.kla-card.wide{grid-column:auto}.kla-tabs{gap:3px;padding:5px}.kla-tab{padding:7px 2px;font-size:6.5px}.kla-body{padding:7px}.kla-form{grid-template-columns:1fr 72px}.kla-form .kla-btn{grid-column:1/-1}#kelo-logistics-admin-fab{bottom:max(74px,calc(env(safe-area-inset-bottom) + 68px))}}
@media(max-height:480px) and (orientation:landscape){#kelo-logistics-admin{top:4px;bottom:4px;height:auto;width:min(530px,64vw)}.kla-body{padding:6px}.kla-card{padding:7px}.kla-head{padding:7px 9px}.kla-tabs{padding:4px 6px}}
`;
  document.head.appendChild(style);
}

function ensureDom(){
  if($('kelo-logistics-admin'))return;
  ensureStyle();
  const panel=document.createElement('section');
  panel.id='kelo-logistics-admin';
  panel.setAttribute('aria-label','Panel admin de economía y logística');
  panel.innerHTML=`<div class="kla-head"><div class="kla-title">⚖ ECONOMÍA & LOGÍSTICA</div><span class="kla-mode" id="kla-mode">OFFLINE</span><button class="kla-refresh" id="kla-refresh" aria-label="Actualizar">↻</button><button class="kla-close" id="kla-close" aria-label="Cerrar">×</button></div><div class="kla-tabs" id="kla-tabs"></div><div class="kla-body" id="kla-body"></div>`;
  panel.addEventListener('pointerdown',e=>e.stopPropagation());
  panel.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  document.body.appendChild(panel);
  const fab=document.createElement('button');fab.id='kelo-logistics-admin-fab';fab.textContent='⚖ LOGÍSTICA';fab.onclick=()=>openPanel();document.body.appendChild(fab);
  $('kla-close').onclick=closePanel;
  $('kla-refresh').onclick=refresh;
  $('kla-tabs').onclick=e=>{const b=e.target.closest('[data-kla-tab]');if(b)setTab(b.dataset.klaTab);};
  $('kla-body').onclick=handleBodyClick;
  syncPermission();
}

function syncPermission(){
  ensureDom();
  const fab=$('kelo-logistics-admin-fab');
  if(fab)fab.style.display=allowed()?'block':'none';
  if(open&&!allowed())closePanel();
}

function acquireLock(){if(lockToken||!root.KeloInputLocks?.acquire)return;lockToken=root.KeloInputLocks.acquire(LOCK_OWNER,{kind:'modal',source:'KeloLogisticsAdminUI'});}
function releaseLock(){if(lockToken&&root.KeloInputLocks?.release)root.KeloInputLocks.release(lockToken);lockToken=null;}
function openPanel(){
  ensureDom();
  if(!allowed()){toast('Necesitas una Llave Admin de propietario');return false;}
  if(!ready()){toast('La foundation de logística todavía no está lista');return false;}
  open=true;acquireLock();document.body.classList.add('kelo-logistics-admin-open');$('kelo-logistics-admin').style.display='flex';renderTabs();refresh();return true;
}
function closePanel(){open=false;releaseLock();document.body.classList.remove('kelo-logistics-admin-open');const panel=$('kelo-logistics-admin');if(panel)panel.style.display='none';return true;}
function toggle(){return open?closePanel():openPanel();}
function isOpen(){return open;}
function setTab(next){if(!TABS.includes(next))return;tab=next;renderTabs();refresh();}
function renderTabs(){
  const host=$('kla-tabs');if(!host)return;
  const labels={overview:'RESUMEN',economy:'ECONOMÍA',routes:'RUTAS',carts:'CARRETAS',factions:'FACCIONES'};
  host.innerHTML=TABS.map(t=>`<button class="kla-tab ${t===tab?'on':''}" data-kla-tab="${t}">${labels[t]}</button>`).join('');
}
function pill(text,kind){return `<span class="kla-pill ${kind||''}">${esc(text)}</span>`;}
function quotePrice(q){return Number(q?.finalPrice??q?.price??q?.buyPrice??0)||0;}
function routeScore(r){return Number(r?.risk?.score??r?.riskScore??0)||0;}
function distanceValue(r){const d=r?.economicDistance;if(Number.isFinite(Number(d)))return Number(d);return Number(d?.cost??d?.distance??d?.economicDistance??0)||0;}
function stateSnapshot(){try{return root.KeloLogisticsDevtools.snapshot();}catch(e){console.error(e);return null;}}

function renderOverview(s){
  const settlements=s.settlements||[],contracts=s.contracts||[],routes=s.routes||[],events=s.worldEvents||[],carts=Object.values(s.carts?.state?.carts||{}),f=s.factions||{};
  const avgRisk=routes.length?routes.reduce((n,r)=>n+routeScore(r),0)/routes.length:0;
  return `<div class="kla-banner">Este panel es QA/Admin. Todas las acciones delegan en los owners reales; no escribe estado gameplay directamente.</div><div class="kla-grid">
  <div class="kla-card"><h3>ECONOMÍA REGIONAL</h3><div class="kla-row"><span class="grow">Pueblos</span><strong>${settlements.length}</strong></div><div class="kla-row"><span class="grow">Contratos activos</span><strong>${contracts.filter(c=>c.status==='ACTIVE').length}</strong></div><div class="kla-row"><span class="grow">Eventos de ruta</span><strong>${events.filter(e=>e.status==='ACTIVE').length}</strong></div></div>
  <div class="kla-card"><h3>LOGÍSTICA</h3><div class="kla-row"><span class="grow">Rutas</span><strong>${routes.length}</strong></div><div class="kla-row"><span class="grow">Riesgo medio</span>${pill(Math.round(avgRisk*100)+'%',avgRisk>.65?'danger':avgRisk>.35?'warn':'good')}</div><div class="kla-row"><span class="grow">Carretas</span><strong>${carts.length}</strong></div></div>
  <div class="kla-card wide"><h3>PRUEBAS RÁPIDAS</h3><div class="kla-btns"><button class="kla-btn primary" data-action="emergency-apples">🍎 EMERGENCIA IGNIS</button><button class="kla-btn" data-action="raider-forest">⚔ SAQUEADORES BOSQUE</button><button class="kla-btn danger" data-action="kill-demo-cart">☠ LIBERAR CARRETA DEMO</button></div><p class="kla-muted">Úsalos para ver cómo cambian stock, contratos, riesgo y propiedad sin editar código.</p></div>
  <div class="kla-card wide"><h3>GRUPOS</h3><div class="kla-row"><span class="grow">Facciones definidas</span><strong>${f.factions?.length||0}</strong></div><div class="kla-row"><span class="grow">Clanes existentes</span><strong>${Object.keys(f.state?.clans||{}).length}</strong></div></div>
  </div>`;
}

function renderEconomy(s){
  const defs=s.economy?.settlements||[];
  const resources=s.economy?.resources||[];
  const active=new Map((s.contracts||[]).filter(c=>c.status==='ACTIVE').map(c=>[c.settlementId+'|'+c.resourceId,c]));
  const cards=(s.settlements||[]).map(st=>{
    const def=defs.find(x=>x.id===st.id)||{};
    const rows=resources.map(r=>{
      const cap=Math.max(1,Number(def.reserveCapacity?.[r.id])||1),stock=Number(st.stock?.[r.id])||0,ratio=stock/cap,q=st.quotes?.[r.id],contract=active.get(st.id+'|'+r.id);
      const kind=ratio<=.1?'danger':ratio<=.25?'warn':ratio>=.8?'good':'';
      return `<div class="kla-row"><span>${esc(r.metadata?.icon||'◇')}</span><span class="grow"><strong>${esc(r.id.toUpperCase())}</strong> · ${Math.round(stock).toLocaleString()}/${Math.round(cap).toLocaleString()}<div class="kla-meter"><i style="width:${clamp(ratio*100,0,100)}%"></i></div></span>${pill(pct(ratio),kind)}<strong>${money(quotePrice(q))}</strong>${contract?pill('CONTRATO','danger'):''}</div>`;
    }).join('');
    return `<div class="kla-card"><h3>${esc(st.name||st.id)}</h3>${rows}</div>`;
  }).join('');
  return `<div class="kla-grid">${cards||'<div class="kla-empty">Sin pueblos</div>'}</div>`;
}

function renderRoutes(s){
  const definitions=s.economy?.routes||[];
  const events=(s.worldEvents||[]).filter(e=>e.status==='ACTIVE');
  const cards=(s.routes||[]).map(r=>{
    const score=routeScore(r),kind=score>.65?'danger':score>.35?'warn':'good',def=definitions.find(x=>x.id===r.id)||{},node=def.ambushNodes?.[0]||'';
    const active=events.filter(e=>e.routeId===r.id);
    return `<div class="kla-card"><h3>${esc(r.from)} → ${esc(r.to)}</h3><div class="kla-row"><span class="grow">Riesgo logístico</span>${pill(Math.round(score*100)+'%',kind)}</div><div class="kla-row"><span class="grow">Distancia económica</span><strong>${distanceValue(r).toFixed(1)}</strong></div><div class="kla-row"><span class="grow">Eventos activos</span><strong>${active.length}</strong></div><div class="kla-code">${esc(r.id)}</div><div class="kla-btns"><button class="kla-btn" data-action="activate-raiders" data-route="${esc(r.id)}" data-node="${esc(node)}">⚔ ACTIVAR SAQUEADORES</button>${active.map(e=>`<button class="kla-btn danger" data-action="end-event" data-event="${esc(e.id)}">TERMINAR ${esc(e.id.slice(-5))}</button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="kla-grid">${cards||'<div class="kla-empty">Sin rutas</div>'}</div>`;
}

function renderCarts(s){
  const cartState=s.carts?.state?.carts||{},me=currentPlayerId();
  const cards=Object.values(cartState).map(c=>{
    let inspection=null;try{inspection=root.KeloCaravans.inspectCart(c.id,me);}catch(_){ }
    const cargo=inspection?.cargoVisible?`${inspection.cargo?.length||0} slots visibles`:'CARGA OCULTA';
    const owner=`${c.owner?.type||'?'}:${c.owner?.id||'?'}`;
    const controller=c.currentControllerId||'—';
    let actions='';
    if(c.state==='ATTACHED'&&String(c.currentControllerId)===me)actions+=`<button class="kla-btn" data-action="detach-cart" data-cart="${esc(c.id)}">SOLTAR</button>`;
    if(['PARKED','DROPPED'].includes(c.state))actions+=`<button class="kla-btn primary" data-action="attach-cart" data-cart="${esc(c.id)}">ENGANCHAR</button><button class="kla-btn" data-action="begin-claim" data-cart="${esc(c.id)}">RECLAMAR</button>`;
    if(c.state==='CLAIMING')actions+=`<button class="kla-btn" data-action="complete-claim" data-cart="${esc(c.id)}">COMPLETAR CLAIM</button>`;
    if(c.state==='ATTACHED')actions+=`<button class="kla-btn danger" data-action="kill-cart-carrier" data-cart="${esc(c.id)}">SIMULAR MUERTE</button>`;
    return `<div class="kla-card"><h3>🛞 ${esc(c.id)}</h3><div class="kla-row"><span class="grow">Estado</span>${pill(c.state,c.state==='ATTACHED'?'good':c.state==='CLAIMING'?'warn':'')}</div><div class="kla-row"><span class="grow">Owner</span><strong>${esc(owner)}</strong></div><div class="kla-row"><span class="grow">Controller</span><strong>${esc(controller)}</strong></div><div class="kla-row"><span class="grow">Carga</span><strong>${esc(cargo)}</strong></div><div class="kla-row"><span class="grow">Posición</span><span class="kla-code">${Math.round(c.position?.x||0)}, ${Math.round(c.position?.y||0)}</span></div><div class="kla-btns">${actions}</div><p class="kla-muted">Attach puede fallar si no estás físicamente cerca. Eso es intencional.</p></div>`;
  }).join('');
  return `<div class="kla-grid">${cards||'<div class="kla-empty">Sin carretas</div>'}</div>`;
}

function renderFactions(s){
  const f=s.factions||{},me=currentPlayerId(),membership=f.state?.memberships?.[me]||null,clans=Object.values(f.state?.clans||{}),myClan=clans.find(c=>c.members?.[me])||null;
  const factions=(f.factions||[]).map(x=>`<div class="kla-card"><h3>${esc(x.emblem)} ${esc(x.name)}</h3><div class="kla-row"><span class="grow">Capital</span><strong>${esc(x.homeSettlement||'—')}</strong></div><div class="kla-btns"><button class="kla-btn ${membership?.factionId===x.id?'primary':''}" data-action="join-faction" data-faction="${esc(x.id)}" ${membership?.factionId===x.id?'disabled':''}>${membership?.factionId===x.id?'UNIDO':'UNIRME'}</button></div></div>`).join('');
  const clanCards=clans.map(c=>`<div class="kla-card"><h3>[${esc(c.tag)}] ${esc(c.name)}</h3><div class="kla-row"><span class="grow">Facción</span><strong>${esc(c.factionId)}</strong></div><div class="kla-row"><span class="grow">Miembros</span><strong>${Object.keys(c.members||{}).length}</strong></div><div class="kla-btns"><button class="kla-btn" data-action="join-clan" data-clan="${esc(c.id)}" ${myClan?'disabled':''}>UNIRME</button></div></div>`).join('');
  return `<div class="kla-banner">Jugador: <strong>${esc(me)}</strong> · Facción: <strong>${esc(membership?.factionId||'NINGUNA')}</strong> · Clan: <strong>${esc(myClan?.name||'NINGUNO')}</strong></div><div class="kla-grid">${factions}<div class="kla-card wide"><h3>CREAR CLAN DE PRUEBA</h3><div class="kla-form"><input class="kla-input" id="kla-clan-name" maxlength="32" placeholder="Nombre del clan"><input class="kla-input" id="kla-clan-tag" maxlength="5" placeholder="TAG"><button class="kla-btn primary" data-action="create-clan" ${!membership||myClan?'disabled':''}>CREAR</button></div><p class="kla-muted">Necesitas facción y no pertenecer ya a un clan.</p></div>${clanCards}</div>`;
}

function render(){
  const body=$('kla-body');if(!body)return;
  const s=stateSnapshot();
  if(!s){body.innerHTML='<div class="kla-empty">No se pudo leer Logistics Devtools.</div>';return;}
  const mode=s.economy?.mode||s.carts?.mode||s.factions?.mode||'local-offline';if($('kla-mode'))$('kla-mode').textContent=String(mode).toUpperCase();
  body.classList.toggle('kla-busy',busy);
  body.innerHTML=tab==='economy'?renderEconomy(s):tab==='routes'?renderRoutes(s):tab==='carts'?renderCarts(s):tab==='factions'?renderFactions(s):renderOverview(s);
}
function refresh(){if(!open)return null;render();return stateSnapshot();}

async function act(command,payload,success){
  if(busy)return;busy=true;render();
  try{const result=await root.KeloLogisticsDevtools.run(command,payload||{});if(!result?.ok&&result?.error)toast('Error: '+result.error);else toast(success||'Acción aplicada');return result;}catch(e){console.error(e);toast('Error: '+String(e?.message||e));return{ok:false,error:String(e?.message||e)};}finally{busy=false;render();}
}
async function handleBodyClick(e){
  const b=e.target.closest('[data-action]');if(!b||busy)return;
  const action=b.dataset.action,me=currentPlayerId();
  if(action==='emergency-apples'){busy=true;render();try{await root.KeloLogisticsDevtools.scenarios.emergencyApples();toast('Ignis quedó en emergencia de manzanas');}finally{busy=false;render();}return;}
  if(action==='raider-forest'){busy=true;render();try{await root.KeloLogisticsDevtools.scenarios.raiderForest();toast('Banda de saqueadores activada');}finally{busy=false;render();}return;}
  if(action==='kill-demo-cart')return act('kill-carrier',{cartId:'cart_demo_1'},'Carreta demo liberada');
  if(action==='activate-raiders')return act('activate-raiders',{routeId:b.dataset.route,ambushNodeId:b.dataset.node||undefined,npcThreat:.18,eventRisk:.35},'Saqueadores activados');
  if(action==='end-event')return act('end-world-event',{eventId:b.dataset.event},'Evento terminado');
  if(action==='attach-cart')return act('attach-cart',{cartId:b.dataset.cart,actorId:me},'Carreta enganchada');
  if(action==='detach-cart')return act('detach-cart',{cartId:b.dataset.cart,actorId:me},'Carreta soltada');
  if(action==='begin-claim')return act('begin-claim',{cartId:b.dataset.cart,actorId:me},'Claim iniciado');
  if(action==='complete-claim')return act('complete-claim',{cartId:b.dataset.cart,actorId:me},'Carreta reclamada');
  if(action==='kill-cart-carrier')return act('kill-carrier',{cartId:b.dataset.cart},'Portador eliminado; carreta reclamable');
  if(action==='join-faction')return act('join-faction',{playerId:me,factionId:b.dataset.faction},'Facción actualizada');
  if(action==='join-clan')return act('join-clan',{playerId:me,clanId:b.dataset.clan},'Clan actualizado');
  if(action==='create-clan'){
    const name=$('kla-clan-name')?.value.trim(),tagValue=$('kla-clan-tag')?.value.trim();
    return act('create-clan',{playerId:me,name,tag:tagValue},'Clan creado');
  }
}

function boot(){
  ensureDom();
  if(root.KELO_ADMIN_KEYS?.onChange)permissionUnsub=root.KELO_ADMIN_KEYS.onChange(syncPermission);
  syncPermission();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
root.addEventListener?.('beforeunload',()=>{releaseLock();try{permissionUnsub?.();}catch(_){ }},{once:true});

root.KeloLogisticsAdminUI=Object.freeze({version:VERSION,open:openPanel,close:closePanel,toggle,refresh,isOpen,allowed});
root.KELO_LOGISTICS_ADMIN_UI_AUDIT=Object.freeze({version:VERSION,adminGated:true,inputLockOwner:LOCK_OWNER,domainStateWrites:false,devtoolsDelegation:true,mobileResponsive:true,onlineBoundaryPreserved:true});
})(typeof globalThis!=='undefined'?globalThis:window);
