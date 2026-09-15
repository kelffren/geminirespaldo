from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Reusable importer: source pixels are truth. Native alpha wins. Large connected
# components define primary sprites; small disconnected decorations are attached to
# the nearest primary without ever merging two primary sprites together.


def estimate_background(rgb: np.ndarray, border: int = 12) -> np.ndarray:
    strips = np.concatenate([
        rgb[:border].reshape(-1, 3), rgb[-border:].reshape(-1, 3),
        rgb[:, :border].reshape(-1, 3), rgb[:, -border:].reshape(-1, 3),
    ], axis=0).astype(np.float32)
    return np.median(strips, axis=0)


def alpha_from_background(rgb: np.ndarray, bg: np.ndarray, soft: float, core: float):
    dist = np.linalg.norm(rgb.astype(np.float32) - bg[None, None, :], axis=2)
    alpha = np.clip((dist - soft) / max(1.0, core - soft), 0.0, 1.0) * 255.0
    return alpha.astype(np.uint8), dist


def union_box(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def box_distance(a, b):
    ax1, ay1, ax2, ay2 = a; bx1, by1, bx2, by2 = b
    dx = max(bx1 - ax2, ax1 - bx2, 0)
    dy = max(by1 - ay2, ay1 - by2, 0)
    return math.hypot(dx, dy)


def expand_box(box, margin, width, height):
    x1, y1, x2, y2 = box
    return max(0,x1-margin), max(0,y1-margin), min(width,x2+margin), min(height,y2+margin)


def attach_satellites(components, primary_area: int, satellite_distance: float):
    primaries = [c for c in components if c['area'] >= primary_area]
    satellites = [c for c in components if c['area'] < primary_area]
    if not primaries:
        return []
    grouped = {c['id']: c['box'] for c in primaries}
    for sat in satellites:
        ranked = sorted((box_distance(sat['box'], p['box']), p['id']) for p in primaries)
        distance, pid = ranked[0]
        if distance <= satellite_distance:
            grouped[pid] = union_box(grouped[pid], sat['box'])
    return list(grouped.values())


def assign_names(boxes):
    # Semantic names only where geometry makes the identity unambiguous: the five
    # large top-row trees. Everything else stays provisional until curated later.
    ordered = sorted(boxes, key=lambda b:(b[1],b[0]))
    top = [b for b in ordered if (b[3]-b[1]) >= 240 and b[1] < 330]
    top = sorted(top, key=lambda b:b[0])
    names = {}
    preferred=['tree_large','tree_pink','tree_medium','tree_cypress','tree_small']
    used=set()
    for name,box in zip(preferred,top[:5]): names[name]=box; used.add(box)
    n=1
    for box in ordered:
        if box in used: continue
        names[f'sprite_{n:02d}']=box; n+=1
    return names


def main():
    p=argparse.ArgumentParser(description='Auto-detect irregular sprites and emit atlas metadata.')
    p.add_argument('source'); p.add_argument('--atlas',required=True); p.add_argument('--json',required=True)
    p.add_argument('--js',required=True); p.add_argument('--preview',required=True)
    p.add_argument('--margin',type=int,default=12); p.add_argument('--soft-threshold',type=float,default=8.0)
    p.add_argument('--core-threshold',type=float,default=28.0); p.add_argument('--min-component-area',type=int,default=20)
    p.add_argument('--primary-area',type=int,default=1000); p.add_argument('--satellite-distance',type=float,default=72.0)
    args=p.parse_args()

    src=Path(args.source); rgba_out,json_out,js_out,preview_out=map(Path,[args.atlas,args.json,args.js,args.preview])
    for out in [rgba_out,json_out,js_out,preview_out]: out.parent.mkdir(parents=True,exist_ok=True)

    source_rgba=Image.open(src).convert('RGBA'); arr=np.array(source_rgba); rgb,native_alpha=arr[:,:,:3],arr[:,:,3]
    h,w=rgb.shape[:2]; transparent_fraction=float(np.mean(native_alpha<250))
    meaningful_native_alpha=transparent_fraction>0.01 and int(native_alpha.min())<32
    if meaningful_native_alpha:
        alpha=native_alpha.copy(); core=(alpha>=24).astype(np.uint8); background_mode='native-alpha'; bg=None; cleaned=source_rgba
    else:
        bg=estimate_background(rgb); alpha,dist=alpha_from_background(rgb,bg,args.soft_threshold,args.core_threshold)
        core=(dist>=args.core_threshold).astype(np.uint8); background_mode='color-distance'; cleaned=Image.fromarray(np.dstack([rgb,alpha]),'RGBA')

    core=cv2.morphologyEx(core,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8),iterations=1)
    count,labels,stats,_=cv2.connectedComponentsWithStats(core,8)
    components=[]
    for i in range(1,count):
        x,y,cw,ch,area=[int(v) for v in stats[i]]
        if area>=args.min_component_area:
            components.append({'id':i,'box':(x,y,x+cw,y+ch),'area':area})

    boxes=attach_satellites(components,args.primary_area,args.satellite_distance)
    boxes=[expand_box(b,args.margin,w,h) for b in boxes]
    names=assign_names(boxes)

    required=['tree_large','tree_pink','tree_medium','tree_cypress','tree_small']
    missing=[n for n in required if n not in names]
    if missing: raise SystemExit(f'IMPORT_FAIL missing top-tree frames {missing}; detected={len(names)}')
    if len(names)<15: raise SystemExit(f'IMPORT_FAIL only {len(names)} primary sprites; expected at least 15')
    tree=names['tree_large']; tw,th=tree[2]-tree[0],tree[3]-tree[1]
    if not (350<=tw<=520 and 430<=th<=600): raise SystemExit(f'IMPORT_FAIL suspicious tree_large {tw}x{th}')

    cleaned.save(rgba_out,'PNG',optimize=True)
    frames={}
    for name,(x1,y1,x2,y2) in names.items():
        fw,fh=x2-x1,y2-y1
        frames[name]={'x':x1,'y':y1,'w':fw,'h':fh,'anchor':{'x':round(fw*.5),'y':max(0,fh-4)},'footprint':{'w':max(16,round(fw*.34)),'h':max(12,round(fh*.10))}}

    meta={'version':'kelo-irregular-atlas-v1','source':src.as_posix(),'atlas':rgba_out.as_posix(),'width':w,'height':h,
          'backgroundMode':background_mode,'nativeTransparentFraction':round(transparent_fraction,6),'background':None if bg is None else [round(float(v),2) for v in bg],
          'detection':{'softThreshold':args.soft_threshold,'coreThreshold':args.core_threshold,'margin':args.margin,'minComponentArea':args.min_component_area,'primaryArea':args.primary_area,'satelliteDistance':args.satellite_distance},'frames':frames}
    json_out.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    js_out.write_text('window.KELO_ARBOL_1_ATLAS_META=Object.freeze('+json.dumps(meta,separators=(',',':'))+');\n',encoding='utf-8')

    preview=source_rgba.convert('RGB'); draw=ImageDraw.Draw(preview); font=ImageFont.load_default()
    for idx,(name,f) in enumerate(frames.items(),1):
        x1,y1,x2,y2=f['x'],f['y'],f['x']+f['w'],f['y']+f['h']; draw.rectangle((x1,y1,x2,y2),outline=(255,0,0),width=3)
        label=f'{idx:02d} {name}'; tb=draw.textbbox((x1+4,y1+4),label,font=font); draw.rectangle((tb[0]-2,tb[1]-2,tb[2]+2,tb[3]+2),fill=(255,255,255)); draw.text((x1+4,y1+4),label,fill=(0,0,0),font=font)
    preview.save(preview_out,'PNG',optimize=True)
    print('IMPORT_OK mode=',background_mode,'sprites=',len(frames),'tree_large=',frames['tree_large'])

if __name__=='__main__': main()
