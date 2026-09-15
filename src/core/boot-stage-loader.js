/* KELO-INDEX
 * area: LAB / BOOT PERFORMANCE
 * owner: KeloBootStageLab
 * keys: ZERO BOOT STAGE SEQUENTIAL FRAME BUDGET METRICS IOS SAFARI
 * purpose: carga etapas SOLO por petición explícita, un archivo a la vez, midiendo tiempo de carga y presupuesto de frame.
 * public-api: KeloBootStageLab.configure/loadStage/getState
 * state-owned: métricas efímeras del laboratorio
 * do-not: NO autoload, NO polling, NO segundo game loop, NO uso en producción hasta promoción explícita
 */
(function(root){
'use strict';
if(root.KeloBootStageLab)return;
const VERSION='kelo-zero-boot-stage-loader-v1';
const FRAME_LIMIT_MS=28;
const BETWEEN_FILES_MS=180;
let stages=Object.create(null);
let state={active:null,loaded:[],failed:[],files:[],totalTransfer:0,totalDecoded:0};
let inflight=null;
function abs(src){return new URL(src,document.baseURI).href;}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:zero-boot:'+type,{detail:Object.assign({version:VERSION},detail||{})}));}catch(_){}}
function sampleFrame(){return new Promise(function(resolve){if(typeof requestAnimationFrame!=='function'){resolve(0);return;}requestAnimationFrame(function(a){requestAnimationFrame(function(b){resolve(Math.max(0,b-a));});});});}
async function safeWindow(){let frame=await sampleFrame();while(frame>FRAME_LIMIT_MS){emit('throttle',{frameMs:Math.round(frame)});await sleep(700);frame=await sampleFrame();}return frame;}
function alreadyLoaded(src){const base=String(src).split('?')[0];return Array.from(document.scripts).some(function(s){return String(s.getAttribute('src')||'').split('?')[0]===base;});}
function resourceMetric(src){
  const url=abs(src),entries=performance.getEntriesByName(url);
  const e=entries.length?entries[entries.length-1]:null;
  return e?{transferSize:Number(e.transferSize)||0,encodedBodySize:Number(e.encodedBodySize)||0,decodedBodySize:Number(e.decodedBodySize)||0,duration:Math.round(Number(e.duration)||0)}:{transferSize:0,encodedBodySize:0,decodedBodySize:0,duration:0};
}
async function loadFile(stage,src){
  const frameBefore=await safeWindow();
  if(alreadyLoaded(src))return {stage,src,ok:true,cached:true,wallMs:0,frameBefore:Math.round(frameBefore),frameAfter:null,transferSize:0,encodedBodySize:0,decodedBodySize:0,duration:0};
  const t0=performance.now();
  const result=await new Promise(function(resolve){
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.keloZeroBootStage=stage;
    script.onload=function(){resolve({ok:true});};
    script.onerror=function(){resolve({ok:false});};
    document.body.appendChild(script);
  });
  const wallMs=Math.round(performance.now()-t0),metric=resourceMetric(src),frameAfter=await sampleFrame();
  const row=Object.assign({stage,src,ok:result.ok,cached:false,wallMs,frameBefore:Math.round(frameBefore),frameAfter:Math.round(frameAfter)},metric);
  state.files.push(row);state.totalTransfer+=row.transferSize;state.totalDecoded+=row.decodedBodySize;
  emit(result.ok?'file-end':'file-error',row);
  return row;
}
function configure(definition){
  if(inflight)throw new Error('zero_boot_stage_active');
  const next=Object.create(null);
  Object.keys(definition||{}).forEach(function(name){
    const d=definition[name]||{};
    next[name]=Object.freeze({label:String(d.label||name),depends:Array.isArray(d.depends)?d.depends.slice():[],files:Array.isArray(d.files)?d.files.slice():[]});
  });
  stages=next;emit('configured',{stages:Object.keys(stages)});return true;
}
async function runStage(name,stack){
  if(state.loaded.includes(name))return true;
  const stage=stages[name];if(!stage)throw new Error('unknown_stage:'+name);
  stack=stack||[];if(stack.includes(name))throw new Error('stage_cycle:'+stack.concat(name).join('>'));
  for(const dep of stage.depends)await runStage(dep,stack.concat(name));
  state.active=name;emit('stage-start',{stage:name,label:stage.label,files:stage.files.length});
  for(let i=0;i<stage.files.length;i++){
    const row=await loadFile(name,stage.files[i]);
    if(!row.ok){if(!state.failed.includes(name))state.failed.push(name);state.active=null;emit('stage-error',{stage:name,src:row.src});return false;}
    await sleep(BETWEEN_FILES_MS);
  }
  if(!state.loaded.includes(name))state.loaded.push(name);state.active=null;emit('stage-end',{stage:name,label:stage.label});return true;
}
function loadStage(name){if(inflight)return inflight;inflight=runStage(name,[]).finally(function(){inflight=null;state.active=null;});return inflight;}
function getState(){return Object.freeze(JSON.parse(JSON.stringify({version:VERSION,stages:Object.keys(stages),state})));}
root.KeloBootStageLab=Object.freeze({version:VERSION,configure,loadStage,getState});
emit('ready',{});
})(typeof globalThis!=='undefined'?globalThis:window);
