/* KELO-INDEX
 * area: WORLD / MAP FORGE / WORKER CLIENT
 * owner: KeloMapForge worker client
 * purpose: async best-of-N generation with Worker first and deterministic sync fallback
 * public-api: createMapForgeWorkerClient()
 * consumes: map-forge-worker.mjs + pure core fallback
 * state-owned: pending request promises only
 * do-not: no world mutation, renderer, collision or gameplay ownership
 */
import { MAP_FORGE_RECIPES } from './map-forge-recipes.mjs';
import { generateBestOf } from './map-forge-core.mjs';
export function createMapForgeWorkerClient({root=globalThis,timeoutMs=15000}={}){let worker=null,seq=0,closed=false;const pending=new Map();try{if(typeof root.Worker==='function')worker=new root.Worker(new URL('./map-forge-worker.mjs',import.meta.url),{type:'module',name:'kelo-map-forge'});}catch{worker=null;}if(worker){worker.onmessage=event=>{const m=event?.data||{},row=pending.get(String(m.id||''));if(!row)return;pending.delete(String(m.id));clearTimeout(row.timer);m.ok?row.resolve(m.result):row.reject(new Error(m.error||'MAP_FORGE_WORKER_FAILED'));};worker.onerror=event=>{const e=new Error(event?.message||'MAP_FORGE_WORKER_CRASHED');for(const row of pending.values()){clearTimeout(row.timer);row.reject(e);}pending.clear();try{worker.terminate();}catch{}worker=null;};}async function generate(recipeId,options={}){if(closed)throw new Error('MAP_FORGE_WORKER_CLIENT_CLOSED');const recipe=MAP_FORGE_RECIPES[String(recipeId||'')];if(!recipe)throw new Error(`MAP_FORGE_RECIPE_NOT_FOUND:${recipeId||''}`);if(!worker)return generateBestOf(recipe,options);const id=`mf:${++seq}`;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MAP_FORGE_WORKER_TIMEOUT'));},timeoutMs);pending.set(id,{resolve,reject,timer});worker.postMessage({id,type:'generate',recipeId:recipe.id,options});});}function close(){if(closed)return;closed=true;for(const row of pending.values()){clearTimeout(row.timer);row.reject(new Error('MAP_FORGE_WORKER_CLIENT_CLOSED'));}pending.clear();try{worker?.terminate();}catch{}worker=null;}return Object.freeze({version:'map-forge-worker-client-v1.0.1',generate,close,get mode(){return worker?'worker':'sync-fallback';}});}
