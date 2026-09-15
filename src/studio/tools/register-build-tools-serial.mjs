/* KELO-INDEX
 * area: STUDIO / BUILD TOOLS SERIAL
 * owns: phone-safe registration of paint/quick/room tools without a static barrel spike
 * does-not-own: core tools, live shell, UI
 * public-api: registerBuildToolsSerial()
 * mobile: imported only after chrome; each tool module loads between yields
 * online: no
 */
export async function registerBuildToolsSerial(kernel,core={},{wait=async()=>{}}={}){
  const placement=core.placement||kernel.tools.get('placement');
  const out={};
  const ensure=async(id,path,factory)=>{
    let tool=kernel.tools.get(id);
    if(tool){out[id]=tool;return tool;}
    const mod=await import(path);
    await wait();
    tool=factory(mod);
    kernel.tools.register(tool);
    out[id]=tool;
    await wait();
    return tool;
  };
  const paintCopies=await ensure('paintCopies','./paint-copies-tool.mjs',m=>m.createPaintCopiesTool(kernel));
  const quickBuild=await ensure('quickBuild','./quick-build-tool.mjs',m=>m.createQuickBuildTool(kernel,{placement}));
  const roomBuild=await ensure('roomBuild','./room-build-tool.mjs',m=>m.createRoomBuildTool(kernel,{placement,quickBuild}));
  await ensure('roomOpening','./room-opening-tool.mjs',m=>m.createRoomOpeningTool(kernel));
  await ensure('roomMaterial','./room-material-tool.mjs',m=>m.createRoomMaterialTool(kernel));
  return Object.freeze({paintCopies,quickBuild,roomBuild,roomOpening:out.roomOpening,roomMaterial:out.roomMaterial});
}
