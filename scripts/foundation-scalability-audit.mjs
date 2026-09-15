import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');
const fail = message => { console.error('SCALABILITY AUDIT FAIL:', message); process.exitCode = 1; };
const expect = (condition,message) => { if(!condition) fail(message); };

const featureRegistry = read('src/core/feature-registry.js');
const moduleLoader = read('src/core/module-loader.js');
const assetRegistry = read('src/core/asset-registry.js');
const input = read('src/core/input-system.js');
const movement = read('src/core/movement-system.js');
const environment = read('src/environment/environment-layer-stack.js');
const paintTool = read('src/studio/tools/paint-copies-tool.mjs');
const paintRenderer = read('src/studio/render/studio-overlay-renderer.mjs');
const viewport = read('src/core/viewport-system.js');
const responsive = read('src/ui/responsive-foundation.css');

expect(featureRegistry.includes('KELO_FEATURE_REGISTRY'),'feature registry owner missing');
expect(moduleLoader.includes('KELO_FEATURE_REGISTRY'),'module loader is not registry-driven');
expect(assetRegistry.includes('KELO_FEATURE_REGISTRY'),'asset registry does not share feature ids');
expect(input.includes('active={before:[],after:[]}'),'input active hook cache missing');
expect(input.includes('read:combatRead'),'zero-copy combat read missing');
expect(movement.includes('active={before:[],intercept:[],after:[]}'),'movement active hook cache missing');
expect(!/function run\(phase,ctx\)\{[^}]*hooks\[phase\]\.slice\(\)/s.test(input),'input copies hook list in hot path');
expect(!/function run\(phase,ctx\)\{[^}]*hooks\[phase\]\.slice\(\)/s.test(movement),'movement copies hook list in hot path');
expect(environment.includes("auditMode:'dirty-only-v2'"),'environment audit still time-driven');
expect(paintTool.includes('getPreviewRefs'),'Paint Copies zero-copy renderer view missing');
expect(paintRenderer.includes('getPreviewRefs'),'Paint Copies renderer still clones previews');
expect(viewport.includes('visualViewport'),'VisualViewport foundation missing');
expect(responsive.includes('--kelo-ui-scale'),'responsive token foundation missing');

if(!process.exitCode) console.log('FOUNDATION SCALABILITY AUDIT PASS');
