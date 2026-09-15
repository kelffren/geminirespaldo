/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: KeloMapForge deterministic primitives
 * purpose: stable serialization, hashing and seeded RNG streams for the procedural core
 * public-api: clamp, round, dist, freezeDeep, stableStringify, hashString, seed32, createRng
 * state-owned: none
 * online: deterministic inputs yield deterministic outputs across client/worker/server JS runtimes
 * do-not: no Math.random, DOM, renderer or mutable globals
 */
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function round(v,p=3){const m=10**p;return Math.round(v*m)/m;}
export function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function freezeDeep(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freezeDeep(v);}return value;}
function sortedObject(value){if(Array.isArray(value))return value.map(sortedObject);if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value).sort())out[k]=sortedObject(value[k]);return out;}return value;}
export function stableStringify(value){return JSON.stringify(sortedObject(value));}
export function hashString(input){let h1=0x811c9dc5,h2=0x9e3779b9;const s=String(input);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,0x01000193);h2=Math.imul(h2^(c+i),0x85ebca6b);h1^=h1>>>13;h2^=h2>>>16;}return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');}
export function seed32(seed){const h=hashString(seed);return (parseInt(h.slice(0,8),16)^parseInt(h.slice(8),16))>>>0;}
export function createRng(seed,stream='default'){
  let a=seed32(`${seed}|${stream}`)||0x6d2b79f5;
  const api={
    next(){a|=0;a=(a+0x6D2B79F5)|0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;},
    float(min=0,max=1){return min+(max-min)*api.next();},
    int(min,max){return Math.floor(api.float(min,max+1));},
    pick(arr){return arr[Math.min(arr.length-1,Math.floor(api.next()*arr.length))];},
    chance(p){return api.next()<p;},
    fork(name){return createRng(seed,`${stream}/${name}`);}
  };
  return api;
}
