/* KELO-INDEX
 * area: AUDIT / WORLD IPHONE VIEWPORT
 * purpose: prove the hydrated Studio shell drops the opaque launch placeholder style so #game-canvas remains visible
 */
import assert from 'node:assert/strict';
import {releaseWorldStudioViewport} from '../src/studio/integration/world-studio-bridge.mjs';

{
  let removed=[];
  const shell={
    dataset:{shellVersion:'studio-live-shell-v1.7.0'},
    querySelector:sel=>sel==='.ks-top'?{}:null,
    removeAttribute:name=>removed.push(name)
  };
  const root={document:{getElementById:id=>id==='kelo-studio-live'?shell:null}};
  assert.equal(releaseWorldStudioViewport(root),true,'hydrated Studio shell must release launch backdrop');
  assert.deepEqual(removed,['style'],'hydration must remove the opaque inline launch style');
}

{
  let removed=false;
  const placeholder={dataset:{keloWorldLoading:'1'},querySelector:()=>null,removeAttribute:()=>{removed=true;}};
  const root={document:{getElementById:()=>placeholder}};
  assert.equal(releaseWorldStudioViewport(root),false,'loading placeholder must stay opaque until live shell hydrates');
  assert.equal(removed,false,'loading placeholder style must not be removed early');
}

{
  const root={document:{getElementById:()=>null}};
  assert.equal(releaseWorldStudioViewport(root),false,'missing shell must be a safe no-op');
}

console.log('PASS world iPhone viewport reveal audit: hydrated shell clears launch backdrop, placeholder remains protected');
