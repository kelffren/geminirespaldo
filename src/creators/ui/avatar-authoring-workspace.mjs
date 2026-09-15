/* KELO-INDEX
 * area: CREATORS / AVATAR AUTHORING
 * owner: composition helper joining Frame Surgery and persistent 4x4 Frame Builder
 * purpose: attach the PR 155 frame-by-frame path to an already-open PR 159 Frame Surgery session
 * does-not-own: workspace routing, Frame Doctor, compiler, renderer, persistence authority or avatar activation
 */
import {openAvatarFrameBuilder} from './avatar-frame-builder.mjs';
const F=Object.freeze;
const installed=new WeakMap();

export function attachFrameBuilderToSurgery({root=globalThis,avatarQuick,session}={}){
  const shell=session?.shell;if(!shell||!avatarQuick)return session;
  const existing=installed.get(shell);if(existing?.session&&shell.isConnected)return existing.session;
  const drop=shell.querySelector?.('.drop');if(!drop)return session;
  const button=root.document.createElement('button');button.type='button';button.dataset.keloFrameBuilder='';button.textContent='CONSTRUIR 4×4 · FRAME A FRAME';button.style.cssText='width:100%;margin:10px 0 0;padding:13px;min-height:50px;border:1px solid #6b5a2e;border-radius:13px;background:#171b23;color:#e8cf82;font-weight:900;touch-action:manipulation';drop.insertAdjacentElement('afterend',button);
  let builderSession=null,opening=null,closed=false;
  const openBuilder=()=>{if(closed||!shell.isConnected||builderSession?.shell?.isConnected||opening)return;opening=openAvatarFrameBuilder({root,avatarQuick,onClose:()=>{builderSession=null;}}).then(next=>{opening=null;if(closed||!shell.isConnected){next?.close?.();return null;}builderSession=next;return next;}).catch(error=>{opening=null;root.console?.warn?.('KELO_AVATAR_FRAME_BUILDER_OPEN_FAILED',error);return null;});};
  button.addEventListener('click',openBuilder);
  const baseClose=typeof session.close==='function'?session.close:null;
  const closeAll=()=>{if(closed)return;closed=true;button.removeEventListener('click',openBuilder);try{builderSession?.close?.();}catch{}builderSession=null;installed.delete(shell);baseClose?.call?.(session);};
  const publicSession=F({...session,version:`${session.version||'frame-surgery'}+frame-builder-v1`,frameBuilderButton:button,close:closeAll});
  installed.set(shell,{button,session:publicSession});
  return publicSession;
}
