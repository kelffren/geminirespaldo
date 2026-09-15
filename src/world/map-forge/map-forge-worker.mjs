/* KELO-INDEX
 * area: WORLD / MAP FORGE / WORKER
 * owner: KeloMapForge worker execution boundary
 * purpose: run heavy best-of-N map generation off the UI thread
 * public-api: module worker message protocol {id,type:'generate',recipeId,options}
 * consumes: Map Forge recipes + pure core
 * state-owned: no persistent state; one request -> one response
 * do-not: no DOM, renderer, collision, gameplay or Math.random
 */
import { MAP_FORGE_RECIPES } from './map-forge-recipes.mjs';
import { generateBestOf } from './map-forge-core.mjs';
self.onmessage=event=>{const message=event?.data||{},id=String(message.id||'');if(!id)return;try{if(message.type!=='generate')throw new Error(`MAP_FORGE_WORKER_MESSAGE_UNSUPPORTED:${message.type||'unknown'}`);const recipe=MAP_FORGE_RECIPES[String(message.recipeId||'')];if(!recipe)throw new Error(`MAP_FORGE_RECIPE_NOT_FOUND:${message.recipeId||''}`);self.postMessage({id,ok:true,result:generateBestOf(recipe,message.options||{})});}catch(error){self.postMessage({id,ok:false,error:String(error?.message||error||'MAP_FORGE_WORKER_FAILED')});}};
