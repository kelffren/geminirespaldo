/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY EASY UI
 * owner: zero-training Sprite Ability workflow
 * keys: EASY MODE UPLOAD PREVIEW TEST ADJUST SAVE MOBILE FAMILY FRIENDLY
 * purpose: expose Sprite Ability as Subir -> Ver -> Probar -> Ajustar -> Guardar without replacing the canonical builder
 * does-not-own: spritesheet analysis, combat math, persistence, event authoring or runtime authority
 */
const STYLE_ID='kelo-sprite-ability-easy-v1-style';
const CSS=`
#kelo-studio-workspace .sab-easy-dock,#kelo-studio-workspace .sab-easy-welcome,#kelo-studio-workspace .sab-easy-mode-toggle,#kelo-studio-workspace .sab-easy-fixmenu{display:none}
#kelo-studio-workspace.sab-easy-ready .sab-easy-mode-toggle{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 11px;border:1px solid rgba(232,193,94,.44);border-radius:10px;background:rgba(7,18,24,.94);color:#ffe8a0;font:900 8px system-ui;letter-spacing:.05em;white-space:nowrap}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-mobile-tabs,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-side,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-timeline,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-v-controls,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-event-lab,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-mode,
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-v-tools{display:none!important}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-top [data-act="save"],
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-top [data-act="undo"],
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-top [data-act="redo"]{display:none!important}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-easy-dock{display:grid;position:fixed;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483600;width:min(720px,calc(100vw - 18px));grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:7px;border:1px solid rgba(232,193,94,.34);border-radius:18px;background:rgba(3,11,16,.96);box-shadow:0 18px 48px rgba(0,0,0,.55);backdrop-filter:blur(16px);pointer-events:auto}
.sab-easy-dock button{min-width:0;height:56px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.035);color:#e9f3f6;font:900 8px system-ui;letter-spacing:.03em;display:grid;place-items:center;align-content:center;gap:3px;padding:4px}.sab-easy-dock button strong{font-size:17px;line-height:1}.sab-easy-dock button.primary{border-color:rgba(232,193,94,.62);background:rgba(232,193,94,.08);color:#ffeba9}.sab-easy-dock button.test{border-color:rgba(50,166,255,.48);background:rgba(30,119,190,.1);color:#dff4ff}.sab-easy-dock button:disabled{opacity:.34;filter:saturate(.4)}.sab-easy-dock button:active{transform:translateY(1px)}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-easy-welcome{display:grid;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:15;width:min(360px,calc(100% - 28px));gap:10px;padding:18px;border:1px solid rgba(232,193,94,.34);border-radius:18px;background:rgba(4,14,20,.91);box-shadow:0 18px 44px rgba(0,0,0,.44);text-align:center;pointer-events:auto}.sab-easy-welcome[hidden]{display:none!important}.sab-easy-welcome .icon{font-size:34px}.sab-easy-welcome h3{margin:0;color:#fff2c8;font:950 14px system-ui;letter-spacing:.04em}.sab-easy-welcome p{margin:0;color:#9ab0ba;font:700 9px/1.5 system-ui}.sab-easy-welcome button{height:48px;border:1px solid rgba(232,193,94,.65);border-radius:12px;background:rgba(232,193,94,.1);color:#ffe89d;font:950 9px system-ui;letter-spacing:.05em}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .sab-easy-fixmenu{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483601;width:min(420px,calc(100vw - 24px));padding:9px;border:1px solid rgba(111,190,234,.28);border-radius:16px;background:rgba(4,15,21,.98);box-shadow:0 18px 45px rgba(0,0,0,.52);grid-template-columns:repeat(3,1fr);gap:7px;pointer-events:auto}.sab-easy-fixmenu.open{display:grid!important}.sab-easy-fixmenu button{height:58px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.035);color:#e6f0f4;font:850 8px/1.3 system-ui}.sab-easy-fixmenu button strong{display:block;margin-bottom:3px;font-size:16px}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"][data-sab-has-sheet="1"] .sab-easy-welcome{display:none!important}
#kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-main{bottom:82px!important}
@media(max-width:760px){
 #kelo-studio-workspace.sab-easy-ready .sab-easy-mode-toggle{height:38px;padding:0 9px;font-size:7px}
 #kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"]{padding-bottom:92px!important}
 #kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-main{height:calc(100dvh - 174px)!important;min-height:360px;margin-top:6px!important}
 #kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-viewport{height:100%!important}
 .sab-easy-dock button{height:58px;font-size:7px}.sab-easy-dock button strong{font-size:18px}
}
@media(min-width:761px){
 #kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-main{right:0!important;left:0!important;bottom:86px!important}
 #kelo-studio-workspace.sab-easy-ready[data-sab-easy="1"] .ksw-viewport{left:20px!important;right:20px!important}
}
`;
let disposed=false,observer=null,style=null,rootRef=null,builderModPromise=null,syncQueued=false;
const builderMod=()=>builderModPromise||(builderModPromise=import('./sprite-ability-live-controller.mjs'));
const toast=(root,msg)=>typeof root.showToast==='function'?root.showToast(msg):console.info('[Sprite Ability Easy]',msg);
const make=(doc,tag,cls,text='')=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function ensureStyle(doc){if(doc.getElementById(STYLE_ID))return;style=make(doc,'style');style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);}
function clickFirst(workspace,selectors){for(const selector of selectors){const node=workspace.querySelector(selector);if(node){node.click();return true;}}return false;}
async function currentBuilder(){try{return (await builderMod()).getSpriteAbilityBuilder?.()||null;}catch{return null;}}
function setEasy(workspace,on){workspace.dataset.sabEasy=on?'1':'0';workspace.querySelector('.sab-easy-fixmenu')?.classList.remove('open');const toggle=workspace.querySelector('.sab-easy-mode-toggle');if(toggle)toggle.textContent=on?'⚙ AVANZADO':'← MODO FÁCIL';if(on){workspace.querySelectorAll('.ksw-side.mobile-open').forEach(n=>n.classList.remove('mobile-open'));toast(rootRef,'Modo fácil: Sube · Ver · Probar · Ajustar · Guardar');}}
function nativeUpload(workspace){const input=workspace.querySelector('input.sab-file,.ksw-left input[type="file"]');if(!input){toast(rootRef,'El cargador todavía no está listo');return;}input.click();}
async function play(workspace){const b=await currentBuilder();if(!b?.draft?.sheet?.dataUrl){toast(rootRef,'Primero sube una imagen PNG o WEBP');return;}if(!clickFirst(workspace,['[data-v-play]','[data-sab-play]']))toast(rootRef,'La reproducción todavía no está lista');}
async function test(workspace){const b=await currentBuilder();if(!b?.draft?.sheet?.dataUrl){toast(rootRef,'Primero sube una imagen PNG o WEBP');return;}if(!clickFirst(workspace,['[data-sab-test-game]'])){clickFirst(workspace,['[data-mode="dummy"]']);clickFirst(workspace,['[data-v-play]','[data-sab-play]']);toast(rootRef,'Vista de prueba abierta; el test de juego aparecerá cuando termine de cargar');}}
async function save(workspace){const b=await currentBuilder();if(!b?.draft?.sheet?.dataUrl){toast(rootRef,'Sube una habilidad antes de guardar');return;}try{if(typeof b.save==='function')await b.save();else clickFirst(workspace,['[data-act="save"]']);toast(rootRef,'Habilidad guardada');}catch(error){toast(rootRef,error?.message||'No se pudo guardar');}}
function openAdvanced(workspace,target){setEasy(workspace,false);rootRef.setTimeout(()=>{if(target==='clip')clickFirst(workspace,['[data-panel="left"]']);if(target==='combat')clickFirst(workspace,['[data-panel="right"]']);if(target==='impact'){workspace.querySelector('.ksw-timeline')?.scrollIntoView?.({block:'center',behavior:'smooth'});toast(rootRef,'Impacto: arrastra HIT al frame donde golpea');}},0);}
function addButton(doc,icon,label,cls,fn){const b=make(doc,'button',cls);const strong=make(doc,'strong','',icon),span=make(doc,'span','',label);b.append(strong,span);b.onclick=fn;return b;}
function mount(workspace){if(workspace.classList.contains('sab-easy-ready'))return;workspace.classList.add('sab-easy-ready');workspace.dataset.sabEasy='1';const doc=workspace.ownerDocument,top=workspace.querySelector('.ksw-top');
 const toggle=make(doc,'button','sab-easy-mode-toggle','⚙ AVANZADO');toggle.type='button';toggle.onclick=()=>setEasy(workspace,workspace.dataset.sabEasy!=='1');top?.insertBefore(toggle,top.querySelector('[data-act="close"]')||null);
 const welcome=make(doc,'section','sab-easy-welcome');welcome.innerHTML='<div class="icon">✨</div><h3>SUBE TU HABILIDAD</h3><p>PNG o WEBP. KELO intenta detectar y cortar el spritesheet automáticamente.</p>';const welcomeUpload=make(doc,'button','','＋ SUBIR IMAGEN');welcomeUpload.type='button';welcomeUpload.onclick=()=>nativeUpload(workspace);welcome.append(welcomeUpload);workspace.querySelector('.ksw-main')?.append(welcome);
 const dock=make(doc,'nav','sab-easy-dock');dock.setAttribute('aria-label','Flujo fácil de Sprite Ability');dock.append(
  addButton(doc,'＋','SUBIR','primary',()=>nativeUpload(workspace)),
  addButton(doc,'▶','VER','',()=>void play(workspace)),
  addButton(doc,'⚡','PROBAR','test',()=>void test(workspace)),
  addButton(doc,'✎','AJUSTAR','',()=>workspace.querySelector('.sab-easy-fixmenu')?.classList.toggle('open')),
  addButton(doc,'✓','GUARDAR','primary',()=>void save(workspace))
 );workspace.append(dock);
 const fix=make(doc,'div','sab-easy-fixmenu');const clip=make(doc,'button');clip.innerHTML='<strong>✂</strong>Corte / rejilla';clip.onclick=()=>openAdvanced(workspace,'clip');const impact=make(doc,'button');impact.innerHTML='<strong>🎯</strong>Momento del golpe';impact.onclick=()=>openAdvanced(workspace,'impact');const power=make(doc,'button');power.innerHTML='<strong>⚔</strong>Daño / alcance';power.onclick=()=>openAdvanced(workspace,'combat');fix.append(clip,impact,power);workspace.append(fix);
 scheduleSync();
}
async function sync(){if(disposed||!rootRef?.document?.body?.classList.contains('kelo-sprite-ability-builder-active'))return;const workspace=rootRef.document.getElementById('kelo-studio-workspace');if(!workspace)return;mount(workspace);const b=await currentBuilder();const has=!!b?.draft?.sheet?.dataUrl;workspace.dataset.sabHasSheet=has?'1':'0';for(const button of workspace.querySelectorAll('.sab-easy-dock button')){const label=button.querySelector('span')?.textContent;button.disabled=!has&&['VER','PROBAR','AJUSTAR','GUARDAR'].includes(label);}const title=workspace.querySelector('.ksw-title');if(title&&workspace.dataset.sabEasy==='1'){const nextTitle=has?(b?.draft?.combat?.name||'SPRITE ABILITY'):'NUEVA HABILIDAD';if(title.textContent!==nextTitle)title.textContent=nextTitle;}}
function scheduleSync(){if(syncQueued||disposed)return;syncQueued=true;queueMicrotask(async()=>{syncQueued=false;try{await sync();}catch(error){console.warn('[Sprite Ability Easy] sync failed',error);}});}
export function installSpriteAbilityEasyUI({root=globalThis}={}){if(!root?.document)return()=>{};rootRef=root;disposed=false;ensureStyle(root.document);observer=new root.MutationObserver(scheduleSync);observer.observe(root.document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});scheduleSync();return()=>{disposed=true;observer?.disconnect();observer=null;const workspace=root.document.getElementById('kelo-studio-workspace');workspace?.classList.remove('sab-easy-ready');workspace?.removeAttribute('data-sab-easy');workspace?.removeAttribute('data-sab-has-sheet');workspace?.querySelector('.sab-easy-mode-toggle')?.remove();workspace?.querySelector('.sab-easy-dock')?.remove();workspace?.querySelector('.sab-easy-welcome')?.remove();workspace?.querySelector('.sab-easy-fixmenu')?.remove();style?.remove();style=null;};}
