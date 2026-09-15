import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const files = {
  updater: read('src/core/update-system-v5.js'),
  gate: read('src/core/update-gate.js'),
  worker: read('src/core/update-verifier-worker.js'),
  intelligence: read('src/core/update-intelligence-ui.js'),
  settings: read('src/core/settings-lazy-gate.js'),
  index: read('index.html'),
};

const failures = [];
function requireText(name, text, needle, why) {
  if (!text.includes(needle)) failures.push(`${name}: missing ${JSON.stringify(needle)} — ${why}`);
}
function forbidText(name, text, needle, why) {
  if (text.includes(needle)) failures.push(`${name}: forbidden ${JSON.stringify(needle)} — ${why}`);
}
function requireRegex(name, text, regex, why) {
  if (!regex.test(text)) failures.push(`${name}: missing ${regex} — ${why}`);
}

// Updater: exact delta, predictive hotset, verification, health/quarantine.
requireText('updater', files.updater, 'api.github.com/repos/kelffren/gemini/compare/', 'updates must use commit delta instead of repo-wide manifest walking');
requireText('updater', files.updater, '__KELO_UPDATE_HINT__', 'gate must be able to hand off the already-detected build without another version trip');
requireText('updater', files.updater, '__KELO_UPDATE_EARLY_HEALTH__', 'post-update boot health must include failures before the updater itself loads');
requireText('updater', files.updater, 'kelo.world.updater.hotset.v1', 'frequently used modules must remain learnable/predictive');
requireText('updater', files.updater, 'kelo.world.updater.blockedBuild.v5', 'bad builds need quarantine state');
requireText('updater', files.updater, "emit('consistency-wait'", 'CDN mixed-version windows must be observable and retried');
requireText('updater', files.updater, 'checkSyntax:entry.classic===true', 'syntax compilation is allowed only for target-index classic scripts');
requireRegex('updater', files.updater, /const MAX_CONCURRENCY=6\b/, 'parallel warmup must stay bounded');
forbidText('updater', files.updater, '/git/trees/', 'a repo-wide Git tree walk destroys small-delta latency');
forbidText('updater', files.updater, 'serviceWorker.register', 'iPhone updater must never depend on Service Worker registration');
forbidText('updater', files.updater, 'setInterval(', 'update engine must not add a permanent polling loop');

// Gate: cheap compare seed, safe zero-byte fast-forward, learning and lazy heavy updater.
requireText('gate', files.gate, 'kelo-update-gate-v6-live-fast-forward', 'the active lightweight gate contract must stay versioned');
requireText('gate', files.gate, '__KELO_UPDATE_HINT__', 'gate should pass deployment knowledge to V5.1');
requireText('gate', files.gate, 'kelo.world.updater.hotset.v1', 'normal sessions must train the predictive cache');
requireText('gate', files.gate, 'kelo.world.updater.compare.v5.', 'gate compare must seed the cache V5.1 already consumes');
requireText('gate', files.gate, "emit('fast-forward'", 'non-runtime-only deployments should advance with zero asset download and no reload');
requireText('gate', files.gate, "p.startsWith('.github/')", 'fast-forward must be allowlisted to clearly non-runtime repository paths');
requireText('gate', files.gate, 'src/core/update-system-v5.js?v=5.1-health-hint', 'heavy updater must remain lazy and current');
forbidText('gate', files.gate, 'setInterval(', 'gate must use a single rescheduled timeout, never a permanent interval');
forbidText('gate', files.gate, '/git/trees/', 'gate must never regress to repository tree walking');
forbidText('gate', files.gate, 'update-system-v4.js', 'V4 must not be reactivated accidentally');

// Worker: verification is isolated from game/render/network.
requireText('worker', files.worker, "digest('SHA-1'", 'Git blob SHA must be computed off-main-thread');
requireText('worker', files.worker, "new Function(text)", 'classic JS parse/compile check must remain non-executing');
forbidText('worker', files.worker, 'fetch(', 'verification worker must not own networking');
forbidText('worker', files.worker, 'document.', 'verification worker must never touch DOM/game UI');

// Boot: only pending-update boots arm the early error recorder.
requireText('index', files.index, "sessionStorage.getItem('kelo.world.updater.pendingBuild.v5')", 'normal boots must not pay the early-health listener cost');
requireText('index', files.index, '__KELO_UPDATE_EARLY_HEALTH__', 'pending-update boots must expose early health evidence');
requireText('index', files.index, 'src/core/update-gate.js?v=6-live-fast-forward', 'Safari must not reuse an older gate');
requireText('index', files.index, 'src/core/settings-lazy-gate.js?v=3-update-intel', 'Safari must not reuse the older Settings gate after Intelligence V2');

// Settings observability must remain first-use only, truthful, and event-driven.
requireText('settings', files.settings, 'kelo-settings-lazy-gate-v3-update-intelligence', 'Settings lazy gate must remain on the V3 first-use contract');
requireText('settings', files.settings, 'update-intelligence-ui.js?v=2-fast-forward-health', 'Update Intelligence V2 must stay first-use only');
requireText('intelligence', files.intelligence, 'kelo-update-intelligence-ui-v2', 'the visible diagnostics contract must stay versioned');
requireText('intelligence', files.intelligence, "'fast-forward'", 'V6 zero-byte fast-forward must be observable in Settings');
requireText('intelligence', files.intelligence, 'Hashes reales', 'UI must separate hash evidence from generic updater state');
requireText('intelligence', files.intelligence, 'Early errors', 'early boot health evidence must be visible');
requireText('intelligence', files.intelligence, 'Hint reused', 'duplicate version-request elimination must be observable');
requireText('intelligence', files.intelligence, 'Copiar diagnóstico', 'mobile support must retain one-tap diagnostic export');
forbidText('intelligence', files.intelligence, 'setInterval(', 'diagnostics UI must react to updater events instead of polling');

if (failures.length) {
  console.error('\nKELO UPDATE OS V6 CONTRACT FAILED\n');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log('KELO UPDATE OS V6 CONTRACT: OK');
console.log('✓ exact commit delta + shared compare seed');
console.log('✓ zero-download non-runtime fast-forward');
console.log('✓ predictive hotset');
console.log('✓ off-main-thread integrity verification');
console.log('✓ CDN consistency barrier');
console.log('✓ early + post-boot health shield');
console.log('✓ iPhone path has no mandatory Service Worker');
console.log('✓ lazy, truthful, event-driven observability');
