/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / REPAIR STUDIO
 * owner: manual per-frame sprite repair over the canonical Sprite Ability Builder
 * keys: REPAIR MOVE SCALE DELETE DUPLICATE REORDER TRIM ERASER PIVOT ONION REPLACE ALIGN PREVIEW MOBILE
 * purpose: repair bad generated sprites by hand, bake the corrected frames back into one uniform spritesheet, then return it to Sprite Ability
 * does-not-own: combat math, persistence, runtime animation authority or generated Ability/Animation drafts
 */
const STYLE_ID='kelo-sprite-repair-v1-style';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const make=(doc,tag,cls,text='')=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const copyCanvas=(doc,source)=>{const c=doc.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);return c;};
const toast=(root,msg)=>typeof root.showToast==='function'?root.showToast(msg):console.info('[Sprite Repair]',msg);
const sleep=(root,ms)=>new Promise(resolve=>root.setTimeout(resolve,ms));
let disposed=false,rootRef=null,observer=null,style=null,state=null,controllerPromise=null;

const controller=()=>controllerPromise||(controllerPromise=import('./sprite-ability-live-controller.mjs'));
async function builder(){return (await controller()).getSpriteAbilityBuilder?.()||null;}
function loadImage(root,url){return new Promise((resolve,reject)=>{const image=new root.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('SPRITE_REPAIR_IMAGE_INVALID'));image.src=url;});}
function readFile(root,file){return new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('SPRITE_REPAIR_READ_FAILED'));reader.readAsDataURL(file);});}
function canvasBlob(root,canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('SPRITE_REPAIR_PNG_FAILED')),'image/png'));}

export function alphaBoundsFromImageData(data,width,height,threshold=4){
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(data[(y*width+x)*4+3]>threshold){if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}}
  return maxX<minX?{x:0,y:0,width,height,empty:true}:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,empty:false};
}
function alphaBounds(frame){
  const c=frame.canvas,ctx=c.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,c.width,c.height);
  return alphaBoundsFromImageData(image.data,c.width,c.height);
}
export function reorderItems(items,from,to){
  const next=[...items],a=Math.max(0,Math.min(next.length-1,from|0)),b=Math.max(0,Math.min(next.length-1,to|0));
  if(a===b)return next;const [item]=next.splice(a,1);next.splice(b,0,item);return next;
}
function frameRect(sheet,index){
  const col=index%sheet.columns,row=Math.floor(index/sheet.columns);
  return{x:col*(sheet.frameWidth+(sheet.spacingX||0)),y:row*(sheet.frameHeight+(sheet.spacingY||0)),width:sheet.frameWidth,height:sheet.frameHeight};
}
function cloneFrame(doc,frame){
  return{...frame,id:`repair_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,canvas:copyCanvas(doc,frame.canvas),crop:{...frame.crop}};
}
function trimFrame(frame){
  const b=alphaBounds(frame);frame.crop=b.empty?{x:0,y:0,width:frame.canvas.width,height:frame.canvas.height}:{x:b.x,y:b.y,width:b.width,height:b.height};
  frame.pivotX=.5;frame.pivotY=1;return b;
}
function drawFrameCell(doc,frame,cellW,cellH){
  const out=doc.createElement('canvas');out.width=cellW;out.height=cellH;const ctx=out.getContext('2d'),c=frame.crop;
  const dw=Math.max(1,c.width*frame.scale),dh=Math.max(1,c.height*frame.scale);
  const x=cellW*.5+frame.tx-frame.pivotX*dw,y=cellH+frame.ty-frame.pivotY*dh;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(frame.canvas,c.x,c.y,c.width,c.height,x,y,dw,dh);return out;
}
function sourcePointFromCell(frame,cellW,cellH,x,y){
  const c=frame.crop,dw=Math.max(1,c.width*frame.scale),dh=Math.max(1,c.height*frame.scale);
  const left=cellW*.5+frame.tx-frame.pivotX*dw,top=cellH+frame.ty-frame.pivotY*dh;
  return{x:c.x+(x-left)/Math.max(.001,frame.scale),y:c.y+(y-top)/Math.max(.001,frame.scale),left,top,dw,dh};
}
function ensureStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  style=make(doc,'style');style.id=STYLE_ID;style.textContent=`
.sab-repair-launch{width:100%;min-height:46px;margin:7px 0;border:1px solid rgba(255,193,77,.62);border-radius:12px;background:linear-gradient(135deg,rgba(136,88,10,.18),rgba(4,16,24,.98));color:#ffe49a;font:950 8px system-ui;letter-spacing:.08em}
.sab-repair-launch:disabled{opacity:.4}
.sab-repair{position:fixed;inset:0;z-index:2147483630;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#030a0f;color:#e9f2f5;font-family:system-ui,-apple-system,sans-serif}
.sr-head{display:flex;align-items:center;gap:8px;padding:max(8px,env(safe-area-inset-top)) 9px 8px;border-bottom:1px solid rgba(255,255,255,.1);background:#07131b}.sr-head-copy{min-width:0;flex:1}.sr-head b{display:block;color:#ffe18a;font-size:12px;letter-spacing:.08em}.sr-head small{display:block;color:#7e949f;font:700 7px/1.35 system-ui}.sr-head button,.sr-foot button,.sr-tools button,.sr-actions button{min-height:38px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0a1a23;color:#e2edf1;font:850 7px system-ui;padding:0 9px}.sr-head .apply,.sr-foot .apply{border-color:rgba(238,196,82,.7);color:#ffeba5;background:rgba(238,196,82,.08)}
.sr-body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:8px;padding:8px}.sr-main{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;border:1px solid rgba(255,255,255,.09);border-radius:14px;overflow:hidden;background:#071119}.sr-stage-wrap{min-height:0;position:relative;display:grid;place-items:center;overflow:hidden;background-image:linear-gradient(45deg,#0b151b 25%,transparent 25%),linear-gradient(-45deg,#0b151b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0b151b 75%),linear-gradient(-45deg,transparent 75%,#0b151b 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.sr-stage{width:min(76vh,100%);height:min(76vh,100%);max-width:640px;max-height:640px;touch-action:none}.sr-mode{position:absolute;left:8px;top:8px;display:flex;gap:4px;z-index:4}.sr-mode button.on{border-color:#46b8ff;color:#dff6ff;box-shadow:0 0 12px rgba(70,184,255,.22)}.sr-preview-badge{position:absolute;right:8px;top:8px;padding:6px 8px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(2,10,14,.78);color:#9fb3bd;font:850 7px system-ui;pointer-events:none}
.sr-strip{display:flex;gap:5px;overflow-x:auto;padding:7px;border-top:1px solid rgba(255,255,255,.08);scrollbar-width:thin}.sr-frame{position:relative;flex:0 0 70px;height:82px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#061017;padding:3px;color:#81959d;touch-action:none}.sr-frame.selected{border-color:#e5c35f;box-shadow:0 0 0 1px rgba(229,195,95,.25) inset}.sr-frame.reference:after{content:'REF';position:absolute;right:3px;top:3px;padding:2px 3px;border-radius:4px;background:#c2932c;color:#081014;font:950 5px system-ui}.sr-frame canvas{display:block;width:62px;height:58px;object-fit:contain}.sr-frame span{display:block;text-align:center;font:850 6px system-ui}.sr-frame.dragging{opacity:.4}
.sr-side{min-height:0;overflow:auto;display:grid;align-content:start;gap:7px}.sr-card{padding:9px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:#07151d}.sr-card h4{margin:0 0 7px;color:#f5d779;font:950 8px system-ui;letter-spacing:.1em}.sr-tools,.sr-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.sr-tools button.on{border-color:#42b8ff;color:#dff6ff}.sr-actions .danger{color:#ffaea4;border-color:rgba(255,112,95,.3)}.sr-range{display:grid;grid-template-columns:58px minmax(0,1fr) 42px;gap:6px;align-items:center;margin:7px 0;color:#8fa4ad;font:750 7px system-ui}.sr-range input{width:100%}.sr-range output{text-align:right;color:#e9f3f6;font:850 7px system-ui}.sr-help{margin:7px 0 0;color:#718792;font:700 6.5px/1.5 system-ui}.sr-ref{color:#d8e7ed;font:750 7px/1.45 system-ui}.sr-foot{display:none;padding:8px 9px max(8px,env(safe-area-inset-bottom));gap:7px;border-top:1px solid rgba(255,255,255,.08);background:#07131b}.sr-foot button{flex:1}
@media(max-width:760px){.sab-repair{grid-template-rows:auto minmax(0,1fr) auto}.sr-head .apply{display:none}.sr-body{grid-template-columns:1fr;grid-template-rows:minmax(285px,50vh) minmax(0,1fr);overflow:auto;padding:6px}.sr-main{min-height:285px}.sr-stage{width:min(50vh,100%);height:min(50vh,100%)}.sr-side{overflow:visible}.sr-foot{display:flex}.sr-card{padding:8px}.sr-frame{flex-basis:64px;height:76px}.sr-frame canvas{width:56px;height:52px}}
`;doc.head.append(style);
}
function findField(workspace,side,label){
  for(const row of workspace.querySelectorAll(`${side} .ksw-field`))if(row.querySelector('label')?.textContent?.trim()===label)return row.querySelector('input,select');
  return null;
}
function setField(workspace,side,label,value){
  const input=findField(workspace,side,label);if(!input)return false;input.value=String(value);input.dispatchEvent(new input.ownerDocument.defaultView.Event('change',{bubbles:true}));return true;
}
async function waitForSheetChange(root,before,{timeout=8000}={}){
  const started=Date.now();while(Date.now()-started<timeout){const b=await builder();if(b?.draft?.sheet?.dataUrl&&b.draft.sheet.dataUrl!==before)return b;await sleep(root,60);}throw new Error('SPRITE_REPAIR_APPLY_TIMEOUT');
}
async function createFrames(root,draft){
  const image=await loadImage(root,draft.sheet.dataUrl),doc=root.document,frames=[];
  for(let i=draft.sheet.startFrame;i<=draft.sheet.endFrame;i++){const r=frameRect(draft.sheet,i),c=doc.createElement('canvas');c.width=r.width;c.height=r.height;c.getContext('2d').drawImage(image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);frames.push({id:`repair_${i}_${Date.now().toString(36)}`,sourceIndex:i,canvas:c,crop:{x:0,y:0,width:c.width,height:c.height},tx:0,ty:0,scale:1,pivotX:draft.sheet.originX??.5,pivotY:draft.sheet.originY??1});}
  return frames;
}
function closeRepair(){if(!state)return;try{rootRef.cancelAnimationFrame(state.raf);}catch{}state.overlay.remove();state=null;}
async function openRepair(root,workspace){
  if(state)return;const b=await builder();if(!b?.draft?.sheet?.dataUrl)return toast(root,'Primero sube un spritesheet');
  const draft=b.draft,doc=root.document,frames=await createFrames(root,draft);
  state={root,workspace,b,frames,selected:0,reference:0,tool:'move',onion:draft.preview?.onionSkin===true,playing:false,previewIndex:0,last:0,raf:0,brush:12,drag:null,sourceCombat:{impactFrame:draft.combat.impactFrame,activeStartFrame:draft.combat.activeStartFrame,activeEndFrame:draft.combat.activeEndFrame,hitboxX:draft.combat.hitboxX,hitboxY:draft.combat.hitboxY,hitboxWidth:draft.combat.hitboxWidth,hitboxHeight:draft.combat.hitboxHeight},sourceFps:draft.sheet.fps};
  const overlay=make(doc,'section','sab-repair');state.overlay=overlay;
  const head=make(doc,'header','sr-head'),copy=make(doc,'div','sr-head-copy');copy.innerHTML='<b>🛠 SPRITE REPAIR STUDIO</b><small>Mueve · escala · limpia · reemplaza · ordena · alinea · prueba · aplica</small>';const close=make(doc,'button','','CERRAR'),apply=make(doc,'button','apply','APLICAR');head.append(copy,close,apply);
  const body=make(doc,'div','sr-body'),main=make(doc,'section','sr-main'),stageWrap=make(doc,'div','sr-stage-wrap'),stage=make(doc,'canvas','sr-stage');stage.width=640;stage.height=640;const mode=make(doc,'div','sr-mode'),move=make(doc,'button','','✥ MOVER'),pivot=make(doc,'button','','⌖ PIVOT'),cropTool=make(doc,'button','','✂ CROP'),eraser=make(doc,'button','','⌫ BORRAR');mode.append(move,pivot,cropTool,eraser);const badge=make(doc,'div','sr-preview-badge');stageWrap.append(stage,mode,badge);const strip=make(doc,'div','sr-strip');main.append(stageWrap,strip);
  const side=make(doc,'aside','sr-side');
  const edit=make(doc,'div','sr-card');edit.innerHTML='<h4>FRAME SELECCIONADO</h4>';const scaleRow=make(doc,'label','sr-range'),scaleLabel=make(doc,'span','','ESCALA'),scaleInput=doc.createElement('input'),scaleOut=make(doc,'output');scaleInput.type='range';scaleInput.min='.25';scaleInput.max='2.5';scaleInput.step='.01';scaleRow.append(scaleLabel,scaleInput,scaleOut);const brushRow=make(doc,'label','sr-range'),brushLabel=make(doc,'span','','BORRADOR'),brushInput=doc.createElement('input'),brushOut=make(doc,'output');brushInput.type='range';brushInput.min='2';brushInput.max='48';brushInput.step='1';brushRow.append(brushLabel,brushInput,brushOut);const actions=make(doc,'div','sr-actions'),trim=make(doc,'button','','RECORTAR α'),center=make(doc,'button','','CENTRAR'),replace=make(doc,'button','','REEMPLAZAR'),duplicate=make(doc,'button','','DUPLICAR'),del=make(doc,'button','danger','ELIMINAR'),left=make(doc,'button','','← MOVER'),right=make(doc,'button','','MOVER →');actions.append(trim,center,replace,duplicate,del,left,right);edit.append(scaleRow,brushRow,actions,make(doc,'p','sr-help','Arrastra sobre la imagen para mover. En PIVOT toca donde están los pies/centro. BORRAR elimina píxeles con el dedo. CROP dibuja un recorte manual.'));
  const alignment=make(doc,'div','sr-card');alignment.innerHTML='<h4>ALINEACIÓN</h4>';const alignActions=make(doc,'div','sr-actions'),setRef=make(doc,'button','','USAR COMO REF'),alignAll=make(doc,'button','','ALINEAR TODOS'),trimAll=make(doc,'button','','TRIM TODOS'),onion=make(doc,'button','','ONION SKIN');alignActions.append(setRef,alignAll,trimAll,onion);const refText=make(doc,'p','sr-ref');alignment.append(alignActions,refText);
  const preview=make(doc,'div','sr-card');preview.innerHTML='<h4>PREVIEW</h4>';const previewActions=make(doc,'div','sr-actions'),play=make(doc,'button','','▶ PLAY'),prev=make(doc,'button','','◀ FRAME'),next=make(doc,'button','','FRAME ▶'),reset=make(doc,'button','','RESET FRAME');previewActions.append(play,prev,next,reset);preview.append(previewActions,make(doc,'p','sr-help','El preview usa los FPS actuales del Builder y reproduce exactamente el orden que vas a aplicar.'));
  side.append(edit,alignment,preview);body.append(main,side);
  const foot=make(doc,'footer','sr-foot'),cancelBottom=make(doc,'button','','CANCELAR'),applyBottom=make(doc,'button','apply','APLICAR REPARACIÓN');foot.append(cancelBottom,applyBottom);overlay.append(head,body,foot);doc.body.append(overlay);
  const replaceInput=doc.createElement('input');replaceInput.type='file';replaceInput.accept='image/png,image/webp';replaceInput.hidden=true;overlay.append(replaceInput);

  function selected(){return state.frames[state.selected];}
  function setTool(tool){state.tool=tool;for(const [btn,id] of [[move,'move'],[pivot,'pivot'],[cropTool,'crop'],[eraser,'eraser']])btn.classList.toggle('on',id===tool);renderStage();}
  function renderStrip(){
    strip.replaceChildren();state.frames.forEach((frame,index)=>{const item=make(doc,'button',`sr-frame${index===state.selected?' selected':''}${index===state.reference?' reference':''}`);item.type='button';item.draggable=true;item.dataset.index=String(index);const c=doc.createElement('canvas');c.width=62;c.height=58;const baked=drawFrameCell(doc,frame,draft.sheet.frameWidth,draft.sheet.frameHeight);const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(baked,0,0,c.width,c.height);item.append(c,make(doc,'span','',`F${index}`));item.onclick=()=>{state.selected=index;state.previewIndex=index;syncControls();renderStrip();renderStage();};item.ondragstart=e=>{item.classList.add('dragging');e.dataTransfer?.setData('text/plain',String(index));};item.ondragend=()=>item.classList.remove('dragging');item.ondragover=e=>e.preventDefault();item.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer?.getData('text/plain'));if(!Number.isFinite(from)||from===index)return;const refId=state.frames[state.reference]?.id,selId=state.frames[state.selected]?.id;state.frames=reorderItems(state.frames,from,index);state.reference=Math.max(0,state.frames.findIndex(f=>f.id===refId));state.selected=Math.max(0,state.frames.findIndex(f=>f.id===selId));renderStrip();renderStage();};strip.append(item);});
  }
  function syncControls(){const f=selected();scaleInput.value=String(f.scale);scaleOut.textContent=`${Math.round(f.scale*100)}%`;brushInput.value=String(state.brush);brushOut.textContent=`${state.brush}px`;onion.classList.toggle('on',state.onion);play.textContent=state.playing?'Ⅱ PAUSE':'▶ PLAY';refText.textContent=`Referencia: F${state.reference} · ${state.frames.length} frames · celda ${draft.sheet.frameWidth}×${draft.sheet.frameHeight}`;setTool(state.tool);}
  function drawOne(ctx,index,alpha=1){
    const f=state.frames[index];if(!f)return;const cell=drawFrameCell(doc,f,draft.sheet.frameWidth,draft.sheet.frameHeight),size=Math.min(stage.width,stage.height)*.72,ratio=Math.min(size/draft.sheet.frameWidth,size/draft.sheet.frameHeight),w=draft.sheet.frameWidth*ratio,h=draft.sheet.frameHeight*ratio,x=(stage.width-w)/2,y=(stage.height-h)/2;ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(cell,x,y,w,h);ctx.restore();return{x,y,w,h,ratio};
  }
  function renderStage(){
    const ctx=stage.getContext('2d');ctx.clearRect(0,0,stage.width,stage.height);ctx.fillStyle='#071117';ctx.fillRect(0,0,stage.width,stage.height);
    const idx=state.playing?state.previewIndex:state.selected;if(state.onion&&!state.playing){if(idx>0)drawOne(ctx,idx-1,.18);if(idx<state.frames.length-1)drawOne(ctx,idx+1,.18);}
    const box=drawOne(ctx,idx,1);if(!box)return;
    if(!state.playing&&idx===state.selected){const f=selected(),c=f.crop,dw=c.width*f.scale,dh=c.height*f.scale,pivotCellX=draft.sheet.frameWidth*.5+f.tx,pivotCellY=draft.sheet.frameHeight+f.ty;const px=box.x+pivotCellX*box.ratio,py=box.y+pivotCellY*box.ratio;ctx.strokeStyle=state.tool==='pivot'?'#ffd75d':'rgba(255,215,93,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px-10,py);ctx.lineTo(px+10,py);ctx.moveTo(px,py-10);ctx.lineTo(px,py+10);ctx.stroke();ctx.strokeRect(box.x,box.y,box.w,box.h);if(state.drag?.mode==='crop'&&state.drag.start&&state.drag.current){const a=state.drag.start,z=state.drag.current,rx=box.x+Math.min(a.x,z.x)*box.ratio,ry=box.y+Math.min(a.y,z.y)*box.ratio,rw=Math.abs(z.x-a.x)*box.ratio,rh=Math.abs(z.y-a.y)*box.ratio;ctx.strokeStyle='#4dc2ff';ctx.setLineDash([7,5]);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);}void dw;void dh;}
    badge.textContent=state.playing?`PLAY · F${state.previewIndex}`:`F${state.selected} · ${state.tool.toUpperCase()}`;
  }
  function stageCellPoint(e){
    const r=stage.getBoundingClientRect(),size=Math.min(stage.width,stage.height)*.72,ratio=Math.min(size/draft.sheet.frameWidth,size/draft.sheet.frameHeight),w=draft.sheet.frameWidth*ratio,h=draft.sheet.frameHeight*ratio,x=(stage.width-w)/2,y=(stage.height-h)/2;
    const sx=(e.clientX-r.left)*stage.width/Math.max(1,r.width),sy=(e.clientY-r.top)*stage.height/Math.max(1,r.height);return{x:(sx-x)/ratio,y:(sy-y)/ratio,ratio};
  }
  function eraseAt(e){const f=selected(),p=stageCellPoint(e),src=sourcePointFromCell(f,draft.sheet.frameWidth,draft.sheet.frameHeight,p.x,p.y);if(src.x<0||src.y<0||src.x>f.canvas.width||src.y>f.canvas.height)return;const ctx=f.canvas.getContext('2d');ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(src.x,src.y,state.brush/Math.max(.2,f.scale),0,Math.PI*2);ctx.fill();ctx.restore();}
  stage.onpointerdown=e=>{if(state.playing)return;e.preventDefault();const f=selected(),p=stageCellPoint(e);if(state.tool==='eraser'){eraseAt(e);state.drag={pointerId:e.pointerId,mode:'eraser'};renderStrip();renderStage();return;}if(state.tool==='pivot'){const src=sourcePointFromCell(f,draft.sheet.frameWidth,draft.sheet.frameHeight,p.x,p.y),old=sourcePointFromCell(f,draft.sheet.frameWidth,draft.sheet.frameHeight,0,0),newPX=clamp((src.x-f.crop.x)/Math.max(1,f.crop.width),0,1),newPY=clamp((src.y-f.crop.y)/Math.max(1,f.crop.height),0,1),dw=f.crop.width*f.scale,dh=f.crop.height*f.scale;f.pivotX=newPX;f.pivotY=newPY;f.tx=old.left+newPX*dw-draft.sheet.frameWidth*.5;f.ty=old.top+newPY*dh-draft.sheet.frameHeight;renderStrip();renderStage();return;}if(state.tool==='crop'){state.drag={pointerId:e.pointerId,mode:'crop',start:p,current:p};stage.setPointerCapture?.(e.pointerId);renderStage();return;}state.drag={pointerId:e.pointerId,mode:'move',x:e.clientX,y:e.clientY,tx:f.tx,ty:f.ty};stage.setPointerCapture?.(e.pointerId);};
  stage.onpointermove=e=>{const d=state.drag;if(!d||d.pointerId!==e.pointerId)return;e.preventDefault();if(d.mode==='eraser'){eraseAt(e);renderStage();return;}if(d.mode==='crop'){d.current=stageCellPoint(e);renderStage();return;}const f=selected(),r=stage.getBoundingClientRect(),ratio=(Math.min(stage.width,stage.height)*.72/Math.max(draft.sheet.frameWidth,draft.sheet.frameHeight))*(r.width/stage.width);f.tx=d.tx+(e.clientX-d.x)/Math.max(.01,ratio);f.ty=d.ty+(e.clientY-d.y)/Math.max(.01,ratio);renderStage();};
  const end=e=>{const d=state.drag;if(!d||d.pointerId!==e.pointerId)return;if(d.mode==='crop'&&d.start&&d.current){const f=selected(),a=sourcePointFromCell(f,draft.sheet.frameWidth,draft.sheet.frameHeight,d.start.x,d.start.y),z=sourcePointFromCell(f,draft.sheet.frameWidth,draft.sheet.frameHeight,d.current.x,d.current.y),x1=clamp(Math.min(a.x,z.x),0,f.canvas.width-1),y1=clamp(Math.min(a.y,z.y),0,f.canvas.height-1),x2=clamp(Math.max(a.x,z.x),x1+1,f.canvas.width),y2=clamp(Math.max(a.y,z.y),y1+1,f.canvas.height);f.crop={x:Math.floor(x1),y:Math.floor(y1),width:Math.max(1,Math.ceil(x2-x1)),height:Math.max(1,Math.ceil(y2-y1))};f.pivotX=.5;f.pivotY=1;}state.drag=null;renderStrip();syncControls();renderStage();};stage.onpointerup=end;stage.onpointercancel=end;
  move.onclick=()=>setTool('move');pivot.onclick=()=>setTool('pivot');cropTool.onclick=()=>setTool('crop');eraser.onclick=()=>setTool('eraser');
  scaleInput.oninput=()=>{const f=selected();f.scale=clamp(scaleInput.value,.25,2.5);scaleOut.textContent=`${Math.round(f.scale*100)}%`;renderStrip();renderStage();};
  brushInput.oninput=()=>{state.brush=Math.round(clamp(brushInput.value,2,48));brushOut.textContent=`${state.brush}px`;};
  trim.onclick=()=>{trimFrame(selected());renderStrip();syncControls();renderStage();};center.onclick=()=>{const f=selected();f.tx=0;f.ty=0;renderStrip();renderStage();};
  trimAll.onclick=()=>{state.frames.forEach(trimFrame);renderStrip();renderStage();toast(root,'Transparencia recortada en todos los frames');};
  duplicate.onclick=()=>{state.frames.splice(state.selected+1,0,cloneFrame(doc,selected()));state.selected++;state.previewIndex=state.selected;renderStrip();syncControls();renderStage();};
  del.onclick=()=>{if(state.frames.length<=1)return toast(root,'Debe quedar al menos un frame');state.frames.splice(state.selected,1);state.selected=Math.min(state.selected,state.frames.length-1);state.reference=Math.min(state.reference,state.frames.length-1);state.previewIndex=state.selected;renderStrip();syncControls();renderStage();};
  left.onclick=()=>{if(state.selected<=0)return;const id=selected().id,refId=state.frames[state.reference]?.id;state.frames=reorderItems(state.frames,state.selected,state.selected-1);state.selected=state.frames.findIndex(f=>f.id===id);state.reference=Math.max(0,state.frames.findIndex(f=>f.id===refId));renderStrip();renderStage();};
  right.onclick=()=>{if(state.selected>=state.frames.length-1)return;const id=selected().id,refId=state.frames[state.reference]?.id;state.frames=reorderItems(state.frames,state.selected,state.selected+1);state.selected=state.frames.findIndex(f=>f.id===id);state.reference=Math.max(0,state.frames.findIndex(f=>f.id===refId));renderStrip();renderStage();};
  setRef.onclick=()=>{state.reference=state.selected;renderStrip();syncControls();toast(root,`Frame ${state.reference} guardado como referencia`);};
  alignAll.onclick=()=>{const ref=state.frames[state.reference]||state.frames[0],rb=alphaBounds(ref),refH=Math.max(1,rb.height*ref.scale);for(const f of state.frames){const b=alphaBounds(f);if(b.empty)continue;f.crop={x:b.x,y:b.y,width:b.width,height:b.height};f.scale=clamp(refH/Math.max(1,b.height),.25,2.5);f.pivotX=.5;f.pivotY=1;f.tx=ref.tx;f.ty=ref.ty;}syncControls();renderStrip();renderStage();toast(root,'Todos los frames alineados por tamaño y pies');};
  onion.onclick=()=>{state.onion=!state.onion;syncControls();renderStage();};
  replace.onclick=()=>replaceInput.click();
  replaceInput.onchange=async()=>{const file=replaceInput.files?.[0];if(!file)return;try{const url=await readFile(root,file),img=await loadImage(root,url),c=doc.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;c.getContext('2d').drawImage(img,0,0);const f=selected();f.canvas=c;f.crop={x:0,y:0,width:c.width,height:c.height};f.scale=Math.min(1,draft.sheet.frameWidth/c.width,draft.sheet.frameHeight/c.height);f.tx=0;f.ty=0;f.pivotX=.5;f.pivotY=1;trimFrame(f);syncControls();renderStrip();renderStage();}catch(error){toast(root,error?.message||String(error));}finally{replaceInput.value='';}};
  reset.onclick=()=>{const f=selected();f.crop={x:0,y:0,width:f.canvas.width,height:f.canvas.height};f.tx=0;f.ty=0;f.scale=1;f.pivotX=.5;f.pivotY=1;syncControls();renderStrip();renderStage();};
  prev.onclick=()=>{state.playing=false;state.previewIndex=(state.previewIndex-1+state.frames.length)%state.frames.length;state.selected=state.previewIndex;syncControls();renderStrip();renderStage();};
  next.onclick=()=>{state.playing=false;state.previewIndex=(state.previewIndex+1)%state.frames.length;state.selected=state.previewIndex;syncControls();renderStrip();renderStage();};
  play.onclick=()=>{state.playing=!state.playing;state.previewIndex=state.selected;state.last=0;syncControls();renderStage();};
  async function applyRepair(){
    if(!state?.frames?.length)return;const current=await builder();if(!current)throw new Error('SPRITE_REPAIR_BUILDER_CLOSED');
    const cellW=draft.sheet.frameWidth,cellH=draft.sheet.frameHeight,columns=Math.max(1,Math.min(draft.sheet.columns,state.frames.length)),rows=Math.ceil(state.frames.length/columns),sheet=doc.createElement('canvas');sheet.width=columns*cellW;sheet.height=rows*cellH;const ctx=sheet.getContext('2d');ctx.imageSmoothingEnabled=false;
    state.frames.forEach((frame,index)=>{const baked=drawFrameCell(doc,frame,cellW,cellH),col=index%columns,row=Math.floor(index/columns);ctx.drawImage(baked,col*cellW,row*cellH);});
    const before=current.draft.sheet.dataUrl,blob=await canvasBlob(root,sheet),baseName=String(current.draft.sheet.fileName||current.draft.name||'sprite-ability').replace(/\.[^.]+$/,'')||'sprite-ability',file=new root.File([blob],`${baseName}.png`,{type:'image/png'}),input=workspace.querySelector('.sab-file,.ksw-left input[type="file"]');
    if(!input)throw new Error('SPRITE_REPAIR_UPLOAD_INPUT_MISSING');const Transfer=root.DataTransfer||globalThis.DataTransfer;if(!Transfer)throw new Error('SPRITE_REPAIR_FILE_TRANSFER_UNAVAILABLE');const transfer=new Transfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new root.Event('change',{bubbles:true}));
    const fresh=await waitForSheetChange(root,before);await sleep(root,80);
    setField(workspace,'.ksw-left','Frame W',cellW);setField(workspace,'.ksw-left','Frame H',cellH);setField(workspace,'.ksw-left','Columns',columns);setField(workspace,'.ksw-left','Rows',rows);setField(workspace,'.ksw-left','Start Frame',0);setField(workspace,'.ksw-left','End Frame',state.frames.length-1);setField(workspace,'.ksw-left','FPS',state.sourceFps);
    const max=state.frames.length-1,impact=Math.min(max,state.sourceCombat.impactFrame),activeStart=Math.min(impact,state.sourceCombat.activeStartFrame),activeEnd=Math.max(impact,Math.min(max,state.sourceCombat.activeEndFrame));
    setField(workspace,'.ksw-right','Impact Frame',impact);setField(workspace,'.ksw-right','Active Start',activeStart);setField(workspace,'.ksw-right','Active End',activeEnd);setField(workspace,'.ksw-right','Hitbox X',state.sourceCombat.hitboxX);setField(workspace,'.ksw-right','Hitbox Y',state.sourceCombat.hitboxY);setField(workspace,'.ksw-right','Hitbox W',state.sourceCombat.hitboxWidth);setField(workspace,'.ksw-right','Hitbox H',state.sourceCombat.hitboxHeight);
    const repairedCount=state.frames.length;
    try{await fresh.save?.();}catch(error){if(String(error?.message||error)!=='syncStatus is not defined')throw error;console.warn('[Sprite Repair] draft persisted; ignored post-save status scope error');}
    closeRepair();toast(root,`Sprite reparado · ${repairedCount} frames`);return true;
  }
  apply.onclick=()=>void applyRepair().catch(error=>toast(root,error?.message||String(error)));applyBottom.onclick=apply.onclick;close.onclick=closeRepair;cancelBottom.onclick=closeRepair;
  function loop(ts){if(!state)return;if(state.playing){const step=1000/Math.max(1,state.sourceFps||12);if(!state.last)state.last=ts;if(ts-state.last>=step){state.previewIndex=(state.previewIndex+1)%state.frames.length;state.last=ts;renderStage();}}state.raf=root.requestAnimationFrame(loop);}
  renderStrip();syncControls();renderStage();state.raf=root.requestAnimationFrame(loop);
}
function scan(){
  if(disposed||!rootRef?.document?.body?.classList.contains('kelo-sprite-ability-builder-active'))return;const doc=rootRef.document,workspace=doc.getElementById('kelo-studio-workspace');if(!workspace)return;const left=workspace.querySelector('.ksw-left');if(!left||left.querySelector('.sab-repair-launch'))return;
  const launch=make(doc,'button','sab-repair-launch','🛠 REPARAR SPRITE · FRAME POR FRAME');launch.type='button';launch.onclick=()=>void openRepair(rootRef,workspace).catch(error=>{console.error('[Sprite Repair]',error);toast(rootRef,error?.message||String(error));});const note=left.querySelector('.ksw-note');note?.before(launch)||left.append(launch);
}
export function installSpriteAbilityRepairStudio({root=globalThis}={}){
  if(!root?.document)return()=>{};rootRef=root;disposed=false;ensureStyle(root.document);observer=new root.MutationObserver(scan);observer.observe(root.document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});scan();
  return()=>{disposed=true;observer?.disconnect();observer=null;closeRepair();style?.remove();style=null;};
}