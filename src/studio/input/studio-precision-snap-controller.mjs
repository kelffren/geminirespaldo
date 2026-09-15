/* KELO-INDEX
 * area: STUDIO / PRECISION SNAP INPUT
 * owns: temporary 1px snap while Shift is held in the live Studio workspace
 * does-not-own: placement math, transform commands, history, authority or persisted snap preference
 * public-api: createStudioPrecisionSnapController(), precisionSnapTransition()
 * online: no; delegates to the existing Studio Snap select and restores its prior value
 */

const SNAP_SELECTOR='#kelo-studio-live [data-ext="snap"]';
const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"]';

const snapValue=value=>Math.max(1,Number(value)||1);

export function precisionSnapTransition({current=32,stored=null,pressed=false}={}){
  const live=snapValue(current);
  if(pressed)return{value:1,stored:stored==null?live:snapValue(stored),active:true};
  return{value:stored==null?live:snapValue(stored),stored:null,active:false};
}

export function createStudioPrecisionSnapController({root=globalThis}={}){
  const document=root?.document;
  if(!document)return Object.freeze({activate:()=>false,release:()=>false,destroy(){},get active(){return false;}});
  let active=false,stored=null,badge=null,destroyed=false;

  const sourceSelect=()=>document.querySelector?.(SNAP_SELECTOR)||null;
  const editableTarget=target=>!!target?.closest?.(EDITABLE_SELECTOR);
  const shellReady=()=>{
    const shell=document.getElementById?.('kelo-studio-live');
    if(!shell)return false;
    if(shell.dataset?.sheetOpen==='1'||shell.dataset?.creatorMinimized==='1')return false;
    return true;
  };
  function emitChange(select){
    const EventCtor=root.Event||globalThis.Event;
    select?.dispatchEvent?.(new EventCtor('change',{bubbles:true}));
  }
  function ensureBadge(){
    const shell=document.getElementById?.('kelo-studio-live');if(!shell)return null;
    if(badge?.isConnected)return badge;
    badge=document.createElement('div');badge.className='ks-precision-snap-badge';badge.dataset.keloStudioUi='1';badge.setAttribute('aria-live','polite');badge.textContent='FINE · 1 PX';
    Object.assign(badge.style,{position:'fixed',left:'50%',bottom:'92px',transform:'translateX(-50%)',zIndex:'329',padding:'6px 10px',border:'1px solid rgba(231,197,106,.45)',borderRadius:'999px',background:'rgba(7,17,19,.95)',color:'#f1dc94',fontSize:'7px',fontWeight:'900',letterSpacing:'.08em',pointerEvents:'none',boxShadow:'0 8px 24px rgba(0,0,0,.35)'});
    shell.appendChild(badge);return badge;
  }
  function activate(){
    if(destroyed||active||!shellReady())return false;
    const select=sourceSelect();if(!select)return false;
    const next=precisionSnapTransition({current:select.value,stored,pressed:true});stored=next.stored;active=true;
    if(String(select.value)!==String(next.value)){select.value=String(next.value);emitChange(select);}
    ensureBadge();return true;
  }
  function release(){
    if(!active)return false;
    const select=sourceSelect(),restore=precisionSnapTransition({current:select?.value,stored,pressed:false});
    active=false;stored=null;badge?.remove();badge=null;
    if(select&&snapValue(select.value)===1&&String(select.value)!==String(restore.value)){select.value=String(restore.value);emitChange(select);}
    return true;
  }
  function onKeyDown(event){
    if(event.key!=='Shift'||event.repeat||editableTarget(event.target))return;
    activate();
  }
  function onKeyUp(event){if(event.key==='Shift')release();}
  function onVisibility(){if(document.visibilityState==='hidden')release();}
  function onBlur(){release();}

  document.addEventListener('keydown',onKeyDown,true);
  document.addEventListener('keyup',onKeyUp,true);
  document.addEventListener('visibilitychange',onVisibility,true);
  root.addEventListener?.('blur',onBlur,true);

  return Object.freeze({
    activate,release,
    destroy(){
      if(destroyed)return;destroyed=true;release();
      document.removeEventListener('keydown',onKeyDown,true);document.removeEventListener('keyup',onKeyUp,true);document.removeEventListener('visibilitychange',onVisibility,true);root.removeEventListener?.('blur',onBlur,true);
    },
    get active(){return active;},get storedSnap(){return stored;}
  });
}
