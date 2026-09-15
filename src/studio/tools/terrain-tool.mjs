/* KELO-INDEX
 * area: STUDIO / TERRAIN TOOL
 * owns: terrain/path brush preview, continuous strokes and one-history-action commits
 * does-not-own: terrain rendering, autotile implementation or authority transport
 * public-api: createTerrainTool()
 * online: stroke stays local until pointerup; confirmed cells mirror through authority
 */

import { createSetSurfaceCellCommand } from '../document/world-surface-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const snap = (value, size) => Math.floor(Math.max(0, Number(value) || 0) / size) * size;
const key = (x,y) => `${x},${y}`;

export function createTerrainTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TERRAIN_KERNEL_REQUIRED');
  let material = 'grass', role = 'terrain', erase = false, preview = null, brushSize = 1, stroke = null;
  const tileSize = () => Math.max(1, Number(kernel.document.settings?.tileSize) || 32);
  function configure(next = {}) {
    if (next.material != null) material = String(next.material || material);
    if (next.role != null) role = next.role === 'path' ? 'path' : 'terrain';
    if (next.erase != null) erase = !!next.erase;
    if (next.brushSize != null) brushSize = Math.max(1, Math.min(5, Math.round(Number(next.brushSize) || 1)));
    if (preview) move(preview.x, preview.y);
    return state();
  }
  function footprint(x,y,target) {
    const size=tileSize(), baseX=snap(x,size), baseY=snap(y,size), half=Math.floor(brushSize/2);
    for(let by=0;by<brushSize;by++) for(let bx=0;bx<brushSize;bx++) {
      const sx=Math.max(0,baseX+(bx-half)*size), sy=Math.max(0,baseY+(by-half)*size); target.set(key(sx,sy),{x:sx,y:sy,w:size,h:size,material,role,erase});
    }
  }
  function move(x, y) {
    const cells=new Map(); footprint(x,y,cells); const first=cells.values().next().value;
    preview = { x:snap(x,tileSize()), y:snap(y,tileSize()), w:tileSize()*brushSize, h:tileSize()*brushSize, material, role, erase, cells:[...cells.values()] };
    if(first&&brushSize===1){preview.x=first.x;preview.y=first.y;preview.w=first.w;preview.h=first.h;}
    return { ...preview, cells:preview.cells.map(c=>({...c})) };
  }
  function beginStroke(x,y){stroke={cells:new Map(),last:null};addStrokePoint(x,y);return strokeState();}
  function addStrokePoint(x,y){
    if(!stroke)return beginStroke(x,y);
    const size=tileSize(), sx=snap(x,size), sy=snap(y,size), last=stroke.last;
    if(last){const dx=sx-last.x,dy=sy-last.y,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/size));for(let i=1;i<=steps;i++)footprint(last.x+dx*i/steps,last.y+dy*i/steps,stroke.cells);}else footprint(sx,sy,stroke.cells);
    stroke.last={x:sx,y:sy}; if(stroke.cells.size>512)throw new Error('STUDIO_BRUSH_STROKE_LIMIT:512'); move(sx,sy); return strokeState();
  }
  async function commit() {
    if (!preview) return null;
    const row = { ...preview, tileSize: tileSize() };
    delete row.cells;
    return kernel.execute(createSetSurfaceCellCommand(row));
  }
  async function commitStroke(){
    if(!stroke?.cells?.size){stroke=null;return null;}
    const rows=[...stroke.cells.values()], commands=rows.map(row=>createSetSurfaceCellCommand({...row,tileSize:tileSize()}));
    stroke=null;
    if(commands.length===1)return kernel.execute(commands[0]);
    return kernel.execute(createCompositeCommand(commands,{type:'surface.stroke',label:`${erase?'Erase':role==='path'?'Road':'Ground'} stroke · ${commands.length} cells`}));
  }
  function cancel() { preview = null; stroke = null; }
  function strokeState(){return stroke?{count:stroke.cells.size,cells:[...stroke.cells.values()].map(c=>({...c}))}:null;}
  function state() { return { material, role, erase, brushSize, preview: preview ? { ...preview, cells:preview.cells?.map(c=>({...c}))||[] } : null, stroke:strokeState() }; }
  return Object.freeze({ id: 'terrain', configure, move, beginStroke, strokeTo:addStrokePoint, commitStroke, commit, cancel, state, getStrokePreview:strokeState, getPreview: () => preview ? { ...preview, cells:preview.cells?.map(c=>({...c}))||[] } : null });
}
