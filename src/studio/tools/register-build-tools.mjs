/* KELO-INDEX
 * area: STUDIO / BUILD TOOLS
 * owns: paint-copies, quick-build and room tools loaded after World chrome
 * does-not-own: select/placement core, live shell, authority
 * public-api: registerBuildTools()
 * reuse: registerBasicTools() composes this after registerCoreTools()
 * mobile: kept off the first Studio request wave so iPhone can keep the launch chrome
 * online: no
 * surgery: every tool creation is guarded by KELO_WORLD_SURGERY before side effects
 */
import { createPaintCopiesTool } from './paint-copies-tool.mjs';
import { createQuickBuildTool } from './quick-build-tool.mjs';
import { createRoomBuildTool } from './room-build-tool.mjs';
import { createRoomOpeningTool } from './room-opening-tool.mjs';
import { createRoomMaterialTool } from './room-material-tool.mjs';

const surgery=()=>globalThis.KELO_WORLD_SURGERY||null;
const enabled=key=>surgery()?.enabled?.(key)!==false;
const disabled=(key,reason='switch-off')=>surgery()?.moduleDisabled?.(key,`BUILD_TOOLS:${reason}`);

function createTracked(key,create){
  if(!enabled(key)){disabled(key);return null;}
  const S=surgery(),started=S?.moduleStart?.(key,'BUILD_TOOLS');
  try{
    const value=create();
    S?.moduleDone?.(key,started);
    return value;
  }catch(error){
    S?.moduleFailed?.(key,error);
    throw error;
  }
}

export function registerBuildTools(kernel,core={}){
  const placement=core.placement||kernel.tools.get('placement');
  if(!enabled('basicTools')){
    for(const key of ['paintCopies','quickBuild','roomBuild','roomOpening','roomMaterial'])disabled(key,'basicTools-master-off');
    return {paintCopies:null,quickBuild:null,roomBuild:null,roomOpening:null,roomMaterial:null};
  }

  let paintCopies=kernel.tools.get('paintCopies');
  if(!paintCopies){
    paintCopies=createTracked('paintCopies',()=>createPaintCopiesTool(kernel));
    if(paintCopies)kernel.tools.register(paintCopies);
  }

  let quickBuild=kernel.tools.get('quickBuild');
  if(!quickBuild){
    quickBuild=createTracked('quickBuild',()=>createQuickBuildTool(kernel,{placement}));
    if(quickBuild)kernel.tools.register(quickBuild);
  }

  let roomBuild=kernel.tools.get('roomBuild');
  if(!roomBuild){
    if(!quickBuild){disabled('roomBuild','dependency-quickBuild-off');}
    else{
      roomBuild=createTracked('roomBuild',()=>createRoomBuildTool(kernel,{placement,quickBuild}));
      if(roomBuild)kernel.tools.register(roomBuild);
    }
  }

  let roomOpening=kernel.tools.get('roomOpening');
  if(!roomOpening){
    roomOpening=createTracked('roomOpening',()=>createRoomOpeningTool(kernel));
    if(roomOpening)kernel.tools.register(roomOpening);
  }

  let roomMaterial=kernel.tools.get('roomMaterial');
  if(!roomMaterial){
    roomMaterial=createTracked('roomMaterial',()=>createRoomMaterialTool(kernel));
    if(roomMaterial)kernel.tools.register(roomMaterial);
  }

  return {paintCopies,quickBuild,roomBuild,roomOpening,roomMaterial};
}
