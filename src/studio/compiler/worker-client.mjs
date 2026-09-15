/* KELO-INDEX
 * area: STUDIO / WORKER CLIENT
 * owns: lazy worker lifecycle and compile fallback
 * does-not-own: compiler algorithms or UI
 * public-api: createStudioWorkerClient()
 * online: no
 */

import { createWorldCompiler } from './world-compiler.mjs';

export function createStudioWorkerClient({ WorkerCtor = globalThis.Worker, prefabSnapshot = () => ({}), resolvePrefab = id => ({ id }) } = {}) {
  let worker = null, seq = 1;
  const pending = new Map();
  const fallback = createWorldCompiler({ resolvePrefab });

  function ensureWorker() {
    if (worker || typeof WorkerCtor !== 'function') return worker;
    worker = new WorkerCtor(new URL('./studio-worker.mjs', import.meta.url), { type: 'module', name: 'kelo-studio-worker' });
    worker.onmessage = event => {
      const message = event.data || {}, request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.ok) request.resolve(message.result); else request.reject(new Error(message.error || 'STUDIO_WORKER_FAILED'));
    };
    worker.onerror = () => {
      for (const request of pending.values()) request.reject(new Error('STUDIO_WORKER_CRASHED'));
      pending.clear();
      try { worker?.terminate?.(); } catch {}
      worker = null;
    };
    return worker;
  }

  function compile(document, options = {}) {
    const active = ensureWorker();
    if (!active) return Promise.resolve(fallback.compile(document, options));
    const id = seq++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      active.postMessage({ id, type: 'compile', document, prefabs: prefabSnapshot(), options });
    });
  }

  function close() { try { worker?.terminate?.(); } catch {} worker = null; for (const request of pending.values()) request.reject(new Error('STUDIO_WORKER_CLOSED')); pending.clear(); }
  return Object.freeze({ compile, close, get active() { return !!worker; } });
}
