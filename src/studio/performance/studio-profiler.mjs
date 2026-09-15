/* KELO-INDEX
 * area: STUDIO / PERFORMANCE
 * owns: lightweight timing/long-task telemetry for Studio work
 * does-not-own: rendering strategy or browser devtools
 * public-api: createStudioProfiler()
 * online: local telemetry unless explicitly exported later
 */

export function createStudioProfiler({ performanceApi = globalThis.performance, PerformanceObserverCtor = globalThis.PerformanceObserver, observeLongTasks = true } = {}) {
  const active = new Map(), samples = new Map(), longTasks = [];
  let observer = null;
  const now = () => performanceApi?.now?.() ?? Date.now();

  function record(name, ms) {
    name = String(name); if (!samples.has(name)) samples.set(name, []);
    const rows = samples.get(name); rows.push(Math.max(0, Number(ms) || 0)); if (rows.length > 120) rows.shift();
  }
  function begin(name) { active.set(String(name), now()); }
  function end(name) { name = String(name); const start = active.get(name); if (start == null) return null; active.delete(name); const ms = now() - start; record(name, ms); return ms; }
  function measure(name, fn) { begin(name); try { const out = fn(); if (out?.then) return out.finally(() => end(name)); end(name); return out; } catch (e) { end(name); throw e; } }
  function summary(rows) { if (!rows?.length) return { count: 0, avg: 0, max: 0 }; const total = rows.reduce((a,b) => a+b,0); return { count: rows.length, avg: total/rows.length, max: Math.max(...rows) }; }

  if (observeLongTasks && typeof PerformanceObserverCtor === 'function') {
    try {
      observer = new PerformanceObserverCtor(list => { for (const entry of list.getEntries()) { longTasks.push({ startTime: entry.startTime, duration: entry.duration }); if (longTasks.length > 50) longTasks.shift(); } });
      observer.observe({ type: 'longtask', buffered: true });
    } catch { observer = null; }
  }

  return Object.freeze({ begin, end, measure, record, snapshot: () => ({ timings: Object.fromEntries([...samples].map(([name, rows]) => [name, summary(rows)])), longTasks: longTasks.slice() }), close: () => observer?.disconnect?.() });
}
