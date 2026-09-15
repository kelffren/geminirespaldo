/* KELO-INDEX
 * area: STUDIO / CONTEXT SNAP
 * owns: compact Snap cycle control inside the contextual object inspector
 * does-not-own: snap state, placement math, world mutations, history or authority
 * public-api: createStudioContextSnapChip(), nextContextSnap()
 * online: no; delegates to the existing productivity Snap select
 */

export const CONTEXT_SNAP_VALUES=Object.freeze([1,8,16,32,64]);
export function nextContextSnap(current,values=CONTEXT_SNAP_VALUES){
  const rows=(Array.isArray(values)?values:CONTEXT_SNAP_VALUES).map(Number).filter(Number.isFinite);
  if(!rows.length)return 1;
  const index=rows.indexOf(Number(current));
  return rows[(index+1+rows.length)%rows.length];
}

const STYLE_ID='kelo-studio-context-snap-chip-style';
function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-context-snap-chip{min-width:47px!important;width:auto!important;padding:0 7px!important;color:#f0d77d!important;border-color:rgba(231,197,106,.24)!important;font-size:6px!important;font-weight:950!important;letter-spacing:.045em;white-space:nowrap}
    #kelo-studio-live .ks-context-snap-chip[data-snap="1"]{color:#9eb0a8!important}
    @media(max-width:430px){#kelo-studio-live .ks-context-snap-chip{min-width:44px!important;padding:0 6px!important;font-size:5.7px!important}}
  `;
  document.head.appendChild(style);
}

export function createStudioContextSnapChip({root=globalThis}={}){
  const document=root?.document;
  if(!document)return Object.freeze({attach:()=>false,sync(){},destroy(){}});
  ensureStyle(document);
  let shell=null,card=null,button=null,observer=null,destroyed=false,boundSelect=null;

  const sourceSelect=()=>shell?.querySelector?.('[data-ext="snap"]')||null;
  function label(value){return Number(value)===1?'SNAP FREE':`SNAP ${Number(value)||32}`;}
  function sync(){
    const select=sourceSelect();if(!button||!select)return;
    const value=Number(select.value)||32,nextSnap=String(value),nextText=label(value),nextTitle=`Snap actual: ${value===1?'libre':`${value}px`} · toca para cambiar`;
    if(button.dataset.snap!==nextSnap)button.dataset.snap=nextSnap;
    if(button.textContent!==nextText)button.textContent=nextText;
    if(button.title!==nextTitle)button.title=nextTitle;
  }
  function bindSelect(){
    const select=sourceSelect();if(select===boundSelect)return;
    boundSelect?.removeEventListener?.('change',sync);boundSelect=select;boundSelect?.addEventListener?.('change',sync);
  }
  function cycle(){
    const select=sourceSelect();if(!select)return false;
    const available=[...select.options].map(option=>Number(option.value)).filter(Number.isFinite);
    const next=nextContextSnap(select.value,available.length?available:CONTEXT_SNAP_VALUES);
    select.value=String(next);
    const EventCtor=root.Event||globalThis.Event;
    select.dispatchEvent(new EventCtor('change',{bubbles:true}));sync();return true;
  }
  function attach(){
    if(destroyed)return false;
    const nextShell=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
    if(!nextShell)return false;
    const nextCard=nextShell.querySelector('.ks-context-inspector');
    if(!nextCard)return false;
    if(shell===nextShell&&card===nextCard&&button?.isConnected){bindSelect();sync();return true;}
    button?.remove();shell=nextShell;card=nextCard;
    const head=card.querySelector('.ks-context-head'),toggle=head?.querySelector('[data-context-toggle]');if(!head)return false;
    button=document.createElement('button');button.type='button';button.className='ks-context-snap-chip';button.dataset.contextSnap='1';button.setAttribute('aria-label','Cambiar Snap');button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();cycle();});
    head.insertBefore(button,toggle||null);bindSelect();sync();return true;
  }
  function mutationNeedsAttach(mutations=[]){
    if(!button?.isConnected)return true;
    for(const mutation of mutations){
      if(mutation.type!=='childList')continue;
      for(const node of mutation.addedNodes||[]){
        if(node?.id==='kelo-studio-live'||node?.classList?.contains?.('ks-context-inspector')||node?.querySelector?.('#kelo-studio-live,.ks-context-inspector'))return true;
      }
    }
    return false;
  }
  attach();
  if(typeof root.MutationObserver==='function'&&document.body){observer=new root.MutationObserver(mutations=>{if(!destroyed&&mutationNeedsAttach(mutations))attach();});observer.observe(document.body,{childList:true,subtree:true});}
  return Object.freeze({
    attach,sync,cycle,
    destroy(){destroyed=true;observer?.disconnect?.();boundSelect?.removeEventListener?.('change',sync);button?.remove();boundSelect=null;button=null;card=null;shell=null;},
    get value(){return Number(sourceSelect()?.value)||32;}
  });
}
