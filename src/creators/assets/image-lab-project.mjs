/* KELO-INDEX
 * area: CREATORS / IMAGE LAB / PROJECT
 * owner: Kelo Creator Assets authoring capability
 * keys: IMAGE LAB NONDESTRUCTIVE ORIGINAL WORKING COPY REVISION OPERATIONS RESET REBUILD
 * purpose: represent image edits as an immutable source plus replayable operations and revisions
 * public-api: createImageLabProject, appendImageLabOperation, replaceImageLabOperation, removeImageLabOperation, resetImageLabWorkingCopy, createImageLabRevision, resolveImageLabOperations, serializeImageLabProject
 * state-owned: project metadata only; binary source bytes are owned by image-lab-source-store
 * online: local authoring contract is ID-based and can move to asset revisions later
 * do-not: mutate source bytes, render pixels, publish assets or write runtime world state
 */
const F=Object.freeze;
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const now=()=>new Date().toISOString();
const clean=value=>String(value??'').trim();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const id=(prefix='img')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const ALLOWED_OPERATIONS=new Set(['trim-alpha','alpha-snap','resize','rotate','flip']);

function immutableSource(input={}){
  const name=clean(input.name)||'image';
  const mimeType=clean(input.mimeType)||'application/octet-stream';
  return F({
    sourceId:clean(input.sourceId)||id('source'),
    name,
    mimeType,
    size:Math.max(0,Math.round(finite(input.size,0))),
    lastModified:Math.max(0,Math.round(finite(input.lastModified,0))),
    width:Math.max(0,Math.round(finite(input.width,0))),
    height:Math.max(0,Math.round(finite(input.height,0))),
    sha256:clean(input.sha256)||null,
    immutable:true
  });
}
function normalizeOperation(operation={}){
  const type=clean(operation.type);
  if(!ALLOWED_OPERATIONS.has(type))throw new Error(`IMAGE_LAB_OPERATION_UNSUPPORTED:${type||'missing'}`);
  const params=copy(operation.params||{});
  return F({operationId:clean(operation.operationId)||id('op'),type,enabled:operation.enabled!==false,params:F(params),createdAt:clean(operation.createdAt)||now()});
}
function normalizeRevision(revision={}){
  const operations=F([...(revision.operations||[])].map(normalizeOperation));
  const operationIds=F(operations.length?operations.map(op=>op.operationId):[...(revision.operationIds||[])].map(clean).filter(Boolean));
  return F({revisionId:clean(revision.revisionId)||id('rev'),label:clean(revision.label)||'Revision',createdAt:clean(revision.createdAt)||now(),operationIds,operations});
}
function freezeProject(project){
  const operations=F(project.working.operations.map(op=>F({...op,params:F(copy(op.params))})));
  return F({
    ...project,
    source:F({...project.source}),
    working:F({...project.working,operations}),
    revisions:F(project.revisions.map(normalizeRevision)),
    export:F({...project.export})
  });
}
function assertProject(project){if(!project||project.schema!=='kelo-image-lab-project-v1'||!project.source?.immutable||!Array.isArray(project.working?.operations))throw new Error('IMAGE_LAB_PROJECT_INVALID');}

export function createImageLabProject({projectId=null,name='',source={},exportFormat='png',quality=.92}={}){
  const createdAt=now(),src=immutableSource(source);
  return freezeProject({
    schema:'kelo-image-lab-project-v1',
    projectId:clean(projectId)||id('image-project'),
    name:clean(name)||src.name.replace(/\.[^.]+$/,'')||'Image Project',
    createdAt,updatedAt:createdAt,
    source:src,
    working:{baseSourceId:src.sourceId,operations:[]},
    revisions:[],
    export:{format:clean(exportFormat).toLowerCase()||'png',quality:Math.max(0,Math.min(1,finite(quality,.92)))}
  });
}

export function appendImageLabOperation(project,operation){
  assertProject(project);const op=normalizeOperation(operation);return freezeProject({...project,updatedAt:now(),working:{...project.working,operations:[...project.working.operations,op]}});
}
export function replaceImageLabOperation(project,operationId,patch={}){
  assertProject(project);const key=clean(operationId);let found=false;
  const operations=project.working.operations.map(op=>{if(op.operationId!==key)return op;found=true;return normalizeOperation({...op,...copy(patch),operationId:op.operationId,createdAt:op.createdAt});});
  if(!found)throw new Error(`IMAGE_LAB_OPERATION_NOT_FOUND:${key}`);
  return freezeProject({...project,updatedAt:now(),working:{...project.working,operations}});
}
export function removeImageLabOperation(project,operationId){
  assertProject(project);const key=clean(operationId),operations=project.working.operations.filter(op=>op.operationId!==key);if(operations.length===project.working.operations.length)throw new Error(`IMAGE_LAB_OPERATION_NOT_FOUND:${key}`);return freezeProject({...project,updatedAt:now(),working:{...project.working,operations}});
}
export function resetImageLabWorkingCopy(project){
  assertProject(project);return freezeProject({...project,updatedAt:now(),working:{...project.working,baseSourceId:project.source.sourceId,operations:[]}});
}
export function createImageLabRevision(project,{label='Revision'}={}){
  assertProject(project);const revision=normalizeRevision({label,operations:project.working.operations.map(op=>copy(op))});return freezeProject({...project,updatedAt:now(),revisions:[...project.revisions,revision]});
}
export function resolveImageLabOperations(project,{revisionId=null}={}){
  assertProject(project);if(!revisionId)return F(project.working.operations.filter(op=>op.enabled!==false));const revision=project.revisions.find(item=>item.revisionId===revisionId);if(!revision)throw new Error(`IMAGE_LAB_REVISION_NOT_FOUND:${revisionId}`);if(Array.isArray(revision.operations)&&revision.operations.length)return F(revision.operations.filter(op=>op.enabled!==false).map(normalizeOperation));const wanted=new Set(revision.operationIds);return F(project.working.operations.filter(op=>wanted.has(op.operationId)&&op.enabled!==false));
}
export function withImageLabExport(project,{format=project?.export?.format||'png',quality=project?.export?.quality??.92}={}){
  assertProject(project);return freezeProject({...project,updatedAt:now(),export:{format:clean(format).toLowerCase(),quality:Math.max(0,Math.min(1,finite(quality,.92)))}});
}
export function serializeImageLabProject(project){assertProject(project);return JSON.stringify(copy(project),null,2);}
export const IMAGE_LAB_ALLOWED_OPERATIONS=F([...ALLOWED_OPERATIONS]);
