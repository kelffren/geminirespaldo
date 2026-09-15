/* KELO-INDEX
 * area: STUDIO / OVERLAY CANVAS
 * owns: optional separate editor canvas lifecycle
 * does-not-own: world canvas or input
 * public-api: createStudioOverlayCanvas()
 * online: no
 * mobile: iPhone must keep a viewport-sized dpr=1 overlay; body-sized dpr=1.5 backing stores were killing Safari after Studio chrome painted
 */

function isOverlayPhone(){
  const ua=String(globalThis.navigator?.userAgent||'');
  const short=Math.min(Number(globalThis.innerWidth)||999,Number(globalThis.innerHeight)||999);
  return /iPhone|iPad|iPod|Android/i.test(ua)||short<=900;
}

function capOverlayDpr(raw){
  const n=Math.max(1,Number(raw)||1);
  return Math.min(n, isOverlayPhone() ? 1 : 2);
}

function overlayViewportSize(){
  const vv=globalThis.visualViewport;
  const width=Number(vv?.width)||Number(globalThis.innerWidth)||1;
  const height=Number(vv?.height)||Number(globalThis.innerHeight)||1;
  return {width:Math.max(1,width),height:Math.max(1,height)};
}

export function createStudioOverlayCanvas({ host = globalThis.document?.body, className = 'kelo-studio-overlay' } = {}) {
  const document = host?.ownerDocument || globalThis.document;
  if (!document || !host?.appendChild) throw new Error('STUDIO_OVERLAY_HOST_REQUIRED');
  const canvas = document.createElement('canvas');
  canvas.className = className;
  Object.assign(canvas.style, {
    position:'fixed',
    left:'0',
    top:'0',
    right:'auto',
    bottom:'auto',
    width:'100%',
    height:'100%',
    pointerEvents:'none',
    zIndex:'240'
  });
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha:true });
  let dprCap = capOverlayDpr(globalThis.devicePixelRatio || 1);
  function resize(width, height, dpr = dprCap) {
    const view=overlayViewportSize();
    const cssW=Math.max(1, Number(width)||view.width);
    const cssH=Math.max(1, Number(height)||view.height);
    dprCap = capOverlayDpr(dpr);
    canvas.style.width=cssW+'px';
    canvas.style.height=cssH+'px';
    const w=Math.max(1,Math.round(cssW*dprCap)), h=Math.max(1,Math.round(cssH*dprCap));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;ctx.setTransform(dprCap,0,0,dprCap,0,0); return {width:cssW,height:cssH,dpr:dprCap};
  }
  function clear() { ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore(); ctx.setTransform(dprCap,0,0,dprCap,0,0); }
  resize();
  return Object.freeze({ canvas, ctx, resize, clear, get dpr(){return dprCap;}, destroy(){ canvas.remove(); } });
}
