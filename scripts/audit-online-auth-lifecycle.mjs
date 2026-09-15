import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/auth/online-auth-lifecycle-bridge.js',import.meta.url),'utf8');
const values=new Map([
  ['kelo.active.character.v1','old-character'],
  ['kelo.supabase.session.v1','{"access_token":"old-token"}']
]);
const listeners=new Map();
const emitted=[];
let credentialsCalls=0,signOutCalls=0,reloadCalls=0,authListener=null;

class CustomEventMock{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key)
};
const subscription={unsubscribe(){}};
const client={auth:{onAuthStateChange(fn){authListener=fn;return{data:{subscription}};}}};
const KeloOnlineAuth={
  getClient:()=>client,
  credentials:async()=>{credentialsCalls++;values.set('kelo.active.character.v1','fresh-character');values.set('kelo.supabase.session.v1','{"access_token":"fresh-token"}');return{accessToken:'fresh-token',characterId:'fresh-character'};},
  state:()=>({authenticated:true}),
  signOut:async()=>{signOutCalls++;}
};
const window={
  KeloOnlineAuth,
  keloNet:{on:true},
  location:{reload(){reloadCalls++;}},
  dispatchEvent(event){emitted.push(event);return true;},
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type){listeners.delete(type);}
};
const context=vm.createContext({window,localStorage,CustomEvent:CustomEventMock,setTimeout,clearTimeout,Object,String,Error,Promise});
vm.runInContext(source,context,{filename:'online-auth-lifecycle-bridge.js'});

assert.equal(typeof authListener,'function','bridge must subscribe to Supabase auth lifecycle');
authListener('TOKEN_REFRESHED');
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(credentialsCalls,1,'TOKEN_REFRESHED must refresh KeloOnlineAuth credentials');
assert.equal(values.get('kelo.supabase.session.v1'),'{"access_token":"fresh-token"}');
assert.ok(emitted.some(event=>event.type==='kelo:online-auth-token-synced'),'refresh must emit a token-synced event');

authListener('SIGNED_OUT');
assert.equal(values.has('kelo.active.character.v1'),false,'SIGNED_OUT must clear active character immediately');
assert.equal(values.has('kelo.supabase.session.v1'),false,'SIGNED_OUT must clear network session immediately');
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(reloadCalls,1,'SIGNED_OUT must tear down an active authorized page when the network owner has no disconnect API');
assert.equal(signOutCalls,1,'SIGNED_OUT must repair stale KeloOnlineAuth state');
const ended=emitted.find(event=>event.type==='kelo:online-auth-session-ended');
assert.ok(ended,'sign-out must emit a session-ended event');
assert.equal(ended.detail.transportAction,'page-teardown','session-ended event must report transport cutoff path');

console.log('online auth lifecycle audit: PASS');
