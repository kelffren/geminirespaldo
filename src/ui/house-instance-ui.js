/* KELO-INDEX
 * area: UI
 * keys: HOUSE INSTANCE ENTER LEAVE PROPERTY EDITOR MOBILE
 * hace: entrada/salida de casa y acceso al mismo Property Editor dentro de la instancia
 * online: solo llama autoridad/API pública; no toca snapshots ni placements directamente
 */
(function(){
  'use strict';
  const H=window.KELO_HOUSES,A=window.KELO_HOUSE_AUTHORITY,I=window.KELO_INSTANCES,S=window.KELO_PROPERTY_SYSTEM;
  if(!H||!A||!I||!S){console.error('[Kelo house UI] dependencies missing');return;}
  const css=document.createElement('style');css.id='kelo-house-ui-style';css.textContent=`
  #kelo-house-panel{display:none;position:absolute;z-index:245;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 24px));padding:16px;border-radius:20px;border:1px solid rgba(231,197,106,.45);background:rgba(8,15,17,.985);box-shadow:0 24px 70px rgba(0,0,0,.62);color:#f4edda;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto}#kelo-house-panel *{box-sizing:border-box}.hi-title{font-weight:900;color:#e7c56a;font-size:16px}.hi-sub{margin:5px 0 14px;color:#94a69f;font-size:10px;line-height:1.45}.hi-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hi-btn{min-height:56px;border-radius:12px;border:1px solid rgba(231,197,106,.28);background:#111e20;color:#f4edda;font-weight:850;font-size:11px;padding:10px}.hi-btn.primary{grid-column:1/-1;background:#173f36;color:#fff4d6;border-color:rgba(231,197,106,.58)}.hi-close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#9daaa5;font-size:24px}.hi-state{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);color:#8fa19a;font-size:9px}.hi-exit{display:none;position:absolute;z-index:238;left:max(10px,env(safe-area-inset-left));top:max(62px,calc(env(safe-area-inset-top) + 54px));border:1px solid rgba(231,197,106,.5);background:rgba(9,18,21,.96);color:#e7c56a;border-radius:12px;padding:9px 11px;font:900 10px/1 sans-serif;pointer-events:auto}.kelo-house-instance .hi-exit{display:block}@media(max-width:600px){#kelo-house-panel{top:auto;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%)}}
  `;document.head.appendChild(css);
  const panel=document.createElement('section');panel.id='kelo-house-panel';panel.innerHTML=`<button class="hi-close" aria-label="Cerrar">×</button><div class="hi-title">MI PROPIEDAD</div><div class="hi-sub">Tu casa es una instancia separada del mundo. Los objetos se guardan y vuelven a cargar al entrar.</div><div class="hi-grid"><button class="hi-btn primary" id="hi-enter">ENTRAR A MI CASA</button><button class="hi-btn" id="hi-exterior">PARCELA EXTERIOR</button><button class="hi-btn" id="hi-test">ASSETS DE PRUEBA</button></div><div class="hi-state" id="hi-state"></div>`;document.body.appendChild(panel);
  const exit=document.createElement('button');exit.className='hi-exit';exit.id='hi-exit';exit.textContent='SALIR DE CASA';document.body.appendChild(exit);
  const el=id=>document.getElementById(id);const toast=msg=>typeof showToast==='function'?showToast(msg):console.log(msg);
  const params=new URLSearchParams(location.search),testMode=params.get('houseTest')==='1'||params.get('mapEditor')==='1'||params.get('editor')==='1';
  if(!testMode)el('hi-test').style.display='none';
  const priorOpen=window.openSocialTool;
  function stateText(){const i=H.current();el('hi-state').textContent=i?`${i.instanceId} · ${i.participants.length}/${i.maxPlayers} jugadores · rev ${i.revision}`:'Mundo principal · autoridad offline local';}
  function show(){if(typeof closeMenu==='function')closeMenu();panel.style.display='block';stateText();}
  function hide(){panel.style.display='none';}
  async function enter(){try{hide();const out=await H.enterOwn();stateText();toast('Entraste a tu casa');return out;}catch(err){console.error(err);toast(`No se pudo entrar: ${err.message}`);}}
  async function leave(){try{window.KELO_PROPERTY_EDITOR?.close?.();await H.leave();toast('Volviste al mundo');stateText();}catch(err){console.error(err);toast(`No se pudo salir: ${err.message}`);}}
  function openEditor(){const ed=window.KELO_PROPERTY_EDITOR;if(ed&&typeof ed.open==='function'){ed.open('parcel');return;}if(typeof priorOpen==='function')priorOpen('properties');}
  el('hi-enter').onclick=enter;el('hi-exterior').onclick=()=>{hide();if(typeof priorOpen==='function')priorOpen('properties');else openEditor();};el('hi-test').onclick=async()=>{try{const list=window.KELO_PROPERTY_CATALOG?.list?.()||[];for(const t of list.slice(0,6))await S.authorityLocalRequest('grantUnits',{ownerId:S.playerId(),assetId:t.id,quantity:3,developer:true});toast('Assets de prueba añadidos');}catch(err){toast(err.message);}};panel.querySelector('.hi-close').onclick=hide;exit.onclick=leave;
  window.openSocialTool=function(tool){if(tool==='properties'){if(H.current()){openEditor();return;}show();return;}if(typeof priorOpen==='function')return priorOpen.apply(this,arguments);};
  I.onChange(()=>stateText());
  window.KELO_HOUSE_UI=Object.freeze({version:'house-instance-ui-v1.0.0',show,hide,enter,leave,openEditor});
  window.KELO_HOUSE_UI_AUDIT=Object.freeze({version:'house-instance-ui-v1.0.0',mobile:true,menuIntegrated:true,samePropertyEditor:true,testMode});
  if(params.get('housePanel')==='1')setTimeout(show,100);
})();