/* KELO-INDEX
 * area: STUDIO / INPUT / PLACEMENT TOUCH
 * owns: mobile precision controls for an active placement preview
 * does-not-own: document mutation, pointer listeners, authority transport or placement math
 * public-api: createStudioPlacementTouchController()
 * online: preview movement is local; PLACE delegates to placement.commit() -> Kernel CommandBus
 */

const MOBILE_MAX=760;
const HOLD_DELAY_MS=320;
const HOLD_REPEAT_MS=90;

export function createStudioPlacementTouchController({root=globalThis,placement}={}){
  const document=root?.document;
  if(!document||!placement?.onPreview||!placement?.move||!placement?.commit)return Object.freeze({destroy(){}});
  let destroyed=false,style=null,pad=null,preview=null,mode='snap',busy=false;
  let holdTimeout=null,holdInterval=null,holdDir='',suppressDirectionClick=false;

  const shell=()=>document.getElementById('kelo-studio-live');
  const snapStep=()=>{
    const live=Number(shell()?.querySelector?.('[data-ext="snap"]')?.value);
    return Number.isFinite(live)&&live>0?live:32;
  };
  const step=()=>mode==='fine'?1:mode==='coarse'?snapStep()*4:snapStep();
  const pulse=()=>{try{root.navigator?.vibrate?.(8);}catch{}};
  const later=(fn,ms)=>root.setTimeout?.(fn,ms)??setTimeout(fn,ms);
  const every=(fn,ms)=>root.setInterval?.(fn,ms)??setInterval(fn,ms);
  const clearLater=id=>{if(id==null)return;(root.clearTimeout||clearTimeout)(id);};
  const clearEvery=id=>{if(id==null)return;(root.clearInterval||clearInterval)(id);};

  function ensure(){
    if(destroyed||Number(root.innerWidth||9999)>MOBILE_MAX)return null;
    const host=shell();if(!host)return null;
    if(!style){
      style=document.createElement('style');style.dataset.keloPlacementTouch='1';style.textContent=`
      #kelo-studio-live .ks-placement-touch{display:none}
      @media(max-width:760px){
        #kelo-studio-live .ks-placement-touch{position:absolute;right:8px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 126px);z-index:11;pointer-events:auto;display:grid;grid-template-columns:46px 46px 46px;grid-template-rows:46px 46px 46px auto;gap:4px;padding:7px;border:1px solid rgba(231,197,106,.46);border-radius:16px;background:rgba(5,14,16,.965);box-shadow:0 14px 38px rgba(0,0,0,.52);backdrop-filter:blur(14px)}
        #kelo-studio-live .ks-placement-touch[hidden]{display:none}
        #kelo-studio-live .ks-placement-touch button{min-width:46px;min-height:46px;border:1px solid rgba(231,197,106,.26);border-radius:12px;background:#102022;color:#fff0b2;font-size:18px;font-weight:900;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
        #kelo-studio-live .ks-placement-touch button:active{transform:scale(.96);border-color:#e7c56a}
        #kelo-studio-live .ks-placement-touch .place{grid-column:1/4;min-height:48px;font-size:8px;letter-spacing:.08em;background:linear-gradient(180deg,#3e6b53,#2a4f40);border-color:#e7c56a}
        #kelo-studio-live .ks-placement-touch .cancel{color:#ffd4cf;border-color:rgba(255,122,112,.45)}
        #kelo-studio-live .ks-placement-touch .step{font-size:7px;line-height:1.2}
      }`;
      document.head.appendChild(style);
    }
    if(!pad?.isConnected){
      pad=document.createElement('div');pad.className='ks-placement-touch';pad.hidden=true;pad.setAttribute('aria-label','Ajuste preciso de colocación');
      pad.innerHTML='<span></span><button data-place-dir="up" aria-label="Mover arriba">↑</button><button data-place-action="rotate" aria-label="Rotar preview">⟳</button><button data-place-dir="left" aria-label="Mover izquierda">←</button><button class="step" data-place-action="step" aria-label="Cambiar precisión">SNAP</button><button data-place-dir="right" aria-label="Mover derecha">→</button><button class="cancel" data-place-action="cancel" aria-label="Cancelar colocación">×</button><button data-place-dir="down" aria-label="Mover abajo">↓</button><span></span><button class="place" data-place-action="commit">COLOCAR AQUÍ</button>';
      pad.addEventListener('click',onClick);
      pad.addEventListener('pointerdown',onPointerDown);
      pad.addEventListener('pointerup',stopHold);
      pad.addEventListener('pointercancel',stopHold);
      pad.addEventListener('lostpointercapture',stopHold);
      host.appendChild(pad);
    }
    return pad;
  }

  function sync(){
    const el=ensure();if(!el)return;
    el.hidden=!preview;
    const label=el.querySelector('[data-place-action="step"]');if(label)label.textContent=mode==='fine'?'1 PX':mode==='coarse'?'4×':'SNAP';
  }

  function move(dx,dy){
    if(!preview)return false;
    const s=step(),x=(Number(preview.transform?.x)||0)+(Number(dx)||0)*s,y=(Number(preview.transform?.y)||0)+(Number(dy)||0)*s;
    placement.move(x,y,{snap:1});pulse();return true;
  }

  function moveDirection(dir){
    const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    return map[dir]?move(...map[dir]):false;
  }

  function stopHold(){
    clearLater(holdTimeout);clearEvery(holdInterval);
    holdTimeout=holdInterval=null;holdDir='';
  }

  function onPointerDown(event){
    const button=event.target?.closest?.('[data-place-dir]');
    const dir=button?.dataset.placeDir;
    if(!dir||!preview||event.button>0)return;
    stopHold();
    holdDir=dir;suppressDirectionClick=true;
    event.preventDefault?.();
    try{button.setPointerCapture?.(event.pointerId);}catch{}
    moveDirection(dir);
    holdTimeout=later(()=>{
      holdTimeout=null;
      if(!holdDir||destroyed||!preview)return;
      holdInterval=every(()=>{if(holdDir&&preview)moveDirection(holdDir);},HOLD_REPEAT_MS);
    },HOLD_DELAY_MS);
  }

  async function commit(){
    if(!preview||busy)return false;busy=true;
    const current={
      prefabId:String(preview.prefabId||''),
      x:Number(preview.transform?.x)||0,
      y:Number(preview.transform?.y)||0,
      rotation:Number(preview.transform?.rotation)||0,
      components:{...(preview.components||{})}
    };
    try{
      await placement.commit();
      if(!destroyed&&current.prefabId&&placement.start){
        placement.start(current.prefabId,{rotation:current.rotation,overrides:{components:current.components}});
        placement.move(current.x,current.y,{snap:1});
      }
      pulse();return true;
    }finally{busy=false;}
  }
  function cycleStep(){mode=mode==='snap'?'fine':mode==='fine'?'coarse':'snap';sync();pulse();return mode;}
  function rotate(){if(!preview)return false;placement.rotate?.(90);pulse();return true;}
  function cancel(){if(!preview)return false;stopHold();placement.cancel?.();pulse();return true;}

  function onClick(event){
    const dir=event.target?.closest?.('[data-place-dir]')?.dataset.placeDir;
    if(dir){
      if(suppressDirectionClick){suppressDirectionClick=false;return;}
      moveDirection(dir);return;
    }
    const action=event.target?.closest?.('[data-place-action]')?.dataset.placeAction;
    if(action==='step')cycleStep();else if(action==='rotate')rotate();else if(action==='cancel')cancel();else if(action==='commit')void commit().catch(error=>console.warn('[Kelo Studio] placement touch commit failed',error));
  }

  const unsubscribe=placement.onPreview(next=>{preview=next;if(!next)stopHold();sync();});
  const onResize=()=>{if(Number(root.innerWidth||9999)>MOBILE_MAX)stopHold();sync();};root.addEventListener?.('resize',onResize,{passive:true});
  preview=placement.getPreview?.()||null;sync();

  return Object.freeze({
    version:'studio-placement-touch-v1.2.0-hold-repeat',move,commit,cancel,rotate,cycleStep,
    get mode(){return mode;},get active(){return !!preview;},get holding(){return holdDir||'';},
    destroy(){if(destroyed)return;destroyed=true;stopHold();unsubscribe?.();root.removeEventListener?.('resize',onResize);pad?.removeEventListener?.('click',onClick);pad?.removeEventListener?.('pointerdown',onPointerDown);pad?.removeEventListener?.('pointerup',stopHold);pad?.removeEventListener?.('pointercancel',stopHold);pad?.removeEventListener?.('lostpointercapture',stopHold);pad?.remove();style?.remove();pad=style=null;}
  });
}
