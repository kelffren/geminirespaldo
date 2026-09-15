/* KELO-INDEX
 * area: CREATORS / WORLD COMPATIBILITY ADAPTER
 * owner: mapping existing World Draft/Revision semantics into CreatorProject boundary
 * owns: mapping + lazy readiness bridge to existing KELO_WORLD_EDIT authority
 * does-not-own: World drafts, revisions, placements, terrain, collisions or publishing
 * consumes: KELO_WORLD_EDIT; no second World authority
 */
import { normalizeCreatorProject } from '../core/creator-project.mjs';
const WORLD_PROJECT_ID='world:kelo-main';
const mapStatus=status=>({DRAFT:'TEAM_DRAFT',SUBMITTED:'IN_REVIEW',APPROVED:'APPROVED',REJECTED:'CHANGES_REQUESTED',PUBLISHED:'PUBLISHED',DISCARDED:'ARCHIVED'}[String(status||'').toUpperCase()]||'TEAM_DRAFT');
const revisionIdOf=d=>d?.publishedRevisionId||d?.revisionId||d?.baseRevisionId||null;

const DEFAULT_WORLD_EDIT_LOADERS=Object.freeze([
  ()=>import('../../world/world-draft-store.js'),
  ()=>import('../../world/world-revision-system.js'),
  ()=>import('../../world/authorities/local-world-edit-authority.js'),
  ()=>import('../../world/world-edit-authority.js')
]);
let worldEditBootstrapPromise=null;

export async function ensureWorldEditAuthorityLoaded(root=globalThis,{loaders=DEFAULT_WORLD_EDIT_LOADERS}={}){
  if(root.KELO_WORLD_EDIT)return root.KELO_WORLD_EDIT;
  if(!root.document)throw new Error('WORLD_EDIT_LAZY_BOOTSTRAP_DOM_REQUIRED');
  if(!worldEditBootstrapPromise){
    worldEditBootstrapPromise=(async()=>{
      for(const load of loaders){
        if(typeof load!=='function')throw new Error('WORLD_EDIT_LAZY_BOOTSTRAP_LOADER_INVALID');
        await load(root);
      }
      if(!root.KELO_WORLD_EDIT)throw new Error('WORLD_EDIT_LAZY_BOOTSTRAP_MISSING_OWNER');
      return root.KELO_WORLD_EDIT;
    })().catch(error=>{worldEditBootstrapPromise=null;throw error;});
  }
  return worldEditBootstrapPromise;
}

export async function waitForWorldEditAuthority(root=globalThis,{timeoutMs=10000,bootstrap=ensureWorldEditAuthorityLoaded}={}){
  const now=()=>root.performance?.now?.()??Date.now(),started=now();
  let E=root.KELO_WORLD_EDIT;
  if(!E&&typeof bootstrap==='function'){
    try{E=await bootstrap(root);}catch(error){
      if(root.KELO_WORLD_EDIT)E=root.KELO_WORLD_EDIT;
      else throw error;
    }
  }
  if(!E){
    E=await new Promise((resolve,reject)=>{
      const check=()=>{
        if(root.KELO_WORLD_EDIT)return resolve(root.KELO_WORLD_EDIT);
        if(now()-started>=timeoutMs)return reject(new Error('WORLD_EDIT_OWNER_TIMEOUT'));
        root.setTimeout?.(check,40)??setTimeout(check,40);
      };
      check();
    });
  }
  if(E.ready)return E;
  if(typeof E.whenReady!=='function')throw new Error('WORLD_EDIT_READY_CONTRACT_MISSING');
  const remaining=Math.max(250,timeoutMs-(now()-started));
  await E.whenReady({timeoutMs:remaining});
  if(!E.ready)throw new Error('WORLD_EDIT_NOT_READY');
  return E;
}

export function createWorldCreatorAdapter({root=globalThis,permission=null}={}){
  const actor=()=>String(permission?.actorId?.()||root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
  const allowed=()=>permission?.can?permission.can('world.edit',actor(),WORLD_PROJECT_ID):!!root.KELO_ADMIN_KEYS?.can?.('world.edit',actor());
  async function current(){if(!root.KELO_WORLD_EDIT?.ready)return null;try{return (await root.KELO_WORLD_EDIT.getCurrentDraft?.())?.draft||null;}catch{return null;}}
  async function project(){const d=await current();return normalizeCreatorProject({projectId:WORLD_PROJECT_ID,type:'WORLD',name:'Kelo World',description:'Main Kelo World creator project',ownerId:actor(),status:mapStatus(d?.status),visibility:d?.status==='PUBLISHED'?'PUBLIC':'TEAM',draftRevisionId:d?.draftId||null,approvedRevisionId:d?.status==='APPROVED'?revisionIdOf(d):null,publishedRevisionId:d?.status==='PUBLISHED'?revisionIdOf(d):null,workspaceSettings:{domain:'world',authority:'KELO_WORLD_EDIT'}});}
  return Object.freeze({
    id:'world-existing-authority',handlesType:type=>String(type).toUpperCase()==='WORLD',
    async list(){return allowed()?[await project()]:[];},
    async get(projectId){return allowed()&&String(projectId)===WORLD_PROJECT_ID?project():null;},
    async create(){if(!allowed())throw new Error('CREATOR_PERMISSION_DENIED:world.edit');return project();},
    async saveDraft(projectId,_document,{draftId=null}={}){if(String(projectId)!==WORLD_PROJECT_ID)throw new Error('CREATOR_WORLD_PROJECT_INVALID');permission?.require?.('world.edit',actor(),WORLD_PROJECT_ID);const E=await waitForWorldEditAuthority(root);return E.request('world:draft:save',{actorId:actor(),draftId:draftId||undefined});},
    async loadDraft(projectId,{draftId=null}={}){if(String(projectId)!==WORLD_PROJECT_ID)throw new Error('CREATOR_WORLD_PROJECT_INVALID');const E=await waitForWorldEditAuthority(root);let id=draftId;if(!id){const d=await current();id=d?.draftId||null;}if(!id)return null;return E.request('world:draft:get',{actorId:actor(),draftId:id});},
    async archive(){throw new Error('CREATOR_WORLD_ARCHIVE_UNSUPPORTED');}
  });
}
export { WORLD_PROJECT_ID };
