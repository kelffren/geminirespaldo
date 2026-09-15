/* KELO-INDEX
 * area: CREATORS / WORKSPACE REGISTRY
 * owner: Creator Workspace registry
 * owns: workspace manifests and lazy open dispatch
 * does-not-own: Studio core, workspace implementation, permissions or networking
 * reused-by: every Creator workspace
 */
export function createCreatorWorkspaceRegistry() {
  const rows=new Map();
  function register(manifest){
    if(!manifest?.id||!manifest?.label||!manifest?.category||!Array.isArray(manifest.projectTypes))throw new Error('CREATOR_WORKSPACE_MANIFEST_INVALID');
    const id=String(manifest.id).toLowerCase();if(rows.has(id))throw new Error(`CREATOR_WORKSPACE_DUPLICATE:${id}`);
    const normalized=Object.freeze({...manifest,id,projectTypes:Object.freeze(manifest.projectTypes.map(v=>String(v).toUpperCase()))});rows.set(id,normalized);return normalized;
  }
  function resolve(id){return rows.get(String(id||'').toLowerCase())||null;}
  function list({category=null}={}){const all=[...rows.values()];return category?all.filter(row=>row.category===category):all;}
  async function closeStale(session){
    const close=session?.close||session?.destroy;
    if(typeof close!=='function')return false;
    try{await close.call(session,{save:false});return true;}catch{return false;}
  }
  async function open(id,context={}){
    const row=resolve(id);if(!row)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);if(typeof row.open!=='function')throw new Error(`CREATOR_WORKSPACE_NOT_AVAILABLE:${id}`);
    let session=await row.open(context);
    if(typeof row.isSessionAlive==='function'&&!row.isSessionAlive(session,context)){
      await closeStale(session);
      session=await row.open(context);
      if(!row.isSessionAlive(session,context))throw new Error(`CREATOR_WORKSPACE_MOUNT_FAILED:${row.id}`);
    }
    return session;
  }
  return Object.freeze({register,resolve,list,open,get size(){return rows.size;}});
}
