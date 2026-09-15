/* KELO-INDEX
 * area: CORE
 * keys: EVENTS BUS DECOUPLING REUSABLE
 * hace: bus semántico genérico para desacoplar sistemas; no conoce gameplay, DOM, renderer ni contenido
 * online: transport-agnostic; network adapters pueden publicar/escuchar sin duplicar reglas
 */
(function (root) {
  'use strict';

  const VERSION = 'kelo-event-bus-v1.0.0';
  const listeners = new Map();
  let emitted = 0;

  function on(name, fn) {
    const key = String(name || '');
    if (!key || typeof fn !== 'function') return function () {};
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return function unsubscribe() {
      const set = listeners.get(key);
      if (!set) return false;
      const removed = set.delete(fn);
      if (!set.size) listeners.delete(key);
      return removed;
    };
  }

  function once(name, fn) {
    if (typeof fn !== 'function') return function () {};
    let stop = null;
    stop = on(name, function (payload) {
      if (stop) stop();
      fn(payload);
    });
    return stop;
  }

  function emit(name, payload) {
    const key = String(name || '');
    if (!key) return 0;
    emitted += 1;
    const set = listeners.get(key);
    if (!set || !set.size) return 0;
    let delivered = 0;
    Array.from(set).forEach(function (fn) {
      try { fn(payload); delivered += 1; }
      catch (error) { console.error('[KeloEvents]', key, error); }
    });
    return delivered;
  }

  function clear(name) {
    if (name == null) { listeners.clear(); return true; }
    return listeners.delete(String(name));
  }

  function metrics() {
    let subscriptions = 0;
    listeners.forEach(function (set) { subscriptions += set.size; });
    return Object.freeze({ version: VERSION, eventNames: listeners.size, subscriptions: subscriptions, emitted: emitted });
  }

  root.KELO_EVENT_BUS_AUDIT = { version:VERSION, ready:true, generic:true, domFree:true, gameplayFree:true };
  root.KeloEvents = Object.freeze({ version:VERSION, on:on, once:once, emit:emit, clear:clear, metrics:metrics });
})(typeof globalThis !== 'undefined' ? globalThis : window);
