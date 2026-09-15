import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setStudioMenuMinimized } from '../src/studio/ui/studio-menu-minimizer.mjs';

const classes=new Set();
const bottom={
  dataset:{},
  classList:{
    toggle(name,on){if(on)classes.add(name);else classes.delete(name);return !!on;},
    contains(name){return classes.has(name);}
  }
};
const attrs={};
const button={
  textContent:'',title:'',
  setAttribute(name,value){attrs[name]=String(value);}
};

assert.equal(setStudioMenuMinimized(bottom,button,true),true);
assert.equal(bottom.classList.contains('ks-menu-minimized'),true);
assert.equal(bottom.dataset.menuMinimized,'1');
assert.equal(button.textContent,'▴');
assert.equal(button.title,'Expandir menú');
assert.equal(attrs['aria-expanded'],'false');

assert.equal(setStudioMenuMinimized(bottom,button,false),false);
assert.equal(bottom.classList.contains('ks-menu-minimized'),false);
assert.equal(bottom.dataset.menuMinimized,'0');
assert.equal(button.textContent,'—');
assert.equal(button.title,'Minimizar menú');
assert.equal(attrs['aria-expanded'],'true');

const entry=await readFile(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioMenuMinimizer/,'Studio entry must wire the menu minimizer');
assert.match(entry,/menuMinimizer\.destroy\(\)/,'Studio close must clean up the menu minimizer');

const ui=await readFile(new URL('../src/studio/ui/studio-menu-minimizer.mjs',import.meta.url),'utf8');
assert.match(ui,/ks-menu-minimized \.ks-deck-body/);
assert.match(ui,/ks-menu-minimized \.ks-status/);
assert.match(ui,/@media\(max-width:760px\)/,'mobile menu collapse styling must exist');

console.log(JSON.stringify({ok:true,collapse:true,expand:true,aria:true,mobile:true,sessionCleanup:true},null,2));
