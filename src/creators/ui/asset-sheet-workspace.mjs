/* KELO-INDEX
 * area: CREATORS / ASSET SHEET STUDIO UI
 * owner: Kelo Creator Asset Bridge
 * owns: mobile-first raw sheet review UI and local file handoff controls
 * does-not-own: pixel algorithms, image generation, remote APIs, asset persistence, map placement or runtime rendering
 * public-api: openAssetSheetWorkspace(), getAssetSheetWorkspace()
 * online: no; all analysis/export stays on-device and review crosses a user-controlled JSON/file bridge
 */
import {analyzeAssetSheetFile, renderAssetSheetPreview, exportAssetFramePng, exportCleanAtlasPng, exportCleanAtlasDataUrl} from '../assets/asset-sheet-browser.mjs';
import {applyAssetReviewPacket, buildReviewedAssetManifest, createAssetReviewPacket, createChatGPTReviewPrompt, parseAssetReviewText, serializeAssetReview} from '../assets/kelo-creator-asset-bridge.mjs';
import {installAssetSheetCatalogPreview} from '../assets/asset-sheet-catalog-preview-adapter.mjs';

const STYLE_ID = 'kelo-asset-sheet-studio-style';
const FAMILIES = ['tree','hedge','plant','planter','flower','rock','ground-cluster','structure','unknown'];
const LAYERS = ['ground','ground_variation','transitions','paths_floors','decals_details','props_back','props_front','vfx_weather_lighting'];
const CATEGORY_BY_FAMILY = Object.freeze({tree:'nature/tree',hedge:'nature/hedge',plant:'nature/plant',planter:'nature/planter',flower:'nature/flower',rock:'nature/rock','ground-cluster':'nature/detail',structure:'structure',unknown:'unknown'});
let active = null;

function css() { return `
  #kelo-asset-sheet-studio{position:fixed;inset:0;z-index:2147482200;background:#07090b;color:#f6f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
  #kelo-asset-sheet-studio *{box-sizing:border-box}
  .kas-head{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(9,13,15,.98)}
  .kas-mark{width:34px;height:34px;border:1px solid #d5b361;border-radius:9px;display:grid;place-items:center;color:#f3d787;font-weight:950}.kas-title{min-width:0}.kas-title strong{display:block;font-size:15px;letter-spacing:.08em}.kas-title small{display:block;color:#8fa29b;font-size:10px;margin-top:2px}.kas-close{margin-left:auto;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#141a1c;color:#fff;padding:9px 11px;font-weight:850}
  .kas-main{min-height:0;overflow:auto;padding:16px clamp(12px,3vw,28px) calc(36px + env(safe-area-inset-bottom))}.kas-intro{max-width:980px;margin:0 auto 13px;color:#aebbb6;font-size:12px;line-height:1.55}.kas-intro b{color:#f3d787}
  .kas-toolbar{max-width:980px;margin:0 auto 14px;display:flex;flex-wrap:wrap;gap:8px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:#0d1214}.kas-btn,.kas-file{min-height:42px;border:1px solid rgba(218,183,102,.34);border-radius:11px;background:#151d1f;color:#f8f4e9;padding:10px 13px;font-size:10px;font-weight:900;letter-spacing:.05em;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.kas-btn.primary{background:linear-gradient(135deg,#d1aa52,#9c762c);border-color:#e5c77d;color:#10100c}.kas-btn:disabled{opacity:.38;cursor:not-allowed}.kas-file input{display:none}
  .kas-status{flex:1 1 100%;min-height:23px;color:#8ea39a;font-size:10px;padding:3px 2px}.kas-status.error{color:#ffad9c}
  .kas-grid{max-width:980px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr);gap:14px;align-items:start}.kas-panel{border:1px solid rgba(255,255,255,.09);border-radius:16px;background:#0d1214;overflow:hidden}.kas-panel-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.08)}.kas-panel-head strong{font-size:11px;letter-spacing:.08em;color:#e8cd86}.kas-panel-head span{margin-left:auto;color:#81958d;font-size:9px}
  .kas-preview{position:relative;min-height:280px;background-color:#101718;background-image:linear-gradient(45deg,#182021 25%,transparent 25%),linear-gradient(-45deg,#182021 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#182021 75%),linear-gradient(-45deg,transparent 75%,#182021 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;display:grid;place-items:center;overflow:auto;padding:8px}.kas-stage{position:relative;display:inline-block;line-height:0;max-width:100%}.kas-stage canvas{display:block;max-width:100%;height:auto;image-rendering:pixelated}.kas-box{position:absolute;border:2px solid #f2ca66;background:rgba(242,202,102,.05);pointer-events:none}.kas-box span{position:absolute;left:-2px;top:-18px;min-width:22px;height:17px;line-height:17px;text-align:center;background:#f2ca66;color:#10110d;font:900 9px/17px Inter,sans-serif;border-radius:4px 4px 0 0}
  .kas-actions{display:flex;flex-wrap:wrap;gap:7px;padding:11px;border-top:1px solid rgba(255,255,255,.08)}.kas-actions .kas-btn,.kas-actions .kas-file{flex:1 1 145px}
  .kas-list{max-height:68vh;overflow:auto;padding:8px}.kas-empty{padding:30px 18px;color:#82958e;text-align:center;font-size:11px;line-height:1.5}.kas-row{display:grid;grid-template-columns:38px minmax(0,1fr);gap:9px;padding:10px 7px;border-bottom:1px solid rgba(255,255,255,.07)}.kas-number{width:34px;height:34px;border-radius:9px;background:#182224;color:#f1d079;display:grid;place-items:center;font-size:10px;font-weight:950}.kas-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px}.kas-fields input,.kas-fields select{min-width:0;width:100%;height:35px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#101719;color:#f5f4ef;padding:0 8px;font-size:9px}.kas-fields input{grid-column:1/-1}.kas-meta{display:flex;align-items:center;gap:7px;margin-top:7px;color:#839890;font-size:8px}.kas-meta .review{color:#ffc47f}.kas-export{margin-left:auto;border:0;background:transparent;color:#e4c16f;font-size:8px;font-weight:900;padding:5px;cursor:pointer}
  @media(max-width:820px){.kas-grid{grid-template-columns:1fr}.kas-preview{min-height:230px}.kas-list{max-height:none}.kas-head{padding-left:12px;padding-right:12px}.kas-title small{display:none}.kas-main{padding-left:10px;padding-right:10px}.kas-toolbar{position:sticky;top:0;z-index:4;box-shadow:0 10px 28px rgba(0,0,0,.25)}}
  @media(max-width:420px){.kas-toolbar .kas-btn,.kas-toolbar .kas-file{flex:1 1 calc(50% - 8px)}.kas-grid{gap:10px}.kas-panel{border-radius:13px}}
`; }

function el(document, tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('aria-')) node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of [].concat(children || [])) if (child) node.append(child);
  return node;
}

function slug(value, fallback = 'asset-sheet') {
  const normalized = String(value || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function downloadBlob(root, blob, name) {
  const url = root.URL.createObjectURL(blob);
  const anchor = root.document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.hidden = true;
  root.document.body.append(anchor); anchor.click(); anchor.remove();
  root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
}

function downloadJson(root, value, name) {
  downloadBlob(root, new Blob([serializeAssetReview(value)], {type:'application/json'}), name);
}

async function copyText(root, value) {
  if (root.navigator?.clipboard?.writeText) return root.navigator.clipboard.writeText(value);
  const field = root.document.createElement('textarea');
  field.value = value; field.style.position = 'fixed'; field.style.opacity = '0';
  root.document.body.append(field); field.select(); root.document.execCommand('copy'); field.remove();
}

export async function openAssetSheetWorkspace({root=globalThis, openWorkspace=null} = {}) {
  if (active) return active;
  const document = root.document;
  if (!document?.body) throw new Error('ASSET_SHEET_STUDIO_DOM_REQUIRED');
  document.getElementById(STYLE_ID)?.remove();
  const style = el(document, 'style', {id:STYLE_ID, textContent:css()});
  document.head.append(style);
  const inputLock = root.KeloInputLocks?.acquire?.('asset-sheet-studio', {surface:'creator'}) || null;
  let file = null, analysis = null, busy = false;

  const shell = el(document, 'section', {id:'kelo-asset-sheet-studio'});
  shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true'); shell.setAttribute('aria-label', 'Asset Sheet Studio');
  const close = el(document, 'button', {class:'kas-close', text:'CLOSE', 'aria-label':'Cerrar Asset Sheet Studio'});
  shell.append(el(document, 'header', {class:'kas-head'}, [
    el(document, 'div', {class:'kas-mark', text:'AS'}),
    el(document, 'div', {class:'kas-title'}, [el(document, 'strong', {text:'ASSET SHEET STUDIO'}), el(document, 'small', {text:'Crudo → detectar → clasificar → galería / prefab'})]),
    close
  ]));
  const main = el(document, 'main', {class:'kas-main'});
  main.append(el(document, 'p', {class:'kas-intro'}, [document.createTextNode('Carga la hoja cruda que generamos. El análisis ocurre '), el(document, 'b', {text:'dentro del dispositivo'}), document.createTextNode('; el puente conmigo es un archivo JSON revisable, sin API.') ]));

  const imageInput = el(document, 'input', {type:'file', accept:'image/png,image/webp,image/jpeg'});
  const reviewInput = el(document, 'input', {type:'file', accept:'.json,application/json'});
  const analyzeButton = el(document, 'button', {class:'kas-btn primary', text:'ANALYZE SHEET', disabled:true});
  const copyPromptButton = el(document, 'button', {class:'kas-btn', text:'COPY CHATGPT PROMPT', disabled:true});
  const status = el(document, 'div', {class:'kas-status', text:'Selecciona PNG, WebP o JPEG. También reconoce una captura con bordes negros y aparta ruido de interfaz.'});
  const toolbar = el(document, 'section', {class:'kas-toolbar'}, [
    el(document, 'label', {class:'kas-file', text:'LOAD RAW SHEET'}, imageInput), analyzeButton, copyPromptButton, status
  ]);
  main.append(toolbar);

  const preview = el(document, 'div', {class:'kas-preview'}, el(document, 'div', {class:'kas-empty', text:'La vista limpia y los recuadros numerados aparecerán aquí.'}));
  const previewCount = el(document, 'span', {text:'NO ANALYSIS'});
  const packetButton = el(document, 'button', {class:'kas-btn', text:'DOWNLOAD REVIEW JSON', disabled:true});
  const atlasButton = el(document, 'button', {class:'kas-btn', text:'DOWNLOAD CLEAN ATLAS', disabled:true});
  const manifestButton = el(document, 'button', {class:'kas-btn primary', text:'EXPORT GALLERIES', disabled:true});
  const worldButton = el(document, 'button', {class:'kas-btn primary', text:'OPEN IN WORLD', disabled:true});
  const importReviewLabel = el(document, 'label', {class:'kas-file', text:'IMPORT CHATGPT JSON'}, reviewInput);
  importReviewLabel.style.opacity = '.38'; importReviewLabel.style.pointerEvents = 'none';
  const previewPanel = el(document, 'section', {class:'kas-panel'}, [
    el(document, 'div', {class:'kas-panel-head'}, [el(document, 'strong', {text:'DETECTION'}), previewCount]), preview,
    el(document, 'div', {class:'kas-actions'}, [packetButton, importReviewLabel, atlasButton, manifestButton, worldButton])
  ]);
  const list = el(document, 'div', {class:'kas-list'}, el(document, 'div', {class:'kas-empty', text:'Después de analizar podrás corregir nombres y categorías o importar mi revisión JSON.'}));
  const listCount = el(document, 'span', {text:'0 ASSETS'});
  const listPanel = el(document, 'section', {class:'kas-panel'}, [el(document, 'div', {class:'kas-panel-head'}, [el(document, 'strong', {text:'ASSET GALLERY'}), listCount]), list]);
  main.append(el(document, 'div', {class:'kas-grid'}, [previewPanel, listPanel]));
  shell.append(main); document.body.append(shell);

  const controls = [analyzeButton, copyPromptButton, packetButton, atlasButton, manifestButton, worldButton];
  function setStatus(message, error = false) { status.textContent = message; status.className = `kas-status${error ? ' error' : ''}`; }
  function setBusy(value) { busy = !!value; for (const control of controls) control.disabled = busy || (!analysis && control !== analyzeButton); analyzeButton.disabled = busy || !file; imageInput.disabled = busy; reviewInput.disabled = busy || !analysis; importReviewLabel.style.opacity = analysis && !busy ? '1' : '.38'; importReviewLabel.style.pointerEvents = analysis && !busy ? 'auto' : 'none'; }

  function updateAsset(assetId, patch) {
    const current = analysis.assets.find(asset => asset.assetId === assetId);
    if (!current) return;
    const nextFamily = patch.family || current.family;
    analysis = applyAssetReviewPacket(analysis, {kind:'kelo-asset-review-result', version:'kelo-asset-review-v1', assets:[{
      assetId, name:patch.name || current.label, family:nextFamily, category:patch.category || CATEGORY_BY_FAMILY[nextFamily] || current.category,
      layer:patch.layer || current.layer, confidence:patch.confidence == null ? 1 : patch.confidence, notes:'Ajustado manualmente en Asset Sheet Studio'
    }]});
    renderAnalysis();
  }

  function renderAnalysis() {
    preview.replaceChildren(); list.replaceChildren();
    if (!analysis) {
      preview.append(el(document, 'div', {class:'kas-empty', text:'La vista limpia y los recuadros numerados aparecerán aquí.'}));
      list.append(el(document, 'div', {class:'kas-empty', text:'Después de analizar podrás corregir nombres y categorías o importar mi revisión JSON.'}));
      previewCount.textContent = 'NO ANALYSIS'; listCount.textContent = '0 ASSETS'; setBusy(false); return;
    }
    const canvas = renderAssetSheetPreview(analysis, {root});
    const stage = el(document, 'div', {class:'kas-stage'}, canvas);
    for (let index = 0; index < analysis.assets.length; index += 1) {
      const asset = analysis.assets[index], rect = asset.sourceRect;
      stage.append(el(document, 'div', {class:'kas-box', style:{left:`${rect.x / analysis.width * 100}%`, top:`${rect.y / analysis.height * 100}%`, width:`${rect.w / analysis.width * 100}%`, height:`${rect.h / analysis.height * 100}%`}}, el(document, 'span', {text:String(index + 1)})));
    }
    preview.append(stage);
    for (let index = 0; index < analysis.assets.length; index += 1) {
      const asset = analysis.assets[index];
      const name = el(document, 'input', {value:asset.label, maxLength:80, 'aria-label':`Nombre del asset ${index + 1}`});
      const family = el(document, 'select', {'aria-label':`Familia del asset ${index + 1}`}, FAMILIES.map(value => el(document, 'option', {value, text:value, selected:value === asset.family})));
      const layer = el(document, 'select', {'aria-label':`Capa del asset ${index + 1}`}, LAYERS.map(value => el(document, 'option', {value, text:value, selected:value === asset.layer})));
      name.onchange = () => updateAsset(asset.assetId, {name:name.value});
      family.onchange = () => updateAsset(asset.assetId, {family:family.value, category:CATEGORY_BY_FAMILY[family.value]});
      layer.onchange = () => updateAsset(asset.assetId, {layer:layer.value});
      const exportButton = el(document, 'button', {class:'kas-export', text:'EXPORT PNG'});
      exportButton.onclick = async () => {
        try { exportButton.disabled = true; const blob = await exportAssetFramePng(analysis, asset.frameId, {root}); downloadBlob(root, blob, `${slug(asset.label, asset.frameId)}.png`); }
        catch (error) { setStatus(String(error?.message || error), true); }
        finally { exportButton.disabled = false; }
      };
      list.append(el(document, 'article', {class:'kas-row'}, [
        el(document, 'div', {class:'kas-number', text:String(index + 1)}),
        el(document, 'div', {}, [el(document, 'div', {class:'kas-fields'}, [name, family, layer]), el(document, 'div', {class:'kas-meta'}, [
          el(document, 'span', {class:asset.classification.needsReview ? 'review' : '', text:`${Math.round(asset.classification.confidence * 100)}% · ${asset.sourceRect.w}×${asset.sourceRect.h} · row ${asset.rowIndex + 1}`}), exportButton
        ])])
      ]));
    }
    const noise = analysis.stats.interfaceNoiseDetected ? ' · chrome/ruido exterior apartado' : '';
    previewCount.textContent = `${analysis.assets.length} BOXES · ${analysis.stats.rowCount} ROWS`;
    listCount.textContent = `${analysis.assets.length} ASSETS`;
    setStatus(`${analysis.assets.length} assets detectados · fondo ${analysis.background.mode}${noise}`);
    setBusy(false);
  }

  imageInput.onchange = () => {
    file = imageInput.files?.[0] || null; analysis = null;
    setStatus(file ? `${file.name} listo para analizar.` : 'Selecciona una imagen.');
    renderAnalysis();
  };
  analyzeButton.onclick = async () => {
    if (!file || busy) return;
    setBusy(true); setStatus('Analizando píxeles, fondo, grupos y anclas…');
    try {
      analysis = await analyzeAssetSheetFile(file, {root, options:{detectInterfaceNoise:true}});
      if (!analysis.assets.length) throw new Error('NO_ASSETS_DETECTED');
      renderAnalysis();
    } catch (error) { analysis = null; setStatus(String(error?.message || error), true); renderAnalysis(); }
    finally { setBusy(false); }
  };
  copyPromptButton.onclick = async () => {
    try { await copyText(root, createChatGPTReviewPrompt(createAssetReviewPacket(analysis, {sourceName:file?.name}))); setStatus('Prompt copiado. Adjunta la imagen original y el review JSON en ChatGPT.'); }
    catch (error) { setStatus(String(error?.message || error), true); }
  };
  packetButton.onclick = () => downloadJson(root, createAssetReviewPacket(analysis, {sourceName:file?.name}), `${slug(file?.name)}-review.json`);
  reviewInput.onchange = async () => {
    const reviewFile = reviewInput.files?.[0]; if (!reviewFile) return;
    try { analysis = applyAssetReviewPacket(analysis, parseAssetReviewText(await reviewFile.text())); renderAnalysis(); setStatus(`${analysis.review.accepted} clasificaciones aplicadas · ${analysis.review.warnings.length} avisos.`); }
    catch (error) { setStatus(String(error?.message || error), true); }
    reviewInput.value = '';
  };
  atlasButton.onclick = async () => {
    try { atlasButton.disabled = true; const blob = await exportCleanAtlasPng(analysis, {root}); downloadBlob(root, blob, `${slug(file?.name)}-clean-atlas.png`); setStatus('Atlas PNG limpio exportado.'); }
    catch (error) { setStatus(String(error?.message || error), true); }
    finally { atlasButton.disabled = false; }
  };
  manifestButton.onclick = () => {
    const base = slug(file?.name);
    const manifest = buildReviewedAssetManifest(analysis, null, {source:{sourceName:file?.name || 'asset-sheet.png', sourcePath:`assets/creator/${base}-clean-atlas.png`, atlasId:`${base}-atlas-v1`}});
    downloadJson(root, manifest, `${base}-manifest.json`);
    setStatus(`${manifest.galleries.length} galerías y ${manifest.prefabs.length} prefabs sugeridos exportados.`);
  };
  worldButton.onclick = async () => {
    if (typeof openWorkspace !== 'function') return setStatus('El World Editor no está disponible en este contexto.', true);
    setBusy(true); setStatus('Registrando la galería como borrador y abriendo World…');
    try {
      const base = slug(file?.name), manifest = buildReviewedAssetManifest(analysis, null, {source:{sourceName:file?.name || 'asset-sheet.png', atlasId:`${base}-atlas-v1`}});
      const draft = installAssetSheetCatalogPreview({root, manifest, atlasDataUrl:exportCleanAtlasDataUrl(analysis, {root})});
      await openWorkspace('world', {creatorAssetDraft:draft, preferredAssetId:draft.templateIds[0] || null});
      destroy();
    } catch (error) { setStatus(String(error?.message || error), true); setBusy(false); }
  };

  function destroy() {
    if (active?.shell !== shell) return;
    active = null; shell.remove(); style.remove(); document.removeEventListener('keydown', onKey, true);
    if (inputLock) root.KeloInputLocks?.release?.(inputLock);
  }
  const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); destroy(); } };
  close.onclick = destroy; document.addEventListener('keydown', onKey, true);
  active = Object.freeze({version:'kelo-asset-sheet-studio-v1', shell, close:destroy, get analysis(){ return analysis; }});
  setBusy(false);
  return active;
}

export function getAssetSheetWorkspace() { return active; }
