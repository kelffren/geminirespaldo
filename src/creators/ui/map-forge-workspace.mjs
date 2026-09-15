/* KELO-INDEX
 * area: CREATORS / MAP FORGE UI
 * owner: Kelo Map Forge Creator UI
 * owns: generation controls, normalized snapshot preview, candidate selection, sprite requirements, scene build plan, export and World Studio/exterior handoff actions
 * does-not-own: generator algorithms, draft import authority, World Studio, renderer, collision, properties or gameplay authority
 * public-api: openMapForgeWorkspace(), closeMapForgeWorkspace(), getMapForgeWorkspace()
 * consumes: KeloInputLocks + Map Forge worker client + Map Forge importer projection + KELO_WORLD_BUILDER preview + injected onOpenWorld callback
 * mobile: full-screen responsive authoring UI; exterior preview detaches shell immediately and releases input while preserving generated session state
 */
import {listMapForgeRecipes,getMapForgeRecipe} from '../../world/map-forge/map-forge-recipes.mjs';
import {serializeMapDefinition} from '../../world/map-forge/map-forge-core.mjs';
import {createMapForgeWorkerClient} from '../../world/map-forge/map-forge-worker-client.mjs';
import {mapDefinitionToWorldDraftSnapshot} from '../../studio/adapters/map-forge-draft-importer.mjs';

let active=null;
const METRICS={playability:'Jugabilidad',connectivity:'Conectividad',navigation:'Navegación',visualComposition:'Composición',landmarkQuality:'Landmarks',districtVariety:'Distritos',roadQuality:'Carreteras',densityBalance:'Densidad',negativeSpace:'Espacio',assetVariety:'Assets',scenicVistas:'Vistas',technicalSafety:'Seguridad'};
const STYLE_KEYS=['monumentality','organicRoads','density','vegetation','exploration','decoration'];
const CSS=`
[data-kelo-map-forge-ui]{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,sans-serif;color:#f6f0df}#kelo-map-forge{position:fixed;inset:0;z-index:2147482400;background:radial-gradient(circle at 50% -20%,rgba(218,178,85,.14),transparent 38%),#07090d;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.kmf-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #ffffff16;background:#0b0e13f2}.kmf-logo{width:36px;height:36px;border:1px solid #d9b65b99;border-radius:10px;display:grid;place-items:center;color:#e7c96f;font-weight:950}.kmf-brand{min-width:0}.kmf-brand b{display:block;letter-spacing:.09em}.kmf-brand small{color:#8d929d}.kmf-head-actions{margin-left:auto;display:flex;gap:7px}.kmf-btn{min-height:40px;border:1px solid #ffffff20;background:#141820;color:#fff;border-radius:11px;padding:8px 11px;font-weight:850;cursor:pointer}.kmf-btn.primary{border-color:#d7b35c88;background:#d7b35c20;color:#ffe8a8}.kmf-btn.preview{border-color:#8ac3a966;background:#183226;color:#d9ffe8}.kmf-btn:disabled{opacity:.42;cursor:default}.kmf-layout{display:grid;grid-template-columns:270px minmax(0,1fr) 300px;min-height:0}.kmf-side{overflow:auto;padding:13px;background:#0c0f14de}.kmf-side.left{border-right:1px solid #ffffff12}.kmf-side.right{border-left:1px solid #ffffff12}.kmf-section{padding:10px 0;border-bottom:1px solid #ffffff12}.kmf-section h3{margin:0 0 9px;font-size:10px;letter-spacing:.17em;color:#d0b772}.kmf-label{display:grid;gap:5px;margin:8px 0;color:#b8bdc6;font-size:11px;font-weight:750}.kmf-input,.kmf-select{width:100%;background:#080b10;border:1px solid #ffffff1f;border-radius:9px;color:#fff;padding:9px}.kmf-row{display:flex;gap:7px;align-items:center}.kmf-range{width:100%}.kmf-val{width:38px;text-align:right;color:#e4c872;font-size:11px}.kmf-stage{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:radial-gradient(circle,#162131,#080b10 70%)}.kmf-canvas-wrap{padding:13px;min-height:0}.kmf-canvas{display:block;width:100%;height:100%;min-height:390px;border:1px solid #ffffff16;border-radius:16px;background:#071018}.kmf-candidates{display:flex;gap:8px;overflow:auto;padding:10px 13px 13px;border-top:1px solid #ffffff12}.kmf-card{min-width:142px;border:1px solid #ffffff18;background:#10141b;color:#fff;border-radius:11px;padding:9px;text-align:left;cursor:pointer}.kmf-card.on{border-color:#dabc63;box-shadow:0 0 0 1px #dabc6328 inset}.kmf-card b{display:block;color:#f0d17c;font-size:16px}.kmf-card small{color:#9298a4}.kmf-score{font-size:32px;font-weight:950;color:#edcf78}.kmf-muted{font-size:11px;color:#9298a4;line-height:1.45}.kmf-metrics{display:grid;gap:5px}.kmf-metric{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#aeb4bd}.kmf-metric b{color:#efe2bb}.kmf-action-stack{display:grid;gap:8px}.kmf-action-help{margin-top:7px;color:#7f8c87;font-size:9px;line-height:1.4}.kmf-sprite-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px}.kmf-stat{padding:7px 5px;border:1px solid #ffffff12;border-radius:9px;background:#090c11;text-align:center}.kmf-stat b{display:block;color:#f0d17c;font-size:15px}.kmf-stat small{color:#777f8b;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.kmf-mini-list{display:grid;gap:5px;max-height:210px;overflow:auto}.kmf-sprite-row,.kmf-scene-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:center;padding:7px 8px;border:1px solid #ffffff12;border-radius:9px;background:#0a0d12}.kmf-sprite-row b,.kmf-scene-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#dfe4eb}.kmf-sprite-row small,.kmf-scene-row small{grid-column:1/-1;color:#747c88;font-size:8px;line-height:1.3}.kmf-badge{border:1px solid #ffffff1c;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900;white-space:nowrap}.kmf-badge.ready{border-color:#6dc99a55;color:#a7efc6;background:#173025}.kmf-badge.missing{border-color:#e6b65e55;color:#ffd88c;background:#342817}.kmf-badge.arrival{border-color:#75baf055;color:#b9ddff;background:#172b3c}.kmf-copy{width:100%;min-height:32px;margin-top:7px;font-size:9px}.kmf-exterior-status{position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147481200;pointer-events:none;padding:9px 14px;border:1px solid #d8bc6766;border-radius:999px;background:#090d12e8;color:#ffe6a0;font:800 12px Inter,system-ui,sans-serif;box-shadow:0 8px 28px #0008;white-space:nowrap}.kmf-return{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:2147481200;min-height:42px;padding:9px 14px;border:1px solid #d8bc6799;border-radius:12px;background:#111821ed;color:#ffe7a3;font:850 11px Inter,system-ui,sans-serif;box-shadow:0 8px 28px #0008;cursor:pointer}.kmf-return:disabled{opacity:.55}
@media(max-width:900px){.kmf-layout{grid-template-columns:220px minmax(0,1fr)}.kmf-side.right{grid-column:1/-1;border-left:0;border-top:1px solid #ffffff12;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-height:320px}.kmf-action-stack{grid-template-columns:1fr 1fr}}
@media(max-width:650px){.kmf-brand small{display:none}.kmf-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(500px,1fr) auto;overflow:auto}.kmf-side.left,.kmf-side.right{border:0;overflow:visible;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:9px;max-height:none}.kmf-stage{min-height:520px}.kmf-canvas-wrap{padding:9px}.kmf-canvas{min-height:390px}.kmf-head{padding:8px}.kmf-head-actions .kmf-btn{padding:7px 8px;font-size:10px}}
@media(max-width:430px){.kmf-side.left,.kmf-side.right{grid-template-columns:1fr}.kmf-logo{width:32px;height:32px}.kmf-brand b{font-size:12px}.kmf-head-actions .kmf-btn{min-height:36px}.kmf-canvas{min-height:360px}.kmf-action-stack{grid-template-columns:1fr}.kmf-side.right .kmf-section:nth-child(2){position:sticky;bottom:0;z-index:2;background:#0c0f14;padding:10px;border:1px solid #ffffff14;border-radius:12px}.kmf-mini-list{max-height:180px}.kmf-return{top:auto;bottom:max(14px,env(safe-area-inset-bottom));right:12px}}
`;

function make(doc,tag,props={},children=[]){
  const node=doc.createElement(tag);
  for(const[k,v]of Object.entries(props)){
    if(k==='class')node.className=v;
    else if(k==='text')node.textContent=v;
    else if(k.startsWith('data-')||k.startsWith('aria-'))node.setAttribute(k,v);
    else node[k]=v;
  }
  for(const child of [].concat(children||[]))if(child)node.append(child);
  return node;
}
function randomSeed(root){try{const a=new Uint32Array(1);root.crypto?.getRandomValues?.(a);if(a[0])return a[0];}catch{}return Date.now()>>>0;}
function normalizedPreviewSnapshot(root,map,cache){
  if(cache.has(map))return cache.get(map);
  const tileSize=Math.max(1,Number(root.KELO_WORLD_BUILDER?.tileSize||root.KELO_TILE_REGISTRY?.worldTileSize)||32),worldWidth=Math.max(tileSize,Number(root.CONFIG?.worldWidth)||Number(map?.worldBounds?.w)||3600),worldHeight=Math.max(tileSize,Number(root.CONFIG?.worldHeight)||Number(map?.worldBounds?.h)||3200),assetCatalog=root.KELO_PROPERTY_CATALOG||root.KELO_PROPERTY_ASSET_CATALOG||null;
  const value=mapDefinitionToWorldDraftSnapshot(map,{tileSize,worldWidth,worldHeight,assetCatalog});cache.set(map,value);return value;
}
function drawPreview(root,canvas,map,cache){
  const renderer=root.KELO_WORLD_BUILDER?.renderSnapshotPreview;if(typeof renderer!=='function')throw new Error('WORLD_BUILDER_SNAPSHOT_PREVIEW_NOT_READY');
  return renderer(canvas,normalizedPreviewSnapshot(root,map,cache),{bounds:map.worldBounds,padding:14});
}
function exportJson(root,map){
  const blob=new root.Blob([serializeMapDefinition(map)],{type:'application/json'}),url=root.URL.createObjectURL(blob),a=root.document.createElement('a');
  a.href=url;a.download=`${map.metadata.recipeId}-${map.metadata.seed}-${map.metadata.layoutHash}.json`;root.document.body.append(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),500);
}
function sceneLabel(scene){if(scene.sceneType==='arrival')return'Llegada';return String(scene.prefabId||scene.sceneId||'Escena').replace(/^.*?:/,'').replaceAll('-',' ');}
function spriteSubtitle(sprite){const districts=(sprite.districts||[]).slice(0,3).join(', '),scenes=(sprite.sceneIds||[]).length;return`${sprite.usageCount||0} usos${districts?` · ${districts}`:''}${scenes?` · ${scenes} escenas`:''}`;}

export async function openMapForgeWorkspace({root=globalThis,onOpenWorld=null}={}){
  if(active)return active;
  if(!root.document)throw new Error('MAP_FORGE_UI_DOM_REQUIRED');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('MAP_FORGE_INPUT_LOCKS_NOT_READY');
  const doc=root.document;
  const style=make(doc,'style',{'data-kelo-map-forge-ui':'',textContent:CSS});doc.head.append(style);
  const shell=make(doc,'section',{id:'kelo-map-forge'});shell.setAttribute('data-kelo-map-forge-ui','');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Map Forge');
  const logo=make(doc,'div',{class:'kmf-logo',text:'MF'});
  const brand=make(doc,'div',{class:'kmf-brand'},[make(doc,'b',{text:'KELO MAP FORGE'}),make(doc,'small',{text:'Ciudades automáticas · escenas + sprites'})]);
  const close=make(doc,'button',{class:'kmf-btn',text:'CERRAR'}),generateButton=make(doc,'button',{class:'kmf-btn primary',text:'GENERAR'});
  const head=make(doc,'header',{class:'kmf-head'},[logo,brand,make(doc,'div',{class:'kmf-head-actions'},[close,generateButton])]);
  const left=make(doc,'aside',{class:'kmf-side left'}),stage=make(doc,'main',{class:'kmf-stage'}),right=make(doc,'aside',{class:'kmf-side right'});
  shell.append(head,make(doc,'div',{class:'kmf-layout'},[left,stage,right]));doc.body.append(shell);
  const worker=createMapForgeWorkerClient({root}),previewCache=new WeakMap();
  let result=null,selected=null,busy=false,raf=0,inputToken=null,listenersAttached=false,exteriorStatus=null,returnButton=null,destroyed=false;
  const recipeSelect=make(doc,'select',{class:'kmf-select'});for(const recipe of listMapForgeRecipes())recipeSelect.append(make(doc,'option',{value:recipe.id,text:recipe.label}));
  const seedInput=make(doc,'input',{class:'kmf-input',type:'number',value:String(randomSeed(root))}),reroll=make(doc,'button',{class:'kmf-btn',text:'↻','aria-label':'Nueva seed'}),countSelect=make(doc,'select',{class:'kmf-select'});
  for(const n of[4,8,16,32])countSelect.append(make(doc,'option',{value:String(n),text:`Best of ${n}`}));countSelect.value='8';
  left.append(make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'GENERACIÓN'}),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Tipo de mapa'}),recipeSelect]),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Seed'}),make(doc,'div',{class:'kmf-row'},[seedInput,reroll])]),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Candidatos'}),countSelect])]));
  const sliders={},styleSection=make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'DIRECCIÓN'})]);
  for(const key of STYLE_KEYS){const range=make(doc,'input',{class:'kmf-range',type:'range',min:'0',max:'1',step:'.01'}),value=make(doc,'span',{class:'kmf-val'});range.oninput=()=>value.textContent=Number(range.value).toFixed(2);sliders[key]=range;styleSection.append(make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:key}),make(doc,'div',{class:'kmf-row'},[range,value])]))}
  left.append(styleSection);
  const canvas=make(doc,'canvas',{class:'kmf-canvas'}),candidateBar=make(doc,'div',{class:'kmf-candidates'});stage.append(make(doc,'div',{class:'kmf-canvas-wrap'},[canvas]),candidateBar);
  const scoreSection=make(doc,'section',{class:'kmf-section'}),actionsSection=make(doc,'section',{class:'kmf-section'}),spritesSection=make(doc,'section',{class:'kmf-section'}),scenesSection=make(doc,'section',{class:'kmf-section'}),metricsSection=make(doc,'section',{class:'kmf-section'}),status=make(doc,'div',{class:'kmf-muted',text:'Preparando primera ciudad…'});
  right.append(scoreSection,actionsSection,spritesSection,scenesSection,metricsSection,make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'ESTADO'}),status]));
  const loadRecipeStyle=()=>{const recipe=getMapForgeRecipe(recipeSelect.value);for(const key of STYLE_KEYS){sliders[key].value=String(recipe?.style?.[key]??.5);sliders[key].dispatchEvent(new root.Event('input'));}};
  const styleOverrides=()=>Object.fromEntries(STYLE_KEYS.map(key=>[key,Number(sliders[key].value)]));
  const schedule=()=>{root.cancelAnimationFrame?.(raf);raf=root.requestAnimationFrame?.(()=>{if(selected&&shell.isConnected)try{const info=drawPreview(root,canvas,selected,previewCache),expected=Array.isArray(info?.placements)?info.placements.length:0,drawn=Number(info?.drawnPlacements||0);status.dataset.previewAssets=String(drawn);status.dataset.previewAssetsExpected=String(expected);status.dataset.previewReady=expected>0&&drawn>=expected?'true':'false';}catch(error){console.error('[Map Forge preview]',error);status.textContent=`Preview: ${error?.message||error}`;status.style.color='#ff9d9d';}})||0;};
  const onRenderAssetReady=()=>schedule();
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();destroy();}};
  function acquireInput(){if(inputToken==null)inputToken=root.KeloInputLocks.acquire('kelo-map-forge',{kind:'creator-workspace'});}
  function releaseInput(){if(inputToken==null)return;try{root.KeloInputLocks.release(inputToken);}catch{}inputToken=null;}
  function attachListeners(){if(listenersAttached)return;listenersAttached=true;root.addEventListener?.('resize',schedule);root.addEventListener?.('kelo:world-builder-render-assets-ready',onRenderAssetReady);root.addEventListener?.('kelo:property-render-assets-ready',onRenderAssetReady);doc.addEventListener('keydown',onKey,true);}
  function detachListeners(){if(!listenersAttached)return;listenersAttached=false;root.removeEventListener?.('resize',schedule);root.removeEventListener?.('kelo:world-builder-render-assets-ready',onRenderAssetReady);root.removeEventListener?.('kelo:property-render-assets-ready',onRenderAssetReady);doc.removeEventListener('keydown',onKey,true);}
  function detachWorkspace(){root.cancelAnimationFrame?.(raf);raf=0;detachListeners();releaseInput();shell.remove();}
  function resumeWorkspace(){if(destroyed)return;if(!style.isConnected)doc.head.append(style);if(!shell.isConnected)doc.body.append(shell);acquireInput();attachListeners();if(selected)renderSelected();else schedule();}
  function clearExteriorChrome(){exteriorStatus?.remove();returnButton?.remove();exteriorStatus=null;returnButton=null;}
  function showExteriorStatus(text){exteriorStatus?.remove();exteriorStatus=make(doc,'div',{class:'kmf-exterior-status',text});exteriorStatus.setAttribute('data-kelo-map-forge-ui','');doc.body.append(exteriorStatus);return exteriorStatus;}
  async function returnFromExterior(){
    if(destroyed)return;if(returnButton)returnButton.disabled=true;let exitError=null;
    try{if(root.KELO_WORLD_EDIT?.request)await root.KELO_WORLD_EDIT.request('world:preview:exit',{});}catch(error){exitError=error;console.error('[Map Forge preview exit]',error);}
    clearExteriorChrome();busy=false;resumeWorkspace();if(exitError){status.textContent=`Preview exterior cerrada con aviso: ${exitError?.message||exitError}`;status.style.color='#ffcf82';root.showToast?.('Map Forge restaurado; no se pudo restaurar la vista publicada');}
  }
  function showReturnButton(){returnButton?.remove();returnButton=make(doc,'button',{class:'kmf-return',text:'VOLVER A MAP FORGE'});returnButton.setAttribute('data-kelo-map-forge-ui','');returnButton.onclick=()=>void returnFromExterior();doc.body.append(returnButton);}
  async function handoffExterior(button){
    if(busy||typeof onOpenWorld!=='function'||!selected?.validation?.valid)return;
    busy=true;button.disabled=true;const map=selected;detachWorkspace();showExteriorStatus('Cargando mapa generado…');
    try{await onOpenWorld(map,{previewOnly:true});exteriorStatus?.remove();exteriorStatus=null;busy=false;showReturnButton();}
    catch(error){clearExteriorChrome();busy=false;console.error('[Map Forge exterior handoff]',error);resumeWorkspace();status.textContent=error?.message||'No se pudo aplicar el mapa';status.style.color='#ff9d9d';root.showToast?.(error?.message||'No se pudo aplicar el mapa');renderSelected();}
  }
  async function handoffWorldEditor(button){
    if(busy||typeof onOpenWorld!=='function'||!selected?.validation?.valid)return;
    busy=true;button.disabled=true;button.textContent='CREANDO DRAFT…';const map=selected;
    try{await onOpenWorld(map,{previewOnly:false});destroy();}
    catch(error){busy=false;console.error('[Map Forge handoff]',error);status.textContent=error?.message||'No se pudo abrir World Editor';status.style.color='#ff9d9d';root.showToast?.(error?.message||'No se pudo abrir World Editor');renderSelected();}
  }
  function renderSpriteManifest(){
    const manifest=selected?.spriteManifest;if(!manifest){spritesSection.replaceChildren(make(doc,'h3',{text:'SPRITES NECESARIOS'}),make(doc,'div',{class:'kmf-muted',text:'Este candidato no trae manifiesto de sprites.'}));return;}
    const summary=make(doc,'div',{class:'kmf-sprite-summary'},[make(doc,'div',{class:'kmf-stat'},[make(doc,'b',{text:String(manifest.uniqueSprites||0)}),make(doc,'small',{text:'tipos'})]),make(doc,'div',{class:'kmf-stat'},[make(doc,'b',{text:String(manifest.totalInstances||0)}),make(doc,'small',{text:'usos'})]),make(doc,'div',{class:'kmf-stat'},[make(doc,'b',{text:String(manifest.needsGenerationTypes||0)}),make(doc,'small',{text:'faltan'})])]);
    const list=make(doc,'div',{class:'kmf-mini-list'});for(const sprite of manifest.sprites||[]){const missing=!!sprite.needsGeneration,badge=make(doc,'span',{class:`kmf-badge ${missing?'missing':'ready'}`,text:missing?'GENERAR':'LISTO'}),row=make(doc,'div',{class:'kmf-sprite-row'},[make(doc,'b',{text:sprite.label||sprite.semantic||sprite.key,title:sprite.key}),badge,make(doc,'small',{text:spriteSubtitle(sprite)})]);list.append(row);}
    const copy=make(doc,'button',{class:'kmf-btn kmf-copy',text:'COPIAR COLA DE ARTE'});copy.disabled=!(manifest.generationQueue||[]).length;copy.onclick=async()=>{const text=JSON.stringify(manifest.generationQueue||[],null,2);try{await root.navigator?.clipboard?.writeText?.(text);root.showToast?.('Cola de sprites copiada');}catch{root.showToast?.('No se pudo copiar la cola de sprites');}};
    spritesSection.replaceChildren(make(doc,'h3',{text:'SPRITES NECESARIOS'}),summary,list,copy);
  }
  function renderScenePlan(){
    const plan=selected?.sceneBuildPlan||[],list=make(doc,'div',{class:'kmf-mini-list'});for(const scene of plan){const missing=(scene.needsGeneration||[]).length,isArrival=scene.sceneType==='arrival',badge=make(doc,'span',{class:`kmf-badge ${isArrival?'arrival':missing?'missing':'ready'}`,text:isArrival?'LLEGADA':missing?`${missing} FALTAN`:'LISTA'}),row=make(doc,'div',{class:'kmf-scene-row'},[make(doc,'b',{text:sceneLabel(scene),title:scene.sceneId}),badge,make(doc,'small',{text:`${scene.kit||'kit'} · ${scene.memberCount||0} piezas · ${scene.district||'sin distrito'}`})]);list.append(row);}scenesSection.replaceChildren(make(doc,'h3',{text:'PLAN DE ESCENAS'}),plan.length?list:make(doc,'div',{class:'kmf-muted',text:'Sin escenas resueltas.'}));
  }
  function renderSelected(){
    if(!selected)return;
    scoreSection.replaceChildren(make(doc,'h3',{text:'SELECCIONADA'}),make(doc,'div',{class:'kmf-score',text:selected.quality.total.toFixed(2)}),make(doc,'div',{class:'kmf-muted',text:`Seed ${selected.metadata.seed} · ${selected.metadata.layoutHash}`}));
    const metrics=make(doc,'div',{class:'kmf-metrics'});for(const[k,v]of Object.entries(selected.quality.breakdown))metrics.append(make(doc,'div',{class:'kmf-metric'},[make(doc,'span',{text:METRICS[k]||k}),make(doc,'b',{text:Number(v).toFixed(1)})]));metricsSection.replaceChildren(make(doc,'h3',{text:'QUALITY'}),metrics);renderSpriteManifest();renderScenePlan();
    const exportButton=make(doc,'button',{class:'kmf-btn',text:'EXPORTAR JSON'}),exteriorButton=make(doc,'button',{class:'kmf-btn preview',text:'VER EN MAPA EXTERIOR'}),worldButton=make(doc,'button',{class:'kmf-btn primary',text:'ABRIR EN WORLD EDITOR'});
    const canHandoff=typeof onOpenWorld==='function'&&selected.validation.valid;exteriorButton.disabled=!canHandoff;worldButton.disabled=!canHandoff;
    exportButton.onclick=()=>exportJson(root,selected);exteriorButton.onclick=()=>void handoffExterior(exteriorButton);worldButton.onclick=()=>void handoffWorldEditor(worldButton);
    actionsSection.replaceChildren(make(doc,'h3',{text:'SALIDA'}),make(doc,'div',{class:'kmf-action-stack'},[exteriorButton,worldButton,exportButton]),make(doc,'div',{class:'kmf-action-help',text:'VER EN MAPA EXTERIOR carga este candidato como vista previa segura del borrador y deja Map Forge listo para volver sin regenerar.'}));
    candidateBar.querySelectorAll('.kmf-card').forEach(card=>card.classList.toggle('on',card.dataset.hash===selected.metadata.layoutHash));schedule();
  }
  function renderCandidates(){
    candidateBar.replaceChildren();
    for(const[map,i]of(result?.candidates||[]).map((item,index)=>[item,index])){const card=make(doc,'button',{class:'kmf-card','data-hash':map.metadata.layoutHash},[make(doc,'small',{text:`#${i+1} · Seed ${map.metadata.seed}`}),make(doc,'b',{text:`${map.quality.total.toFixed(2)} / 100`}),make(doc,'small',{text:`${map.districts.length} distritos · ${map.sceneBuildPlan?.length||0} escenas · ${map.spriteManifest?.needsGenerationTypes||0} sprites faltan`})]);card.onclick=()=>{selected=map;renderSelected();};candidateBar.append(card);}renderSelected();
  }
  async function generate(){
    if(busy)return;busy=true;generateButton.disabled=true;generateButton.textContent='GENERANDO…';status.style.color='';status.textContent=`Generando ${countSelect.value} candidatos · ${worker.mode}`;
    try{result=await worker.generate(recipeSelect.value,{seed:Number(seedInput.value)||1,count:Number(countSelect.value)||8,assetCatalogVersion:String(root.KELO_PROPERTY_CATALOG?.version||'creator-ui-v3'),style:styleOverrides()});selected=result.best;if(!selected)throw new Error('MAP_FORGE_NO_VALID_CANDIDATE');renderCandidates();status.textContent=`${result.validCount}/${result.requested} válidos · ${selected.sceneBuildPlan?.length||0} escenas · ${selected.spriteManifest?.uniqueSprites||0} tipos de sprite · ${selected.spriteManifest?.needsGenerationTypes||0} por generar · ${worker.mode}`;}
    catch(error){status.textContent=error?.message||String(error);status.style.color='#ff9d9d';}
    finally{busy=false;generateButton.disabled=false;generateButton.textContent='GENERAR';}
  }
  function destroy(){if(destroyed)return;if(active?.shell!==shell&&active!==null)return;destroyed=true;active=null;root.cancelAnimationFrame?.(raf);detachListeners();releaseInput();clearExteriorChrome();worker.close();shell.remove();style.remove();}
  close.onclick=destroy;generateButton.onclick=()=>void generate();reroll.onclick=()=>{seedInput.value=String(randomSeed(root));};recipeSelect.onchange=()=>{loadRecipeStyle();void generate();};loadRecipeStyle();acquireInput();attachListeners();
  active=Object.freeze({version:'kelo-map-forge-ui-v1.4.0',shell,worker,generate,get selected(){return selected;},get result(){return result;},get suspended(){return !shell.isConnected&&!destroyed;},resume:resumeWorkspace,close:destroy});
  await generate();return active;
}
export function closeMapForgeWorkspace(){active?.close?.();}
export function getMapForgeWorkspace(){return active;}
