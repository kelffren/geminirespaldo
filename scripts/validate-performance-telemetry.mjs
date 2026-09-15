/* KELO-INDEX
 * area: BUILD
 * keys: PERFORMANCE FRAME TELEMETRY P95 P99 STALL VISIBILITY LOAF CI
 * hace: valida que el governor mida stalls reales y conserve el lifecycle/auto-tuning actual
 * online: N/A; gate estatico de CI
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('src/systems/performance-governor.js', 'utf8');

const mustContain = [
  "const VERSION = '1.2.1'",
  'const FRAME_WINDOW = 600',
  'function recordFrame(frameMs)',
  'frameP50Ms',
  'frameP95Ms',
  'frameP99Ms',
  'worstFrameMs',
  'framesOver33',
  'framesOver50',
  'framesOver100',
  'framesOver120',
  "document.addEventListener('visibilitychange'",
  "includes('long-animation-frame')",
  "observer.observe({ type: 'long-animation-frame', buffered: true })",
  'getFrameTelemetry',
  'if (!document.hidden && rawDt > 0) {',
  'recordFrame(rawDt);',
  'if (rawDt < 120) emaFrameMs',
  'if (rawDt < 120) autoTune(rawDt, snapshot);',
  'CLIENT_HIDDEN',
  'CLIENT_VISIBLE'
];

for (const token of mustContain) assert.ok(src.includes(token), `performance telemetry contract missing: ${token}`);
assert.ok(!src.includes('if (!document.hidden && rawDt > 0 && rawDt < 120)'), 'severe stalls are still excluded by the outer measurement gate');
assert.ok(src.indexOf('recordFrame(rawDt);') < src.indexOf('if (rawDt < 120) emaFrameMs'), 'stall must be recorded before legacy EMA filter');
assert.ok(src.includes('lastFrameAt = performance.now();\n    if (!document.hidden) visibilityResets += 1;'), 'visibility resume must reset the frame clock before the next rAF delta');

console.log('PERFORMANCE_TELEMETRY_PASS version=1.2.1 window=600 percentiles=p50,p95,p99 stalls=>33,50,100,120 visibility=semantic-lifecycle LoAF=feature-detected autotune=unchanged');
