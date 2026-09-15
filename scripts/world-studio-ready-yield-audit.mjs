import {yieldStudioBoot} from '../src/studio/integration/studio-boot-pace.mjs';

let rafCalls=0;
const delays=[];
const status={textContent:'SELECT · 0 objects · 0 surface · 0 collision · 100% · 0 undo'};
const shell={querySelector(sel){if(sel==='.ks-top')return {};if(sel==='.ks-status')return status;return null;}};
const root={
  document:{getElementById(id){return id==='kelo-studio-live'?shell:null;}},
  requestAnimationFrame(){rafCalls++;throw new Error('ready shell must not wait for rAF');},
  setTimeout(fn,ms){delays.push(ms);fn();return 1;},
  clearTimeout(){}
};
await yieldStudioBoot(root);
if(rafCalls!==0)throw new Error(`ready shell touched rAF ${rafCalls} time(s)`);
if(delays.length!==1||delays[0]!==0)throw new Error(`ready shell must yield with one zero-delay task, got ${JSON.stringify(delays)}`);

let loadingRafCalls=0;
const loadingStatus={textContent:'Cargando núcleo…'};
const loadingShell={querySelector(sel){if(sel==='.ks-top')return {};if(sel==='.ks-status')return loadingStatus;return null;}};
const loadingRoot={
  document:{getElementById(id){return id==='kelo-studio-live'?loadingShell:null;}},
  requestAnimationFrame(fn){loadingRafCalls++;fn();return 1;},
  setTimeout(){return 1;},
  clearTimeout(){}
};
await yieldStudioBoot(loadingRoot);
if(loadingRafCalls!==1)throw new Error('loading import waves must retain the paint/rAF opportunity');

console.log('world-studio-ready-yield-audit: PASS (interactive shell does not wait on Safari rAF; loading waves still yield to paint)');
