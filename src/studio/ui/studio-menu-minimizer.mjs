/* KELO-INDEX
 * area: STUDIO / MENU MINIMIZER
 * owns: independent collapse/expand state for the creator tool menu
 * does-not-own: Studio lifecycle, document mutations, tools or gameplay
 * public-api: createStudioMenuMinimizer(), setStudioMenuMinimized()
 * online: no; session-local UI state only
 */

const STYLE_ID='kelo-studio-menu-minimizer-style';

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-menu-minimize{
      flex:0 0 auto;min-width:38px;height:36px;padding:0 9px;border:1px solid rgba(231,197,106,.28);
      border-radius:11px;background:#0f1b1d;color:#f4dd8d;font-size:15px;font-weight:900;line-height:1
    }
    #kelo-studio-live .ks-menu-minimize:hover{border-color:rgba(231,197,106,.58)}
    #kelo-studio-live .ks-bottom.ks-menu-minimized{width:min(520px,calc(100vw - 24px));max-height:70px;overflow:hidden;padding:7px 9px}
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-body,
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-status,
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-tabs,
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-mobile-sheet{display:none!important}
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-head{min-height:48px;padding:0;border-bottom:0}
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-emblem{width:34px;height:34px;flex-basis:34px}
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-active-tool{min-width:0;max-width:220px;padding:6px 8px}
    #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-selection-badge{display:none}
    @media(max-width:760px){
      #kelo-studio-live .ks-bottom.ks-menu-minimized{left:8px;right:8px;width:auto;max-height:64px;padding:6px 8px}
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-brand small{display:none}
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-active-tool{max-width:44%;margin-left:auto}
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-menu-minimize{min-width:40px;height:38px;padding:0 8px}
    }
    @media(max-width:430px){
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-emblem{display:none}
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-deck-brand strong{font-size:8px}
      #kelo-studio-live .ks-bottom.ks-menu-minimized .ks-active-tool{max-width:48%}
    }
  `;
  document.head.appendChild(style);
}

export function setStudioMenuMinimized(bottom,button,next){
  const minimized=!!next;
  bottom?.classList?.toggle?.('ks-menu-minimized',minimized);
  if(bottom?.dataset)bottom.dataset.menuMinimized=minimized?'1':'0';
  if(button){
    button.textContent=minimized?'▴':'—';
    button.title=minimized?'Expandir menú':'Minimizar menú';
    button.setAttribute?.('aria-label',minimized?'Expandir menú de Kelo Studio':'Minimizar menú de Kelo Studio');
    button.setAttribute?.('aria-expanded',minimized?'false':'true');
  }
  return minimized;
}

export function createStudioMenuMinimizer({root=globalThis}={}){
  const document=root?.document;
  if(!document)return Object.freeze({attach:()=>false,destroy(){},get minimized(){return false;}});
  ensureStyle(document);

  let shell=null,bottom=null,head=null,button=null,minimized=false,observer=null,destroyed=false;

  function detachButton(){button?.remove?.();button=null;bottom=null;head=null;shell=null;}

  function attach(){
    if(destroyed)return false;
    const nextShell=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
    const nextBottom=nextShell?.querySelector?.('.ks-bottom');
    const nextHead=nextBottom?.querySelector?.('.ks-deck-head');
    if(!nextShell||!nextBottom||!nextHead)return false;
    if(button&&shell===nextShell&&head===nextHead)return true;
    detachButton();shell=nextShell;bottom=nextBottom;head=nextHead;
    button=document.createElement('button');
    button.type='button';button.className='ks-menu-minimize';button.dataset.studioMenuMinimize='1';button.dataset.keloStudioUi='1';
    button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();minimized=setStudioMenuMinimized(bottom,button,!minimized);});
    head.appendChild(button);
    minimized=setStudioMenuMinimized(bottom,button,minimized);
    return true;
  }

  attach();
  if(typeof root.MutationObserver==='function'&&document.body){
    observer=new root.MutationObserver(()=>{
      if(destroyed)return;
      const live=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
      if(!live){detachButton();return;}
      if(live!==shell||!button?.isConnected)attach();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  return Object.freeze({
    attach,
    setMinimized(value){minimized=setStudioMenuMinimized(bottom,button,value);return minimized;},
    toggle(){minimized=setStudioMenuMinimized(bottom,button,!minimized);return minimized;},
    destroy(){destroyed=true;observer?.disconnect?.();observer=null;detachButton();},
    get minimized(){return minimized;}
  });
}
