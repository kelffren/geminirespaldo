/* KELO-INDEX
 * area: UI / MOUNT ABILITIES
 * owner: mount ability HUD consumer
 * purpose: muestra M1/M2/M3 solo montado y traduce gestos touch a KeloMountAbilityChannel.cast
 * public-api: KELO_MOUNT_ACTION_BAR.refresh/destroy
 * consumes: KeloMounts + KeloMountAbilityChannel + KeloRender
 * state-owned: DOM/gesture local únicamente
 * online: N/A; gameplay request sale por channel/authority
 * do-not: no escribir STATE, cooldowns, posición ni stats directamente; no crear otro render loop
 */
(function(root){'use strict';if(root.KELO_MOUNT_ACTION_BAR)return;const Channel=root.KeloMountAbilityChannel,Mounts=root.KeloMounts;if(!Channel||!Mounts)return;
let bar=null,renderHookId=null,lastPaintAt=0;const aim={slot:-1,active:false,x0:0,y0:0,x1:0,y1:0};
function dir(x,y){const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function ensure(){if(bar)return bar;bar=document.createElement('div');bar.id='mount-action-bar-container';bar.setAttribute('aria-label','Habilidades de montura');bar.style.cssText='position:absolute;left:50%;bottom:max(112px,calc(env(safe-area-inset-bottom) + 112px));transform:translateX(-50%);z-index:86;display:none;gap:8px;pointer-events:auto;align-items:center;justify-content:center;padding:6px 8px;border-radius:18px;background:rgba(7,9,13,.72);border:1px solid rgba(231,197,106,.24);backdrop-filter:blur(10px)';(document.getElementById('ui-layer')||document.body).appendChild(bar);for(let i=0;i<3;i++){const b=document.createElement('button');b.type='button';b.dataset.mountSlot=String(i);b.style.cssText='position:relative;width:58px;height:58px;border-radius:16px;border:1px solid rgba(231,197,106,.55);background:rgba(16,20,28,.96);color:#fff;font:800 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:grid;place-items:center;touch-action:none;overflow:hidden';bind(b,i);bar.appendChild(b);}return bar;}
function cast(slot,dx,dy){const instance=Channel.getSlots()[slot];if(!instance)return;const d=dir(dx||1,dy||0),target=instance.definition.targeting||{};if(target.type==='position'){const zoom=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1,amount=Math.min(target.range||300,Math.hypot(dx,dy)/zoom*1.2||80);return Channel.cast({slotIndex:slot,direction:d,position:{x:localPlayer.x+d.x*amount,y:localPlayer.y+d.y*amount}});}return Channel.cast({slotIndex:slot,direction:d});}
function bind(button,slot){button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const inst=Channel.getSlots()[slot];if(!inst)return;if(inst.definition.targeting?.type==='self'){cast(slot,1,0);paint();return;}aim.slot=slot;aim.active=true;aim.x0=aim.x1=e.clientX;aim.y0=aim.y1=e.clientY;try{button.setPointerCapture(e.pointerId);}catch(_e){}});button.addEventListener('pointermove',e=>{if(aim.active&&aim.slot===slot){aim.x1=e.clientX;aim.y1=e.clientY;}});button.addEventListener('pointerup',()=>{if(!aim.active||aim.slot!==slot)return;aim.active=false;cast(slot,aim.x1-aim.x0,aim.y1-aim.y0);paint();});button.addEventListener('pointercancel',()=>{if(aim.slot===slot)aim.active=false;});}
function paint(){ensure();Channel.sync(false);const mounted=Mounts.isMounted();bar.style.display=mounted?'flex':'none';if(!mounted)return;const slots=Channel.getSlots();bar.querySelectorAll('[data-mount-slot]').forEach((b,i)=>{const inst=slots[i],left=Channel.getRemainingCooldown(i);if(!inst){b.innerHTML='<span style="opacity:.35">M'+(i+1)+'</span>';b.disabled=true;return;}b.disabled=false;b.innerHTML='<span style="font-size:20px;line-height:1">'+(inst.definition.icon||'◆')+'</span><span style="font-size:8px">M'+(i+1)+' · '+inst.definition.name.split(' ')[0]+'</span>'+(left>0?'<span style="position:absolute;inset:0;background:rgba(0,0,0,.64);display:grid;place-items:center;font-size:13px">'+left.toFixed(1)+'</span>':'');});}
function renderPaint(){const now=(root.performance?.now?.()||Date.now());if(now-lastPaintAt<100)return;lastPaintAt=now;paint();}
function refresh(){ensure();Channel.sync(true);lastPaintAt=0;paint();}
function onMount(){refresh();}
root.addEventListener?.('KELO_MOUNT_CHANGED',onMount);root.addEventListener?.('KELO_MOUNTED',onMount);root.addEventListener?.('KELO_DISMOUNTED',onMount);ensure();refresh();
if(root.KeloRender?.afterFrame)renderHookId=root.KeloRender.afterFrame('mount-action-bar:cooldown-ui',renderPaint,1200);
root.KELO_MOUNT_ACTION_BAR=Object.freeze({version:'mount-action-bar-v1.0.1',refresh,destroy(){if(renderHookId&&root.KeloRender?.unregister)root.KeloRender.unregister(renderHookId);renderHookId=null;root.removeEventListener?.('KELO_MOUNT_CHANGED',onMount);root.removeEventListener?.('KELO_MOUNTED',onMount);root.removeEventListener?.('KELO_DISMOUNTED',onMount);bar?.remove();bar=null;}});
})(typeof globalThis!=='undefined'?globalThis:window);
