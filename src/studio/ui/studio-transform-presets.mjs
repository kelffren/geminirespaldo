/* KELO-INDEX
 * area: STUDIO / UI / TRANSFORM PRESETS
 * owns: ten exact multi-selection transform accelerators and their compact UI
 * does-not-own: authority transport, selection semantics, drag previews or document storage
 * public-api: createStudioTransformPresets(), resolveSelectedRows()
 * online: every persistent edit flows through Kernel CommandBus as one reversible CompositeCommand
 */

import { createMoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const clampScale=value=>Math.max(.1,Math.min(8,Math.round((Number(value)||1)*100)/100));
const normalizeRotation=value=>((Math.round(Number(value)||0)%360)+360)%360;

export function resolveSelectedRows(selectionIds=[],entities=[]){
  const ids=Array.isArray(selectionIds)?selectionIds:[];
  if(!ids.length)return [];
  const byId=new Map();
  for(const row of Array.isArray(entities)?entities:[]){if(row)byId.set(String(row.id),row);}
  return ids.map(id=>byId.get(String(id))).filter(Boolean);
}

export function createStudioTransformPresets({root=globalThis,kernel}={}){
  if(!root?.document||!kernel?.selection||typeof kernel.execute!=='function')return Object.freeze({destroy(){}});
  const document=root.document;
  let destroyed=false,observer=null,trigger=null,panel=null,style=null,unsubscribeSelection=()=>{};

  const selectedRows=()=>resolveSelectedRows(kernel.selection.get(),kernel.document.entities);
  async function executeCommands(commands,{type,label}){
    if(!commands.length)return false;
    await kernel.execute(createCompositeCommand(commands,{type,label}));
    return true;
  }
  async function rotateBy(delta){
    const rows=selectedRows();
    return executeCommands(rows.map(row=>createPatchEntityCommand(row.id,{transform:{...(row.transform||{}),rotation:normalizeRotation((Number(row.transform?.rotation)||0)+delta)}})),{type:'selection.rotate.preset',label:`Rotate ${rows.length} selection${rows.length===1?'':'s'} ${delta>0?'+':''}${delta}°`});
  }
  async function rotationReset(){
    const rows=selectedRows(),commands=rows.filter(row=>normalizeRotation(row.transform?.rotation)!==0).map(row=>createPatchEntityCommand(row.id,{transform:{...(row.transform||{}),rotation:0}}));
    return executeCommands(commands,{type:'selection.rotate.reset',label:`Reset rotation ${rows.length} selection${rows.length===1?'':'s'}`});
  }
  async function scaleExact(value){
    const target=clampScale(value),rows=selectedRows(),commands=rows.filter(row=>clampScale(row.transform?.scale)!==target).map(row=>createPatchEntityCommand(row.id,{transform:{...(row.transform||{}),scale:target}}));
    return executeCommands(commands,{type:'selection.scale.preset',label:`Scale ${rows.length} selection${rows.length===1?'':'s'} to ${Math.round(target*100)}%`});
  }
  function snapStep(){
    const shell=document.querySelector('#kelo-studio-live'),control=shell?.querySelector('[data-ext="snap"]'),value=Number(control?.value);
    return Math.max(1,Number.isFinite(value)&&value>0?value:Number(kernel.document.settings?.tileSize)||32);
  }
  async function snapSelection(){
    const rows=selectedRows();if(!rows.length)return false;
    const step=snapStep(),anchor=rows[0].transform||{},ax=Number(anchor.x)||0,ay=Number(anchor.y)||0,dx=Math.round(ax/step)*step-ax,dy=Math.round(ay/step)*step-ay;
    if(!dx&&!dy)return false;
    const commands=rows.map(row=>createMoveEntityCommand(row.id,{x:(Number(row.transform?.x)||0)+dx,y:(Number(row.transform?.y)||0)+dy}));
    return executeCommands(commands,{type:'selection.snap.group',label:`Snap ${rows.length} selection${rows.length===1?'':'s'} to ${step}px grid`});
  }

  const actions=Object.freeze({
    rotNeg90:()=>rotateBy(-90),rot180:()=>rotateBy(180),rot0:rotationReset,
    scale50:()=>scaleExact(.5),scale75:()=>scaleExact(.75),scale100:()=>scaleExact(1),scale125:()=>scaleExact(1.25),scale150:()=>scaleExact(1.5),scale200:()=>scaleExact(2),
    snap:snapSelection
  });

  function sync(){const disabled=selectedRows().length===0;if(trigger)trigger.disabled=disabled;if(panel)panel.querySelectorAll('button[data-transform-preset]').forEach(button=>button.disabled=disabled);}
  function close(){if(panel)panel.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false');}
  function toggle(){if(!panel)return false;panel.hidden=!panel.hidden;trigger?.setAttribute('aria-expanded',panel.hidden?'false':'true');return !panel.hidden;}
  async function onPanelClick(event){const id=event.target?.closest?.('[data-transform-preset]')?.dataset.transformPreset;if(!id||!actions[id])return;try{await actions[id]();close();}catch(error){console.warn('[Kelo Studio] transform preset failed',error);}}
  function onOutside(event){if(panel?.hidden)return;if(panel?.contains(event.target)||trigger?.contains(event.target))return;close();}

  function mount(){
    if(destroyed)return;
    const shell=document.querySelector('#kelo-studio-live'),slot=shell?.querySelector('.ks-productivity-edit-slot');if(!shell||!slot)return;
    if(!style){style=document.createElement('style');style.dataset.keloTransformPresets='1';style.textContent=`
      #kelo-studio-live .ks-transform-presets-trigger{min-height:36px;white-space:nowrap}
      #kelo-studio-live .ks-transform-presets{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);z-index:18;width:min(520px,calc(100vw - 20px));padding:8px;border:1px solid rgba(231,197,106,.45);border-radius:15px;background:rgba(5,14,16,.985);box-shadow:0 18px 48px rgba(0,0,0,.58);pointer-events:auto;backdrop-filter:blur(16px)}
      #kelo-studio-live .ks-transform-presets[hidden]{display:none}
      #kelo-studio-live .ks-transform-presets-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
      #kelo-studio-live .ks-transform-presets button{min-height:42px;border:1px solid rgba(231,197,106,.24);border-radius:10px;background:#102022;color:#fff0b2;font-size:7px;font-weight:900;padding:4px;touch-action:manipulation}
      #kelo-studio-live .ks-transform-presets button:disabled{opacity:.3}
      @media(max-width:760px){#kelo-studio-live .ks-transform-presets-trigger{min-height:44px}#kelo-studio-live .ks-transform-presets{bottom:calc(max(8px,env(safe-area-inset-bottom)) + 122px)}#kelo-studio-live .ks-transform-presets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#kelo-studio-live .ks-transform-presets button{min-height:48px;font-size:8px}}
    `;document.head.appendChild(style);}
    if(!trigger?.isConnected){trigger=document.createElement('button');trigger.type='button';trigger.className='ks-transform-presets-trigger';trigger.textContent='PRESETS';trigger.setAttribute('aria-expanded','false');trigger.onclick=toggle;slot.appendChild(trigger);}
    if(!panel?.isConnected){panel=document.createElement('section');panel.className='ks-transform-presets';panel.hidden=true;panel.setAttribute('aria-label','Transform presets');panel.innerHTML='<div class="ks-transform-presets-grid"><button data-transform-preset="rotNeg90">ROT −90°</button><button data-transform-preset="rot180">ROT 180°</button><button data-transform-preset="rot0">ROT 0°</button><button data-transform-preset="scale50">ESCALA 50%</button><button data-transform-preset="scale75">ESCALA 75%</button><button data-transform-preset="scale100">ESCALA 100%</button><button data-transform-preset="scale125">ESCALA 125%</button><button data-transform-preset="scale150">ESCALA 150%</button><button data-transform-preset="scale200">ESCALA 200%</button><button data-transform-preset="snap">SNAP SELECCIÓN</button></div>';panel.addEventListener('click',onPanelClick);shell.appendChild(panel);}
    sync();
  }

  observer=new MutationObserver(mount);observer.observe(document.documentElement||document.body,{childList:true,subtree:true});
  unsubscribeSelection=kernel.selection.onChange?.(sync)||(()=>{});document.addEventListener('pointerdown',onOutside,true);mount();

  return Object.freeze({version:'studio-transform-presets-v1.0.0',...actions,close,toggle,destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();unsubscribeSelection?.();document.removeEventListener('pointerdown',onOutside,true);trigger?.remove();panel?.removeEventListener('click',onPanelClick);panel?.remove();style?.remove();trigger=panel=style=null;}});
}
