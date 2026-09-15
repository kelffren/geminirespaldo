/* KELO-INDEX
 * area: CREATORS / NETWORK ADAPTER
 * owner: browser JSON transport for Creator workspaces
 * purpose: keep direct fetch ownership out of Creator UI/workspace modules
 * does-not-own: authentication, endpoint policy, retries, product-specific errors
 */

export async function requestCreatorJson(root=globalThis,url,options={}){
  const fetcher=root?.fetch;
  if(typeof fetcher!=='function')throw new Error('CREATOR_HTTP_FETCH_UNAVAILABLE');
  const response=await fetcher.call(root,url,options);
  let data=null;
  try{data=await response.json();}catch{}
  return Object.freeze({ok:!!response.ok,status:Number(response.status)||0,data});
}
