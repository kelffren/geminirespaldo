/* KELO-INDEX
 * area: STUDIO / CORE TOOLS
 * owns: select/move/place/terrain/collision tools needed to open World on iPhone
 * does-not-own: room builder, paint copies, quick-build, UI
 * public-api: registerCoreTools()
 * reuse: registerBasicTools() still registers the full set for audits and desktop
 * mobile: phone World-open uses register-core-tools-serial.mjs instead of this static barrel
 * online: no
 */
import { createSelectTool } from './select-tool.mjs';
import { createMarqueeSelectTool } from './marquee-select-tool.mjs';
import { createPlacementTool } from './placement-tool.mjs';
import { createTransformTool } from './transform-tool.mjs';
import { createTerrainTool } from './terrain-tool.mjs';
import { createCollisionTool } from './collision-tool.mjs';
import { createPrefabStampTool } from './prefab-stamp-tool.mjs';

function pick(kernel,id,create){
  const existing=kernel.tools.get(id);
  if(existing)return existing;
  const tool=create();
  kernel.tools.register(tool);
  return tool;
}

export function registerCoreTools(kernel){
  const select=pick(kernel,'select',()=>createSelectTool(kernel));
  const marquee=pick(kernel,'marquee',()=>createMarqueeSelectTool(kernel));
  const placement=pick(kernel,'placement',()=>createPlacementTool(kernel));
  const transform=pick(kernel,'transform',()=>createTransformTool(kernel));
  const terrain=pick(kernel,'terrain',()=>createTerrainTool(kernel));
  const collision=pick(kernel,'collision',()=>createCollisionTool(kernel));
  const prefabStamp=pick(kernel,'prefabStamp',()=>createPrefabStampTool(kernel));
  return {select,marquee,placement,transform,terrain,collision,prefabStamp};
}
