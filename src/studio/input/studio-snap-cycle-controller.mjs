/* KELO-INDEX
 * area: STUDIO / INPUT / SNAP CYCLE
 * owns: fast desktop keyboard cycling through canonical Studio snap steps
 * does-not-own: document mutation, CommandBus, authority, transform math or rendering
 * public-api: createStudioSnapCycleController(), resolveStudioSnapCycle()
 * online: local UI state only; delegates to the canonical snap select via change event
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
export const STUDIO_SNAP_STEPS=Object.freeze([1,8,16,32,64]);

export function resolveStudioSnapCycle(value,direction=1,steps=STUDIO_SNAP_STEPS){
  const list=[...new Set((steps||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0))].sort((a,b)=>a-b);
  if(!list.length)return null;
  const current=Number(value);
  if(direction<0){
    const lower=[...list].reverse().find(v=>v<current);
    return lower??list[list.length-1];
  }
  const higher=list.find(v=>v>current);
  return higher??list[0];
}

export function createStudioSnapCycleController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({destroy(){},cycle:()=>false});
  let destroyed=false;

  const control=()=>document.querySelector?.('#kelo-studio-live [data-ext="snap"]')||null;
  function cycle(direction=1){
    const select=control();
    if(!select||select.disabled)return false;
    const next=resolveStudioSnapCycle(select.value,direction);
    if(next==null)return false;
    select.value=String(next);
    const EventCtor=root.Event||globalThis.Event;
    select.dispatchEvent?.(new EventCtor('change',{bubbles:true}));
    return next;
  }

  function onKey(event){
    const altGraph=!!event.getModifierState?.('AltGraph');
    if(destroyed||event.defaultPrevented||event.repeat||event.metaKey||event.shiftKey||(!altGraph&&(event.ctrlKey||event.altKey)))return;
    if(event.target?.closest?.(EDITABLE))return;
    if(event.key!==']'&&event.key!=='[')return;
    const changed=cycle(event.key===']'?1:-1);
    if(changed===false)return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    version:'studio-snap-cycle-v1.0.1',cycle,
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener?.('keydown',onKey,true);}
  });
}
