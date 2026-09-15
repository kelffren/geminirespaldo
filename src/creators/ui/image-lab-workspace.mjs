/* KELO-INDEX
 * area: CREATORS / IMAGE LAB UI
 * owner: Kelo Creator Assets Image Lab workspace UI
 * keys: IMAGE LAB MOBILE JPG PNG WEBP ORIGINAL WORKING RESET TRIM ALPHA PIXEL RESIZE EXPORT
 * purpose: let creators import one image, preserve its original bytes, apply replayable working operations and export derivatives
 * public-api: openImageLabWorkspace
 * consumes: image-lab-project, image-format-converter, image-lab-source-store
 * state-owned: ephemeral UI selection only
 * online: local authoring now; source/project adapters can move to creator-private revisions later
 * do-not: overwrite source bytes, mutate runtime assets, publish automatically or hide lossy-export warnings
 */
import {createImageLabProject,appendImageLabOperation,resetImageLabWorkingCopy,createImageLabRevision,withImageLabExport} from '../assets/image-lab-project.mjs';
import {exportImageLabBlob,buildImageExportName,imageExportPolicy} from '../assets/image-format-converter.mjs';
import {createImageLabSourceStore} from '../assets/image-lab-source-store.mjs';
let active=null;

const css=()=>`
#kelo-image-lab{position:fixed;inset:0;z-index:2147482600;background:#090a0d;color:#f5f2e9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;grid-template-rows:auto minmax(0,1fr)}
#kelo-image-lab *{box-sizing:border-box}.kil-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #292b31;background:#111318}.kil-head strong{letter-spacing:.12em}.kil-head small{display:block;color:#8e929b;font-size:10px;margin-top:2px}.kil-close{margin-left:auto;border:1px solid #343740;background:#181b21;color:#fff;border-radius:10px;padding:9px 12px;font-weight:800}.kil-main{min-height:0;overflow:auto;padding:14px;display:grid;gap:12px;grid-template-columns:minmax(0,1.5fr) minmax(280px,.8fr)}.kil-card{border:1px solid #292c33;background:#111319;border-radius:16px;padding:12px}.kil-preview{min-height:48vh;display:grid;place-items:center;position:relative;overflow:hidden;background-image:linear-gradient(45deg,#1a1c22 25%,transparent 25%),linear-gradient(-45deg,#1a1c22 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1c22 75%),linear-gradient(-45deg,transparent 75%,#1a1c22 75%);background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0}.kil-preview img{max-width:100%;max-height:68vh;image-rendering:auto;object-fit:contain}.kil-empty{color:#8c9099;text-align:center;max-width:280px}.kil-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.kil-btn,.kil-select{border:1px solid #363a43;background:#191c22;color:#f7f4eb;border-radius:10px;padding:9px 11px;font-weight:750}.kil-btn.primary{border-color:#b89a58;background:#3a3020;color:#ffe8ae}.kil-btn.danger{border-color:#6b4040;color:#ffc4bc}.kil-btn:disabled{opacity:.45}.kil-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.kil-meta{font-size:11px;color:#a5a8af;line-height:1.55}.kil-meta b{color:#e7d6a6}.kil-section{margin-top:14px}.kil-section h3{font-size:11px;letter-spacing:.14em;color:#c8aa66;margin:0 0 8px}.kil-op{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #24272d;font-size:11px}.kil-status{font-size:11px;color:#b7bbc4;min-height:18px}.kil-recent button{width:100%;text-align:left;margin:5px 0;border:1px solid #2c3038;background:#14171c;color:#fff;border-radius:10px;padding:9px}.kil-source-lock{display:inline-flex;align-items:center;gap:5px;border:1px solid #3d6649;color:#bdf4c9;background:#173120;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;letter-spacing:.06em}
@media(max-width:780px){.kil-main{grid-template-columns:1fr;padding:10px}.kil-preview{min-height:43vh}.kil-card.controls{order:-1}.kil-head small{display:none}.kil-btn,.kil-select{min-height:42px}.kil-toolbar{gap:6px}}
`;
function el(doc,tag,props={},children=[]){const node=doc.createElement(tag);for(const [key,value] of Object.entries(props)){if(key==='class')node.className=value;else if(key==='text')node.textContent=value;else if(key==='html')node.innerHTML=value;else if(key.startsWith('data-'))node.setAttribute(key,value);else node[key]=value;}for(const child of [].concat(children||[]))if(child)node.append(child);return node;}
function bytes(value){const n=Math.max(0,Number(value)||0);if(n<1024)return `${n} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024**2).toFixed(2)} MB`;}
function probe(root,blob){return new Promise((resolve,reject)=>{const url=root.URL.createObjectURL(blob),img=new root.Image();img.onload=()=>{const out={width:img.naturalWidth||img.width,height:img.naturalHeight||img.height};root.URL.revokeObjectURL(url);resolve(out);};img.onerror=()=>{root.URL.revokeObjectURL(url);reject(new Error('IMAGE_LAB_IMAGE_INVALID'));};img.src=url;});}
function download(root,blob,name){const url=root.URL.createObjectURL(blob),a=root.document.createElement('a');a.href=url;a.download=name;a.style.display='none';root.document.body.append(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),1500);}

export async function openImageLabWorkspace({root=globalThis}={}){
  if(active)return active;if(!root.document)throw new Error('IMAGE_LAB_DOM_REQUIRED');
  const doc=root.document,store=createImageLabSourceStore({indexedDBFactory:root.indexedDB}),lock=root.KeloInputLocks?.acquire?.('image-lab',{kind:'creator-workspace'})||null;
  const style=el(doc,'style',{textContent:css()}),panel=el(doc,'section',{id:'kelo-image-lab'}),head=el(doc,'header',{class:'kil-head'}),title=el(doc,'div',{},[el(doc,'strong',{text:'KELO IMAGE LAB'}),el(doc,'small',{text:'Original bloqueado · working copy reconstruible · export derivados'})]),close=el(doc,'button',{class:'kil-close',text:'CLOSE'});head.append(title,close);
  const main=el(doc,'main',{class:'kil-main'}),previewCard=el(doc,'section',{class:'kil-card'}),preview=el(doc,'div',{class:'kil-preview'}),previewToolbar=el(doc,'div',{class:'kil-toolbar'}),originalBtn=el(doc,'button',{class:'kil-btn',text:'ORIGINAL'}),workingBtn=el(doc,'button',{class:'kil-btn primary',text:'WORKING'});previewToolbar.append(originalBtn,workingBtn);previewCard.append(preview,previewToolbar);
  const controls=el(doc,'aside',{class:'kil-card controls'}),sourceLock=el(doc,'span',{class:'kil-source-lock',text:'🔒 ORIGINAL INMUTABLE'}),status=el(doc,'div',{class:'kil-status',text:'Sube una imagen para comenzar.'}),meta=el(doc,'div',{class:'kil-meta'}),fileInput=el(doc,'input',{type:'file',accept:'image/png,image/jpeg,image/webp'});fileInput.hidden=true;
  const importBtn=el(doc,'button',{class:'kil-btn primary',text:'SUBIR IMAGEN'}),resetBtn=el(doc,'button',{class:'kil-btn danger',text:'RESET ORIGINAL',disabled:true}),revisionBtn=el(doc,'button',{class:'kil-btn',text:'GUARDAR REVISIÓN',disabled:true}),topRow=el(doc,'div',{class:'kil-toolbar'},[importBtn,resetBtn,revisionBtn]);
  const toolsTitle=el(doc,'h3',{text:'HERRAMIENTAS'}),tools=el(doc,'div',{class:'kil-toolbar'}),trimBtn=el(doc,'button',{class:'kil-btn',text:'TRIM ALPHA',disabled:true}),alphaBtn=el(doc,'button',{class:'kil-btn',text:'LIMPIAR ALPHA',disabled:true}),upBtn=el(doc,'button',{class:'kil-btn',text:'2× PIXEL',disabled:true}),downBtn=el(doc,'button',{class:'kil-btn',text:'½× PIXEL',disabled:true}),rotateBtn=el(doc,'button',{class:'kil-btn',text:'↻ 90°',disabled:true}),flipBtn=el(doc,'button',{class:'kil-btn',text:'⇆ FLIP',disabled:true});tools.append(trimBtn,alphaBtn,upBtn,downBtn,rotateBtn,flipBtn);
  const exportTitle=el(doc,'h3',{text:'EXPORTAR / CONVERTIR'}),format=el(doc,'select',{class:'kil-select'});for(const [value,label] of [['png','PNG · sin nueva compresión con pérdida'],['webp','WebP'],['jpeg','JPG · con pérdida']])format.append(el(doc,'option',{value,text:label}));const exportBtn=el(doc,'button',{class:'kil-btn primary',text:'EXPORT',disabled:true}),exportRow=el(doc,'div',{class:'kil-row'},[format,exportBtn]);
  const operationsBox=el(doc,'div'),recentBox=el(doc,'div',{class:'kil-recent'});
  controls.append(sourceLock,fileInput,topRow,status,meta,el(doc,'div',{class:'kil-section'},[toolsTitle,tools]),el(doc,'div',{class:'kil-section'},[exportTitle,exportRow]),operationsBox,recentBox);main.append(previewCard,controls);panel.append(head,main);doc.head.append(style);doc.body.append(panel);

  let project=null,sourceBlob=null,view='working',previewUrl=null,busy=false;
  const toolButtons=[resetBtn,revisionBtn,trimBtn,alphaBtn,upBtn,downBtn,rotateBtn,flipBtn,exportBtn];
  const setBusy=value=>{busy=!!value;importBtn.disabled=busy;for(const button of toolButtons)button.disabled=busy||!project;format.disabled=busy||!project;};
  const setStatus=(message,error=false)=>{status.textContent=message;status.style.color=error?'#ffb6a8':'#b7bbc4';};
  function clearPreviewUrl(){if(previewUrl){root.URL.revokeObjectURL(previewUrl);previewUrl=null;}}
  function renderMeta(){
    if(!project){meta.textContent='';operationsBox.replaceChildren();return;}
    meta.innerHTML=`<b>${project.source.name}</b><br>${bytes(project.source.size)} · ${project.source.mimeType}<br>${project.source.width||'?'}×${project.source.height||'?'} · sourceId ${project.source.sourceId}<br>Operaciones: ${project.working.operations.length} · Revisiones: ${project.revisions.length}`;
    const section=el(doc,'div',{class:'kil-section'},[el(doc,'h3',{text:'WORKING STACK'})]);
    if(!project.working.operations.length)section.append(el(doc,'div',{class:'kil-meta',text:'Sin cambios. Working = Original.'}));
    else project.working.operations.forEach((op,index)=>section.append(el(doc,'div',{class:'kil-op'},[el(doc,'span',{text:`${index+1}. ${op.type}`}),el(doc,'span',{text:JSON.stringify(op.params)})])));
    operationsBox.replaceChildren(section);
  }
  async function renderPreview(){
    clearPreviewUrl();preview.replaceChildren();if(!project||!sourceBlob){preview.append(el(doc,'div',{class:'kil-empty',text:'SUBE PNG, JPG O WEBP. El original se guarda bloqueado y cada resultado se reconstruye desde esa fuente.'}));return;}
    try{
      let blob=sourceBlob;if(view==='working'){const rendered=await exportImageLabBlob(root,sourceBlob,project,{format:'png',quality:1});blob=rendered.blob;}
      previewUrl=root.URL.createObjectURL(blob);const image=el(doc,'img',{src:previewUrl,alt:view==='original'?'Original image':'Working image'});preview.append(image);originalBtn.className=`kil-btn ${view==='original'?'primary':''}`;workingBtn.className=`kil-btn ${view==='working'?'primary':''}`;renderMeta();
    }catch(error){setStatus(error?.message||'No se pudo renderizar.',true);}
  }
  async function persist(){if(project)await store.saveProject(project);await renderRecent();}
  async function useProject(next,blob){project=next;sourceBlob=blob;view='working';setBusy(false);format.value=project.export?.format||'png';renderMeta();await renderPreview();}
  async function importFile(file){
    if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type||'')){setStatus('Formato no soportado. Usa PNG, JPG/JPEG o WebP.',true);return;}
    setBusy(true);setStatus('Leyendo original…');try{const dimensions=await probe(root,file),next=createImageLabProject({name:file.name.replace(/\.[^.]+$/,''),source:{name:file.name,mimeType:file.type,size:file.size,lastModified:file.lastModified,width:dimensions.width,height:dimensions.height}});await store.saveOriginal(next.source.sourceId,file,next.source);await store.saveProject(next);await useProject(next,file);setStatus('Original guardado e inmutable. Working copy lista.');}
    catch(error){setStatus(error?.message||'No se pudo importar.',true);}finally{setBusy(false);}
  }
  async function addOperation(type,params){if(!project||busy)return;setBusy(true);try{project=appendImageLabOperation(project,{type,params});await persist();view='working';await renderPreview();setStatus(`Aplicado ${type}. El original no cambió.`);}catch(error){setStatus(error?.message||'Operación falló.',true);}finally{setBusy(false);}}
  async function reset(){if(!project||busy)return;project=resetImageLabWorkingCopy(project);await persist();view='working';await renderPreview();setStatus('Working copy reconstruida desde el original.');}
  async function saveRevision(){if(!project||busy)return;project=createImageLabRevision(project,{label:`Revision ${project.revisions.length+1}`});await persist();renderMeta();setStatus(`Revisión ${project.revisions.length} guardada.`);}
  async function doExport(){
    if(!project||!sourceBlob||busy)return;setBusy(true);try{project=withImageLabExport(project,{format:format.value,quality:.94});await persist();const output=await exportImageLabBlob(root,sourceBlob,project,{format:format.value,quality:.94}),name=buildImageExportName(project.source.name,format.value,{suffix:'kelo'});download(root,output.blob,name);setStatus(`${name} · ${bytes(output.blob.size)}. ${output.lossPolicy.description}`);}
    catch(error){setStatus(error?.message||'Export falló.',true);}finally{setBusy(false);}
  }
  async function renderRecent(){
    const rows=await store.listProjects();const section=el(doc,'div',{class:'kil-section'},[el(doc,'h3',{text:'RECIENTES'})]);if(!rows.length)section.append(el(doc,'div',{class:'kil-meta',text:'Todavía no hay proyectos guardados.'}));
    for(const row of rows.slice(0,6)){const button=el(doc,'button',{text:`${row.name} · ${row.working?.operations?.length||0} ops`});button.onclick=async()=>{if(busy)return;setBusy(true);try{const record=await store.loadOriginal(row.source.sourceId);if(!record?.blob)throw new Error('IMAGE_LAB_ORIGINAL_NOT_FOUND');await useProject(row,record.blob);setStatus('Proyecto restaurado desde su original guardado.');}catch(error){setStatus(error?.message||'No se pudo restaurar.',true);}finally{setBusy(false);}};section.append(button);}recentBox.replaceChildren(section);
  }
  async function destroy(){clearPreviewUrl();try{await store.close();}catch{}try{if(lock)root.KeloInputLocks?.release?.(lock);}catch{}panel.remove();style.remove();active=null;}

  importBtn.onclick=()=>fileInput.click();fileInput.onchange=()=>void importFile(fileInput.files?.[0]);originalBtn.onclick=()=>{view='original';void renderPreview();};workingBtn.onclick=()=>{view='working';void renderPreview();};resetBtn.onclick=()=>void reset();revisionBtn.onclick=()=>void saveRevision();trimBtn.onclick=()=>void addOperation('trim-alpha',{threshold:0,padding:2});alphaBtn.onclick=()=>void addOperation('alpha-snap',{transparentBelow:8,opaqueAbove:248});upBtn.onclick=()=>void addOperation('resize',{scale:2,mode:'pixel-perfect'});downBtn.onclick=()=>void addOperation('resize',{scale:.5,mode:'pixel-perfect'});rotateBtn.onclick=()=>void addOperation('rotate',{quarterTurns:1});flipBtn.onclick=()=>void addOperation('flip',{horizontal:true});exportBtn.onclick=()=>void doExport();format.onchange=()=>{const policy=imageExportPolicy(format.value);setStatus(policy.description);};close.onclick=()=>void destroy();
  await renderRecent();await renderPreview();setBusy(false);
  active=Object.freeze({root:panel,destroy,get project(){return project;},get sourceBlob(){return sourceBlob;}});return active;
}
