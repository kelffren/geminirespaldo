import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioSelectAllController } from '../src/studio/input/studio-select-all-controller.mjs';

const source=fs.readFileSync(new URL('../src/studio/input/studio-select-all-controller.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/kernel\.execute\(/,'selection shortcuts must not bypass CommandBus');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection shortcuts must remain authority isolated');

function harness({entities=[{id:'a'},{id:'b'}],shell=true,selected=[]}={}){
  const listeners=new Map();
  const selection=[...selected];
  const document={
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
    getElementById(id){return shell&&id==='kelo-studio-live'?{}:null;}
  };
  const kernel={document:{entities},selection:{set(ids){selection.splice(0,selection.length,...ids);}}};
  const root={document};
  const controller=createStudioSelectAllController({root,kernel});
  const dispatch=(overrides={})=>{
    let prevented=false;
    const event={key:'a',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,target:{closest:()=>null},preventDefault(){prevented=true;},...overrides};
    listeners.get('keydown')?.(event);
    return {prevented,selection:[...selection]};
  };
  return {controller,dispatch,listeners,selection};
}

{
  const h=harness({entities:[{id:'a'},{id:'b'},{id:'a'},{id:null},{id:''}]});
  const result=h.dispatch();
  assert.deepEqual(result.selection,['a','b'],'Ctrl+A selects unique valid entity ids in document order');
  assert.equal(result.prevented,true,'handled select-all prevents browser select-all');
}
{
  const h=harness();
  assert.deepEqual(h.dispatch({ctrlKey:false,metaKey:true}).selection,['a','b'],'Cmd+A selects all on macOS');
}
{
  const h=harness({selected:['a','b']});
  const result=h.dispatch({shiftKey:true});
  assert.deepEqual(result.selection,[],'Ctrl+Shift+A clears the current Studio selection');
  assert.equal(result.prevented,true,'handled clear-selection prevents browser behavior');
}
{
  const h=harness({selected:['a','b']});
  assert.deepEqual(h.dispatch({ctrlKey:false,metaKey:true,shiftKey:true}).selection,[],'Cmd+Shift+A clears selection on macOS');
}
{
  const h=harness({selected:['a']});
  assert.deepEqual(h.dispatch({target:{closest:()=>({tagName:'INPUT'})}}).selection,['a'],'editable targets keep native select-all');
  assert.deepEqual(h.dispatch({repeat:true}).selection,['a'],'autorepeat is ignored');
  assert.deepEqual(h.dispatch({altKey:true}).selection,['a'],'Alt-modified shortcut is ignored');
  assert.deepEqual(h.dispatch({metaKey:true}).selection,['a'],'simultaneous Ctrl+Cmd is ignored');
}
{
  const h=harness({entities:[]});
  const result=h.dispatch();
  assert.deepEqual(result.selection,[],'select-all leaves empty worlds unchanged');
  assert.equal(result.prevented,false,'empty worlds keep browser behavior for select-all');
  const clear=h.dispatch({shiftKey:true});
  assert.deepEqual(clear.selection,[],'clear-selection is safe in empty worlds');
  assert.equal(clear.prevented,true,'clear-selection remains deterministic in empty worlds');
}
{
  const h=harness({shell:false,selected:['a']});
  assert.deepEqual(h.dispatch().selection,['a'],'shortcuts stay scoped to mounted Studio shell');
  assert.deepEqual(h.dispatch({shiftKey:true}).selection,['a'],'clear-selection stays scoped to mounted Studio shell');
}
{
  const h=harness({selected:['a']});
  h.controller.destroy();
  assert.equal(h.listeners.has('keydown'),false,'destroy removes keyboard listener');
  assert.deepEqual(h.dispatch({shiftKey:true}).selection,['a'],'destroyed controller is inert');
}

console.log(JSON.stringify({ok:true,shortcuts:['Ctrl/Cmd+A','Ctrl/Cmd+Shift+A'],selectionOnly:true,authorityIsolated:true},null,2));
