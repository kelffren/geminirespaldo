import assert from 'node:assert/strict';
import {
  pruneWorldStudioStyles,
  releaseWorldStudioViewport,
  sanitizeWorldStudioProvisionalShell,
} from '../src/studio/integration/world-studio-bridge.mjs';

function makeShell({ loading = true } = {}) {
  const controls=[
    {disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;}},
    {disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;}},
  ];
  const status={textContent:'Cargando editor…'};
  const shell = {
    dataset: { shellVersion: 'studio-live-shell-v1.7.0', ...(loading ? { keloWorldLoading: '1' } : {}) },
    stylePresent: true,
    replacedWith: null,
    cloneCount: 0,
    attrs:{},
    controls,
    status,
    setAttribute(k,v){this.attrs[k]=v;},
    querySelector(selector) {
      if(selector === '.ks-top')return {};
      if(selector === '.ks-status')return status;
      return null;
    },
    querySelectorAll(selector){return selector==='button,select,input'?controls:[];},
    removeAttribute(name) { if (name === 'style') this.stylePresent = false; },
    cloneNode(deep) {
      assert.equal(deep, true);
      this.cloneCount++;
      return makeShell({ loading });
    },
    replaceWith(next) { this.replacedWith = next; },
  };
  return shell;
}

function makeStyle() {
  return {
    removed: false,
    remove() { this.removed = true; },
  };
}

{
  const provisional = makeShell({ loading: true });
  let current = provisional;
  provisional.replaceWith = next => { provisional.replacedWith = next; current = next; };
  const root = { document: { getElementById: id => id === 'kelo-studio-live' ? current : null } };

  const clean = sanitizeWorldStudioProvisionalShell(root);
  assert.equal(provisional.cloneCount, 1, 'loading shell must be cloned exactly once before controller hydrate');
  assert.notEqual(clean, provisional, 'controller must receive a listener-free provisional node');
  assert.equal(current, clean, 'clean shell must be installed before hydrate starts');

  assert.equal(releaseWorldStudioViewport(root), false, 'visual provisional chrome must not be reported as interactive');
  assert.equal(clean.cloneCount, 0, 'viewport polling must never replace a shell after hydrate can start');
  assert.equal(current, clean, 'viewport release must preserve the controller-owned DOM node');
  assert.equal(clean.stylePresent, false, 'provisional chrome may reveal the game viewport');
  assert.equal(clean.dataset.keloStudioInteractive,'0','provisional shell must explicitly report non-interactive state');
  assert.equal(clean.attrs['aria-busy'],'true','provisional shell must expose busy state');
  assert.equal(clean.status.textContent,'Terminando de cargar editor…');
  assert.ok(clean.controls.every(control=>control.disabled),'all provisional controls must be disabled instead of silently no-op');
}

{
  const finalShell = makeShell({ loading: false });
  const root = { document: { getElementById: id => id === 'kelo-studio-live' ? finalShell : null } };
  assert.equal(sanitizeWorldStudioProvisionalShell(root), finalShell);
  assert.equal(finalShell.cloneCount, 0, 'interactive shell must keep its real event listeners');
  assert.equal(releaseWorldStudioViewport(root), true);
  assert.equal(finalShell.cloneCount, 0, 'interactive shell must never be replaced during viewport release');
  assert.equal(finalShell.stylePresent, false, 'interactive shell must not retain the opaque launch style');
  assert.equal(finalShell.dataset.keloStudioInteractive,'1','live shell must report interactive state');
  assert.equal(finalShell.attrs['aria-busy'],'false','live shell must clear busy state');
  assert.ok(finalShell.controls.every(control=>!control.disabled),'live controls must remain enabled');
}

{
  const provisionalStyle = makeStyle();
  const staleStyle = makeStyle();
  const liveStyle = makeStyle();
  const styles = [provisionalStyle, staleStyle, liveStyle];
  const root = { document: { querySelectorAll: selector => selector === 'style[data-kelo-studio-ui="1"]' ? styles : [] } };
  assert.equal(pruneWorldStudioStyles(root), 1, 'hydrate must leave one Studio stylesheet');
  assert.equal(provisionalStyle.removed, true, 'provisional stylesheet must be removed after live hydrate');
  assert.equal(staleStyle.removed, true, 'stale stylesheet from a previous open must be removed');
  assert.equal(liveStyle.removed, false, 'newest live stylesheet must remain active');
}

console.log('world-studio provisional shell audit: ok');
