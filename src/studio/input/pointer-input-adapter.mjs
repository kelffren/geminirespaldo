/* KELO-INDEX
 * area: STUDIO / POINTER ADAPTER
 * owns: optional DOM PointerEvent binding with capture and rAF-coalesced move
 * does-not-own: tool semantics or gameplay input
 * public-api: attachStudioPointerInput()
 * online: no
 */

export function attachStudioPointerInput({ element, router, toWorld = (x,y) => ({x,y}), requestFrame = globalThis.requestAnimationFrame, capture = false, shouldHandle = () => true, stopPropagation = false } = {}) {
  if (!element?.addEventListener || !router) throw new Error('STUDIO_POINTER_DEPENDENCY_MISSING');
  let pointerId = null, latestMove = null, frame = 0, captureElement = null;
  const raf = typeof requestFrame === 'function' ? requestFrame.bind(globalThis) : fn => setTimeout(fn, 16);
  const optionsActive = { passive: false, capture: !!capture }, optionsMove = { passive: true, capture: !!capture };
  function payload(event) { const world = toWorld(event.clientX, event.clientY); return { originalEvent: event, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, worldX: world.x, worldY: world.y, buttons: event.buttons, pressure: event.pressure, pointerType: event.pointerType }; }
  function block(event, result) { if (!result?.handled) return; event.preventDefault?.(); if (stopPropagation) event.stopImmediatePropagation?.(); }
  function flushMove() { frame = 0; const event = latestMove; latestMove = null; if (!event || !shouldHandle(event)) return; const result = router.route('pointermove', payload(event)); if (result.handled && stopPropagation) event.stopImmediatePropagation?.(); }
  function down(event) { if (!shouldHandle(event)) return; pointerId = event.pointerId; captureElement = event.target?.setPointerCapture ? event.target : element?.setPointerCapture ? element : null; try { captureElement?.setPointerCapture?.(event.pointerId); } catch {} const result = router.route('pointerdown', payload(event)); block(event, result); }
  function move(event) { if (!shouldHandle(event) || (pointerId != null && event.pointerId !== pointerId)) return; latestMove = event; if (!frame) frame = raf(flushMove); }
  function up(event) { if (!shouldHandle(event) || (pointerId != null && event.pointerId !== pointerId)) return; if (latestMove) flushMove(); const result = router.route(event.type === 'pointercancel' ? 'pointercancel' : 'pointerup', payload(event)); try { captureElement?.releasePointerCapture?.(event.pointerId); } catch {} pointerId = null; captureElement = null; block(event, result); }
  element.addEventListener('pointerdown', down, optionsActive); element.addEventListener('pointermove', move, optionsMove); element.addEventListener('pointerup', up, optionsActive); element.addEventListener('pointercancel', up, optionsActive);
  return () => { element.removeEventListener('pointerdown', down, optionsActive); element.removeEventListener('pointermove', move, optionsMove); element.removeEventListener('pointerup', up, optionsActive); element.removeEventListener('pointercancel', up, optionsActive); };
}
