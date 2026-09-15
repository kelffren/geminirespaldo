/* KELO-INDEX
 * area: STUDIO / VIRTUAL LIST
 * owns: visible range math for large Asset Browser/Outliner collections
 * does-not-own: DOM rendering
 * public-api: virtualRange()
 * online: no
 */

export function virtualRange({ count, rowHeight, scrollTop, viewportHeight, overscan = 4 } = {}) {
  count = Math.max(0, Math.floor(Number(count) || 0)); rowHeight = Math.max(1, Number(rowHeight) || 1); scrollTop = Math.max(0, Number(scrollTop) || 0); viewportHeight = Math.max(0, Number(viewportHeight) || 0); overscan = Math.max(0, Math.floor(Number(overscan) || 0));
  const firstVisible = Math.floor(scrollTop / rowHeight), visibleCount = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, firstVisible - overscan), end = Math.min(count, firstVisible + visibleCount + overscan);
  return { start, end, count: Math.max(0, end - start), offsetTop: start * rowHeight, totalHeight: count * rowHeight };
}
