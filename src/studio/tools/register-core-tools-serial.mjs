/* KELO-INDEX
 * area: STUDIO / CORE TOOLS / SERIAL
 * owns: phone World-open tool registration without a static 7-module barrel
 * does-not-own: desktop/audit sync registerCoreTools()
 * public-api: registerCoreToolsSerial()
 * mobile: each await import() happens between paint yields so Safari never evaluates the full tool graph as one unit
 */
function pick(kernel,id,create){
  const existing=kernel.tools.get(id);
  if(existing)return existing;
  const tool=create();
  kernel.tools.register(tool);
  return tool;
}

export async function registerCoreToolsSerial(kernel,{wait=async()=>{}}={}){
  const selectMod=await import('./select-tool.mjs');await wait();
  const marqueeMod=await import('./marquee-select-tool.mjs');await wait();
  const placementMod=await import('./placement-tool.mjs');await wait();
  const transformMod=await import('./transform-tool.mjs');await wait();
  const terrainMod=await import('./terrain-tool.mjs');await wait();
  const collisionMod=await import('./collision-tool.mjs');await wait();
  const prefabMod=await import('./prefab-stamp-tool.mjs');await wait();
  return {
    select:pick(kernel,'select',()=>selectMod.createSelectTool(kernel)),
    marquee:pick(kernel,'marquee',()=>marqueeMod.createMarqueeSelectTool(kernel)),
    placement:pick(kernel,'placement',()=>placementMod.createPlacementTool(kernel)),
    transform:pick(kernel,'transform',()=>transformMod.createTransformTool(kernel)),
    terrain:pick(kernel,'terrain',()=>terrainMod.createTerrainTool(kernel)),
    collision:pick(kernel,'collision',()=>collisionMod.createCollisionTool(kernel)),
    prefabStamp:pick(kernel,'prefabStamp',()=>prefabMod.createPrefabStampTool(kernel))
  };
}
