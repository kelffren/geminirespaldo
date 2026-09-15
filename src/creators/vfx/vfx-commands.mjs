/* KELO-INDEX
 * area: CREATORS / VFX COMMANDS
 * owner: VFX workspace command definitions
 * owns: reversible VFX document mutations only
 * does-not-own: UI, persistence, runtime, assets, gameplay or networking
 * reuse: existing Studio CommandBus/History
 */
import { normalizeVfxDocument } from './vfx-document.mjs';
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
function replace(target,next){for(const key of Object.keys(target))delete target[key];Object.assign(target,copy(next));}
export function createPatchVfxDefinitionCommand(patch={}){
  let before=null;const safe=copy(patch);
  return {type:'vfx.definition.patch',label:'Patch VFX Definition',async execute({document}){before=copy(document);const draft=copy(document);draft.definition={...draft.definition,...safe};draft.meta={...(draft.meta||{}),updatedAt:Date.now()};replace(document,normalizeVfxDocument(draft));},async undo({document}){if(before)replace(document,before);},serialize(){return{type:'vfx.definition.patch',patch:copy(safe)};},affectedRects(){return[];}};
}
