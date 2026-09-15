/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / NORMALIZED GRID BRIDGE
 * owner: canonicalize a pre-normalized sheet after Builder image ingestion
 * keys: EXACT GRID PRENORMALIZED ROWS COLUMNS FRAME SIZE BRIDGE LAZY
 * purpose: keep the Builder as image owner while preventing Auto-Fit from reinterpreting sheets already normalized by creator preprocessors
 * does-not-own: image detection, combat, runtime animation, publishing
 */
let controllerPromise=null;
const controller=()=>controllerPromise||(controllerPromise=import('./sprite-ability-live-controller.mjs'));
const sleep=(root,ms)=>new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,ms));
function fieldInput(workspace,label){for(const row of workspace.querySelectorAll('.ksw-left .ksw-field'))if(row.querySelector('label')?.textContent?.trim()===label)return row.querySelector('input,select');return null;}
async function setField(root,workspace,label,value){for(let attempt=0;attempt<12;attempt++){const input=fieldInput(workspace,label);if(input){input.value=String(value);input.dispatchEvent(new root.Event('change',{bubbles:true}));await sleep(root,0);return true;}await sleep(root,20);}throw new Error(`SPRITE_NORMALIZED_GRID_FIELD_MISSING:${label}`);}
export async function applyNormalizedGrid({root=globalThis,workspace,fileName,columns,rows,frameWidth,frameHeight,startFrame=0,endFrame=null,timeout=8000}={}){
  const cols=Math.max(1,Math.round(Number(columns)||1)),rws=Math.max(1,Math.round(Number(rows)||1)),fw=Math.max(1,Math.round(Number(frameWidth)||1)),fh=Math.max(1,Math.round(Number(frameHeight)||1)),start=Math.max(0,Math.round(Number(startFrame)||0)),end=endFrame==null?cols*rws-1:Math.max(start,Math.min(cols*rws-1,Math.round(Number(endFrame)||0))),needle=String(fileName||'').replace(/\.[^.]+$/,'');
  // Important: loading Creator Hub must not pull StudioWorkspaceShell. Resolve the
  // canonical Sprite Ability controller only when a preprocessor actually applies a grid.
  const mod=await controller(),getBuilder=()=>mod.getSpriteAbilityBuilder?.()||null;
  const started=Date.now();let builder=null;
  while(Date.now()-started<timeout){builder=getBuilder();const current=String(builder?.draft?.sheet?.fileName||'');if(builder&&(!needle||current.includes(needle)))break;await sleep(root,35);}
  if(!builder)throw new Error('SPRITE_NORMALIZED_GRID_BUILDER_TIMEOUT');
  const ws=workspace||root.document?.getElementById('kelo-studio-workspace');if(!ws)throw new Error('SPRITE_NORMALIZED_GRID_WORKSPACE_REQUIRED');
  // Rows first deliberately clamps phantom end frames produced by Auto-Fit as early as possible.
  await setField(root,ws,'Rows',rws);
  await setField(root,ws,'Columns',cols);
  await setField(root,ws,'Frame W',fw);
  await setField(root,ws,'Frame H',fh);
  await setField(root,ws,'Start Frame',start);
  await setField(root,ws,'End Frame',end);
  builder=getBuilder();builder?.setFrame?.(start,{pause:true,center:true});await builder?.save?.();
  const sheet=builder?.draft?.sheet;if(!sheet||sheet.columns!==cols||sheet.rows!==rws||sheet.frameWidth!==fw||sheet.frameHeight!==fh||sheet.startFrame!==start||sheet.endFrame!==end)throw new Error(`SPRITE_NORMALIZED_GRID_MISMATCH:${sheet?.columns}x${sheet?.rows}:${sheet?.frameWidth}x${sheet?.frameHeight}:${sheet?.startFrame}-${sheet?.endFrame}`);
  return Object.freeze({columns:cols,rows:rws,frameWidth:fw,frameHeight:fh,startFrame:start,endFrame:end,fileName:sheet.fileName});
}
