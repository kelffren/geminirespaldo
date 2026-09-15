/* KELO-INDEX
 * area: CREATORS / LOCAL PROJECT REPOSITORY
 * owner: generic local CreatorProject persistence composition
 * owns: in-session generic projects/drafts plus delegation to domain adapters
 * does-not-own: browser storage primitives, World draft state or online transport
 * online: swap for RemoteCreatorProjectRepository; workspaces stay unchanged
 */
import { createCreatorProject, transitionCreatorProject } from '../core/creator-project.mjs';
import { assertCreatorProjectRepository } from './creator-project-repository.mjs';
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
export function createLocalCreatorProjectRepository({domainAdapters=[],stateAdapter=null}={}){
  const projects=new Map(),drafts=new Map();let hydrated=false,persistenceHealthy=true;
  const adapterForType=type=>domainAdapters.find(a=>a?.handlesType?.(String(type).toUpperCase()))||null;
  const adapterForProject=project=>project?adapterForType(project.type):null;
  const warn=(message,error)=>{try{console.warn(`[Kelo Creators] ${message}`,error);}catch{}};
  async function hydrate(){
    if(hydrated)return;hydrated=true;let state=null;
    try{state=await stateAdapter?.load?.();}catch(error){persistenceHealthy=false;warn('local project state unavailable; continuing in memory',error);return;}
    for(const raw of state?.projects||[]){try{const p=createCreatorProject(raw);projects.set(String(p.projectId),p);}catch(error){warn('ignored invalid persisted Creator project',error);}}
    for(const [k,v] of Object.entries(state?.drafts||{}))drafts.set(k,copy(v));
  }
  async function persist(){
    if(!stateAdapter?.save||!persistenceHealthy)return;
    try{await stateAdapter.save({projects:[...projects.values()].map(copy),drafts:Object.fromEntries([...drafts.entries()].map(([k,v])=>[k,copy(v)]))});}
    catch(error){persistenceHealthy=false;warn('local project persistence unavailable; keeping this session in memory',error);}
  }
  function persistAfterMutation(){void persist().catch(error=>{persistenceHealthy=false;warn('background project persistence unavailable; keeping this session in memory',error);});}
  async function list(filter={}){await hydrate();let rows=[...projects.values()].map(copy);for(const a of domainAdapters)if(typeof a.list==='function')rows.push(...((await a.list(filter))||[]));const seen=new Set();rows=rows.filter(p=>p?.projectId&&!seen.has(p.projectId)&&seen.add(p.projectId));if(filter.ownerId)rows=rows.filter(p=>p.ownerId===String(filter.ownerId));if(filter.type)rows=rows.filter(p=>p.type===String(filter.type).toUpperCase());return rows;}
  async function get(projectId){await hydrate();projectId=String(projectId);if(projects.has(projectId))return copy(projects.get(projectId));for(const a of domainAdapters){const p=await a.get?.(projectId);if(p)return p;}return null;}
  async function create(input){await hydrate();const domain=adapterForType(input?.type);if(domain?.create)return domain.create(input);const p=createCreatorProject(input);if(projects.has(p.projectId))throw new Error(`CREATOR_PROJECT_EXISTS:${p.projectId}`);projects.set(p.projectId,p);persistAfterMutation();return copy(p);}
  async function saveDraft(projectId,document,options={}){const p=await get(projectId);if(!p)throw new Error(`CREATOR_PROJECT_NOT_FOUND:${projectId}`);const domain=adapterForProject(p);if(domain?.saveDraft)return domain.saveDraft(projectId,document,options);drafts.set(String(projectId),copy(document));await persist();return copy(document);}
  async function loadDraft(projectId,options={}){const p=await get(projectId);if(!p)throw new Error(`CREATOR_PROJECT_NOT_FOUND:${projectId}`);const domain=adapterForProject(p);if(domain?.loadDraft)return domain.loadDraft(projectId,options);return copy(drafts.get(String(projectId))??null);}
  async function archive(projectId){await hydrate();const p=await get(projectId);if(!p)throw new Error(`CREATOR_PROJECT_NOT_FOUND:${projectId}`);const domain=adapterForProject(p);if(domain?.archive)return domain.archive(projectId);const next=transitionCreatorProject(p,'ARCHIVED');projects.set(String(projectId),next);await persist();return copy(next);}
  return Object.freeze(assertCreatorProjectRepository({list,get,create,saveDraft,loadDraft,archive}));
}
