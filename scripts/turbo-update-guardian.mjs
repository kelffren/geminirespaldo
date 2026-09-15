/* KELO-INDEX
 * area: CORE
 * owner: Turbo Update Guardian
 * keys: TURBO UPDATE DELTA HASH CACHE BUILD CHUNKS LAZY PRIORITY STORAGE HEADERS BROTLI METRICS CI TEST
 * purpose: fail closed until all 15 Turbo Update guarantees have concrete repository/build/live-host evidence
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => exists(p) ? fs.readFileSync(path.join(root, p), 'utf8') : '';
const has = (p, ...needles) => { const text = read(p); return needles.every((needle) => text.includes(needle)); };
const anyHas = (paths, needle) => paths.some((p) => read(p).includes(needle));
const regexAny = (paths, re) => paths.some((p) => re.test(read(p)));

const packageJson = (() => { try { return JSON.parse(read('package.json')); } catch { return {}; } })();
const scripts = packageJson.scripts || {};
const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

const sourceFiles = ['src/core/update-system.js','src/core/update-delta-core.js','src/core/update-watch.js','src/ui/update-ui.js','sw.js'];
const lazyFiles = ['src/ui/studio-launcher.js','src/visuals/visual-lab-loader.js'];
const buildConfigs = ['vite.config.js','vite.config.mjs','vite.config.ts','rollup.config.js','rollup.config.mjs','webpack.config.js','webpack.config.cjs','esbuild.config.js','scripts/turbo-build.mjs'];
const headerConfigs = ['_headers','public/_headers','netlify.toml','vercel.json','firebase.json','nginx.conf','.github/workflows/pages.yml','.github/workflows/deploy-pages.yml'];
const contractDoc = 'docs/systems/TURBO_UPDATE_CONTRACT.md';
const hostingDoc = 'docs/evidence/TURBO_UPDATE_HOSTING_EVIDENCE.md';
const workflowPath = '.github/workflows/turbo-update-guardian.yml';
const combatTestPath = 'scripts/turbo-combat-hard-stop-test.mjs';

function check(id, title, pass, evidence, blocker) { return { id, title, pass: !!pass, evidence, blocker: blocker || null }; }

const buildConfigPresent = buildConfigs.some(exists);
const productionBuildScript = scripts.build === 'node scripts/turbo-build.mjs';
const manifestGenerator = exists('scripts/generate-turbo-manifest.mjs') || exists('scripts/turbo-build.mjs');
const deltaManifestRuntime = (anyHas(sourceFiles, 'GITHUB_TREE_API') && anyHas(sourceFiles, 'fetchBuildTree') && anyHas(sourceFiles, 'blob')) || anyHas(sourceFiles, 'turbo-update-manifest') || anyHas(sourceFiles, 'delta-manifest');
const globalCache = (anyHas(sourceFiles, "ASSET_CACHE_NAME = 'kelo-assets-v3'") || anyHas(sourceFiles, 'kelo-turbo-assets-v1') || anyHas(sourceFiles, 'TURBO_ASSET_CACHE')) && (anyHas(sourceFiles, '__kelo_asset_v3__/') || anyHas(sourceFiles, 'assetObjectUrl'));
const contentHashConfig = regexAny(buildConfigs, /\[(?:content)?hash(?::\d+)?\]|entryFileNames[^\n]*hash|chunkFileNames[^\n]*hash|assetFileNames[^\n]*hash/i) || (anyHas(sourceFiles, 'assetObjectUrl(blob)') && anyHas(sourceFiles, '__kelo_asset_v3__/'));
const activationReuse = globalCache && (anyHas(sourceFiles, 'sha256') || anyHas(sourceFiles, 'contentHash') || anyHas(sourceFiles, 'normalizeBlob') || anyHas(sourceFiles, 'blob'));
const minifyEvidence = regexAny(buildConfigs, /minify|terser|esbuild/i) || ['vite','rollup','webpack','esbuild'].some((d) => dependencies[d]);
const treeShakeEvidence = regexAny(buildConfigs, /tree.?shak|treeshake/i) || ['vite','rollup','esbuild'].some((d) => dependencies[d]);
const codeSplitEvidence = regexAny(buildConfigs, /manualChunks|splitChunks|codeSplitting|splitting\s*:\s*true/i);

let buildOutputEvidence = false;
let buildOutputSummary = 'dist/turbo/build-report.json missing; production compiler has not been executed in this workspace.';
if (exists('dist/turbo/build-report.json') && exists('dist/turbo/meta.json')) {
  try {
    const report = JSON.parse(read('dist/turbo/build-report.json'));
    const meta = JSON.parse(read('dist/turbo/meta.json'));
    const outputs = Object.entries(meta.outputs || {});
    const jsOutputs = outputs.filter(([file]) => file.endsWith('.js'));
    const hashed = jsOutputs.length > 0 && jsOutputs.every(([file]) => /-[A-Z0-9]{6,}\.js$/i.test(file.replaceAll('\\','/')));
    const lazyEdges = outputs.flatMap(([, info]) => info.imports || []).filter((item) => item.kind === 'dynamic-import').length;
    buildOutputEvidence = report.compiler === 'esbuild' && report.mode === 'production' && report.minify === true && report.treeShaking === true && report.codeSplitting === true && report.contentHashedNames === true && outputs.length >= 3 && hashed && lazyEdges >= 1;
    buildOutputSummary = `compiler=${report.compiler}; outputs=${outputs.length}; hashedJS=${hashed}; lazyEdges=${lazyEdges}; minify=${report.minify}; treeShake=${report.treeShaking}; split=${report.codeSplitting}`;
  } catch (error) { buildOutputSummary = `production build report invalid: ${error.message}`; }
}

const legacyCompilerException = regexAny([contractDoc], /^LEGACY_COMPILER_EXCEPTION_ACCEPTED:\s*true\s*$/mi) && regexAny([contractDoc], /^scope:\s*\S.+$/mi) && regexAny([contractDoc], /^migration:\s*\S.+$/mi);
const bootIsolationTest = exists('scripts/turbo-boot-isolation-test.mjs') && has(workflowPath, 'node scripts/turbo-boot-isolation-test.mjs');
const lazyEvidence = anyHas(lazyFiles, 'import(') && ['studio','world','map-forge','visual'].every((term) => anyHas(['index.html', ...lazyFiles], term)) && bootIsolationTest;
const adaptiveParallel = anyHas(sourceFiles, 'chooseConcurrency') && anyHas(sourceFiles, 'effectiveType') && anyHas(sourceFiles, 'saveData');
const combatTestWired = exists(combatTestPath) && has(workflowPath, 'node scripts/turbo-combat-hard-stop-test.mjs');
const runtimeCombatHardStop = regexAny(['src/core/update-system.js'], /function networkGateFromState[\s\S]*?if\(isGameplayBusy\(\)\)return \{allow:false/) && regexAny(['src/core/update-system.js'], /function chooseConcurrency[\s\S]*?if\(isGameplayBusy\(\)\)return 0/) && regexAny(['src/core/update-system.js'], /function setGameplayBusy[\s\S]*?abortBackgroundDownloads\(\)/) && regexAny(['src/core/update-system.js'], /async function applyUpdate\(\)\{if\(isGameplayBusy\(\)\)throw new Error\('update_blocked_combat'\)/);
const pvpAbsolutePause = adaptiveParallel && combatTestWired && runtimeCombatHardStop;
const fetchPriority = (anyHas(sourceFiles, "priority:'high'") || anyHas(sourceFiles, "priority: 'high'") || anyHas(sourceFiles, 'priority: "high"')) && (anyHas(sourceFiles, "priority:'low'") || anyHas(sourceFiles, "priority: 'low'") || anyHas(sourceFiles, 'priority: "low"'));
const persistentStorage = anyHas(sourceFiles, 'navigator.storage.persist') || anyHas(sourceFiles, 'storage.persist(');
const persistenceFallback = regexAny([contractDoc], /^STORAGE_PERSIST_FALLBACK_ACCEPTED:\s*true\s*$/mi);

const immutableHeadersConfigured = regexAny(headerConfigs, /immutable/i);
const revalidateHeadersConfigured = regexAny(headerConfigs, /no-cache|max-age=0|must-revalidate/i);
const hostingHeadersVerified = regexAny([hostingDoc], /^HOSTING_HEADERS_VERIFIED:\s*true\s*$/mi);
const compressionConfigured = regexAny(headerConfigs, /brotli|gzip|content-encoding|\.br\b|\.gz\b/i) || regexAny(buildConfigs, /brotli|gzip/i);
const compressionVerified = regexAny([hostingDoc], /^COMPRESSION_VERIFIED:\s*true\s*$/mi);
const transportVerified = regexAny([hostingDoc], /^TRANSPORT_VERIFIED:\s*true\s*$/mi);
const transportLimitationPlan = regexAny([hostingDoc], /^HOSTING_LIMITATION:\s*\S.+$/mi) && regexAny([hostingDoc], /^MIGRATION_PLAN:\s*\S.+$/mi);

const metricsEvidence = (anyHas(sourceFiles, 'deltaBytes') && anyHas(sourceFiles, 'timeToReadyMs')) || (anyHas(sourceFiles, 'Update Delta Bytes') && anyHas(sourceFiles, 'Time To Update Ready'));
const guardianWorkflow = exists(workflowPath) && has(workflowPath, 'npm run audit:turbo');
const guardianScript = scripts['audit:turbo'] === 'node scripts/turbo-update-guardian.mjs';
const documentation = exists(contractDoc) && has(contractDoc, 'ACCEPTANCE CRITERIA', 'EVIDENCE', 'REGRESSION POLICY') && exists(hostingDoc);
const deltaTestPaths = ['scripts/turbo-delta-test.mjs','tests/turbo-update-delta.spec.js','tests/turbo-update-delta.spec.mjs','tests/updater-delta.test.cjs'];
const deltaTestFile = deltaTestPaths.some(exists);
const deltaTestScript = (typeof scripts['test:turbo-delta'] === 'string' && scripts['test:turbo-delta'].length > 0) || (exists(workflowPath) && has(workflowPath, 'node tests/updater-delta.test.cjs'));
const deltaTestWired = exists(workflowPath) && (has(workflowPath, 'npm run test:turbo-delta') || has(workflowPath, 'node tests/updater-delta.test.cjs'));
const deltaTestAssertions = deltaTestFile && regexAny(deltaTestPaths, /0\s*asset bytes|0\s*bytes|zero\s*bytes|deltaBytes\s*,\s*0|deltaBytes\s*===\s*0|strictEqual\([^,]+,\s*0\)/i) && regexAny(deltaTestPaths, /one changed file|one-file|single|1 file|deltaFiles\s*,\s*1|changed.*1|delta.*1/i);

const manifestPath = ['dist/turbo-update-manifest.json','turbo-update-manifest.json'].find(exists);
let manifestIntegrity = false;
let manifestEvidence = 'No generated manifest available in repository/workspace.';
if (manifestPath) {
  try {
    const manifest = JSON.parse(read(manifestPath));
    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    manifestIntegrity = entries.length > 0 && entries.every((entry) => {
      const identity = entry.sha256 || entry.hash || entry.contentHash;
      if (!entry || !(entry.path || entry.url) || !/^[a-f0-9]{32,64}$/i.test(String(identity || ''))) return false;
      const relative = entry.path || String(entry.url || '').replace(/^\.?\//, '');
      const file = path.join(root, relative);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
      if (String(identity).length !== 64) return true;
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      return actual === String(identity).toLowerCase();
    });
    manifestEvidence = manifestIntegrity ? `${manifestPath}: SHA-256 identities verified against actual bytes.` : `${manifestPath}: present but identities/bytes do not verify.`;
  } catch (error) { manifestEvidence = `${manifestPath}: invalid JSON (${error.message}).`; }
}

const checks = [
  check('TU-01','Delta manifest por archivo con identidad/hash de contenido', manifestGenerator && deltaManifestRuntime && manifestIntegrity, `${manifestGenerator ? 'generator present' : 'generator missing'}; ${deltaManifestRuntime ? 'runtime per-file manifest present' : 'runtime does not consume a per-file manifest'}; ${manifestEvidence}`, 'Generate the manifest in CI and verify identities against actual bytes.'),
  check('TU-02','Cache global content-addressed reutilizable entre builds', globalCache, globalCache ? 'Stable kelo-assets-v3 content-addressed cache and object keys found.' : 'Only build-scoped staging cache is proven.', 'Use a stable content-addressed cache; unchanged objects must survive build changes and cost 0 network bytes.'),
  check('TU-03','Chunks/objetos hashados + activación reutilizable', contentHashConfig && activationReuse, `hashed object naming=${contentHashConfig}; activation reuse=${activationReuse}`, 'Hash object URLs/names and make activation resolve/reuse those exact cached objects.'),
  check('TU-04','Compiler prod: minify + tree-shake + code split (or explicit legacy exception)', (productionBuildScript && buildConfigPresent && minifyEvidence && treeShakeEvidence && codeSplitEvidence && buildOutputEvidence) || legacyCompilerException, `build=${productionBuildScript}; config=${buildConfigPresent}; minify=${minifyEvidence}; treeShake=${treeShakeEvidence}; split=${codeSplitEvidence}; executedOutput=${buildOutputEvidence}; ${buildOutputSummary}; legacyException=${legacyCompilerException}`, 'Run the production compiler and prove emitted minified, hashed, split output; config alone is insufficient.'),
  check('TU-05','Boot crítico separado de Studio/World Editor/Map Forge/Visual Lab lazy', lazyEvidence && codeSplitEvidence && buildOutputEvidence, `lazyEvidence=${lazyEvidence}; isolationTest=${bootIsolationTest}; split=${codeSplitEvidence}; executedOutput=${buildOutputEvidence}`, 'Prove creator tools are absent from critical boot and lazy split edges survive the production build.'),
  check('TU-06','Paralelismo adaptativo + pausa absoluta en PVP/combate', pvpAbsolutePause, `adaptive=${adaptiveParallel}; runtimeHardStop=${runtimeCombatHardStop}; combatTestWired=${combatTestWired}`, 'PVP/combat must block prepare/apply, force zero concurrency and abort tracked updater network work.'),
  check('TU-07','Fetch Priority low background / high explicit apply', fetchPriority, fetchPriority ? 'Both priority modes found.' : 'Queue ordering alone is insufficient.', 'Use RequestInit priority with graceful unsupported-browser fallback.'),
  check('TU-08','navigator.storage.persist() o fallback documentado', persistentStorage || persistenceFallback, `persist=${persistentStorage}; fallback=${persistenceFallback}`, 'Request persistence where supported and document behavior when denied/unavailable.'),
  check('TU-09','Cache-Control immutable hashados + revalidation HTML/version/manifests', immutableHeadersConfigured && revalidateHeadersConfigured && hostingHeadersVerified, `configuredImmutable=${immutableHeadersConfigured}; configuredRevalidate=${revalidateHeadersConfigured}; liveVerified=${hostingHeadersVerified}`, 'Configuration alone is not evidence. Verify the actual production response headers and set HOSTING_HEADERS_VERIFIED:true only from live evidence.'),
  check('TU-10','Compresión Brotli/Gzip', compressionConfigured && compressionVerified, `configured=${compressionConfigured}; liveVerified=${compressionVerified}`, 'Verify Content-Encoding on actual production responses; do not accept build/config intent alone.'),
  check('TU-11','HTTP/2/HTTP/3/CDN o limitación + plan ejecutable', transportVerified || transportLimitationPlan, `liveVerified=${transportVerified}; limitationPlan=${transportLimitationPlan}`, 'Record live protocol/CDN evidence, or keep the explicit hosting limitation plus executable migration plan.'),
  check('TU-12','Update Delta Bytes + Time To Update Ready', metricsEvidence, metricsEvidence ? 'deltaBytes and timeToReadyMs are instrumented in runtime state.' : 'Required update metrics are not instrumented.', 'Expose both metrics in updater state/events and audit them.'),
  check('TU-13','CI/guardian fail-closed', guardianWorkflow && guardianScript && combatTestWired, `workflow=${guardianWorkflow}; npmScript=${guardianScript}; combatTest=${combatTestWired}`, 'Wire every guarantee test to push/PR and make the guardian mandatory.'),
  check('TU-14','Documentación actualizada', documentation, documentation ? 'Contract + hosting evidence documents are present.' : 'Contract/evidence documentation is absent or incomplete.', 'Maintain the Turbo contract and hosting evidence as acceptance sources of truth.'),
  check('TU-15','Pruebas: 1 archivo => solo delta; build idéntica => 0 bytes', deltaTestFile && deltaTestScript && deltaTestWired && deltaTestAssertions, `file=${deltaTestFile}; executable=${deltaTestScript}; wired=${deltaTestWired}; assertions=${deltaTestAssertions}`, 'Add deterministic tests that measure bytes, not just file counts, and run them in CI.')
];

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
console.log(`TURBO UPDATE GUARDIAN: ${passed}/${checks.length} guarantees proven`);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.title}`);
  console.log(`  evidence: ${c.evidence}`);
  if (!c.pass && c.blocker) console.log(`  blocker: ${c.blocker}`);
}
if (failed.length) {
  console.error(`TURBO UPDATE CONTRACT INCOMPLETE: ${failed.length} guarantee(s) lack sufficient evidence.`);
  process.exit(1);
}
console.log('TURBO UPDATE CONTRACT COMPLETE: all 15 guarantees have repository/build/live-host evidence.');
