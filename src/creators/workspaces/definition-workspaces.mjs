/* KELO-INDEX
 * area: CREATORS / DEFINITION WORKSPACES
 * owner: lightweight definition workspace manifests
 * owns: registry descriptors and lazy routing into shared generic Definition Studio
 * does-not-own: project persistence, runtime execution, gameplay authority or publish policy
 */
import { DEFINITION_WORKSPACE_ROWS, getDefinitionSpec } from '../definition/definition-specs.mjs';

export function createDefinitionWorkspaceManifest({id,type,loader=()=>import('../definition/generic-definition-studio.mjs')}={}){
  const row=DEFINITION_WORKSPACE_ROWS.find(x=>x.id===String(id||'').toLowerCase()&&x.type===String(type||'').toUpperCase());
  if(!row)throw new Error(`CREATOR_DEFINITION_WORKSPACE_INVALID:${id}:${type}`);const spec=getDefinitionSpec(row.type);
  return Object.freeze({id:row.id,label:spec.label,category:spec.category,projectTypes:[row.type],availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openGenericDefinitionCreator!=='function')throw new Error('CREATOR_GENERIC_DEFINITION_ENTRY_MISSING');return mod.openGenericDefinitionCreator({...context,definitionType:row.type});}});
}

export function registerDefinitionWorkspaces(registry,{loader}={}){
  return Object.freeze(DEFINITION_WORKSPACE_ROWS.map(row=>registry.register(createDefinitionWorkspaceManifest({...row,loader}))));
}
