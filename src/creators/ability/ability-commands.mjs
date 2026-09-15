/* KELO-INDEX
 * area: CREATORS / ABILITY COMMANDS
 * owner: Ability workspace command definitions
 * owns: reversible AbilityDocument mutations only
 * does-not-own: UI, persistence, gameplay runtime, permissions or networking
 * reuse: existing Studio CommandBus/History
 */
import { normalizeAbilityDocument } from './ability-document.mjs';
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
function replace(target,next){for(const key of Object.keys(target))delete target[key];Object.assign(target,copy(next));}
function mergeDefinition(base,patch){const out={...base,...patch};for(const key of ['targeting','resource','input','action','telegraph','delivery','visuals'])if(patch[key])out[key]={...(base[key]||{}),...patch[key]};if(patch.recipe)out.recipe=copy(patch.recipe);if(patch.effects)out.effects=copy(patch.effects);return out;}
function reversible(type,label,mutate,serialized){let before=null;return{type,label,async execute({document}){before=copy(document);const draft=copy(document);mutate(draft);draft.meta={...(draft.meta||{}),updatedAt:Date.now()};replace(document,normalizeAbilityDocument(draft));},async undo({document}){if(before)replace(document,before);},serialize(){return copy(serialized);},affectedRects(){return[];}};}
export function createPatchAbilityDefinitionCommand(patch={}){const safe=copy(patch);return reversible('ability.definition.patch','Patch Ability Definition',draft=>{draft.definition=mergeDefinition(draft.definition||{},safe);},{type:'ability.definition.patch',patch:safe});}
export function createPatchAbilityLinksCommand(patch={}){const safe=copy(patch);return reversible('ability.links.patch','Patch Ability Links',draft=>{draft.links={...(draft.links||{}),...safe};},{type:'ability.links.patch',patch:safe});}
export function createUpsertAbilityEffectCommand(effect={}){const safe=copy(effect);return reversible('ability.effect.upsert','Upsert Ability Effect',draft=>{draft.definition=draft.definition||{};const rows=Array.isArray(draft.definition.effects)?draft.definition.effects.slice():[],id=String(safe._id||'');const index=id?rows.findIndex(row=>String(row?._id||'')===id):-1;if(index>=0)rows[index]={...rows[index],...safe};else rows.push(safe);draft.definition.effects=rows;},{type:'ability.effect.upsert',effect:safe});}
export function createRemoveAbilityEffectCommand(effectId){const id=String(effectId||'');return reversible('ability.effect.remove','Remove Ability Effect',draft=>{draft.definition=draft.definition||{};draft.definition.effects=(draft.definition.effects||[]).filter(row=>String(row?._id||'')!==id);},{type:'ability.effect.remove',effectId:id});}
