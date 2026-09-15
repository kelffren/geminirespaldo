#!/usr/bin/env python3
"""Generate Kelo World's organic 16-mask grass↔marble transition overlay atlas.
Deterministic 128x128 RGBA PNG, 16 cells of 32x32. No external assets.
"""
from pathlib import Path
from PIL import Image

T=32; W=H=128
OUT=Path('assets/plaza-transitions-v2.png')
img=Image.new('RGBA',(W,H),(0,0,0,0)); px=img.load()
# Registry mapping is mask -> tile id; invert here so generated cells remain contract-compatible.
TRANSITION_MASKS={0:15,1:0,2:1,3:5,4:2,5:12,6:6,7:9,8:3,9:4,10:13,11:8,12:7,13:11,14:10,15:14}
ID_TO_MASK={tile_id:mask for mask,tile_id in TRANSITION_MASKS.items()}
BASE=(78,195,53,255); MID=(88,207,61,255); LIGHT=(100,218,72,255); DARK=(55,155,42,255)
PATTERN=(3,3,4,3,2,3,4,5,4,3,3,2,3,4,3,3)

def put(x,y,c):
    if 0<=x<W and 0<=y<H: px[x,y]=c

def cell(i): return (i%4*T,i//4*T)
def depth(pos,seed): return PATTERN[(pos+seed)%len(PATTERN)]

def edge_tile(i,mask):
    ox,oy=cell(i)
    if mask&1:
        for x in range(T):
            d=depth(x,i)
            for y in range(d): put(ox+x,oy+y,BASE if (x+y)%3 else MID)
        for cx in (5,14,24):
            ext=3 if (cx+i)%2 else 2
            for dx in (-1,0,1):
                for dy in range(ext):
                    if abs(dx)+dy<ext+1: put(ox+cx+dx,oy+depth(cx,i)+dy,LIGHT if dy==ext-1 else MID)
    if mask&4:
        for x in range(T):
            d=depth(x,i+3)
            for yy in range(d): put(ox+x,oy+31-yy,BASE if (x+yy)%3 else MID)
        for cx in (8,19,28):
            ext=2+(cx+i)%2
            for dx in (-1,0,1):
                for dy in range(ext):
                    if abs(dx)+dy<ext+1: put(ox+cx+dx,oy+31-depth(cx,i+3)-dy,LIGHT if dy==ext-1 else MID)
    if mask&8:
        for y in range(T):
            d=depth(y,i+6)
            for x in range(d): put(ox+x,oy+y,BASE if (x+y)%3 else MID)
        for cy in (6,17,26):
            ext=2+(cy+i)%2
            for dy in (-1,0,1):
                for dx in range(ext):
                    if abs(dy)+dx<ext+1: put(ox+depth(cy,i+6)+dx,oy+cy+dy,LIGHT if dx==ext-1 else MID)
    if mask&2:
        for y in range(T):
            d=depth(y,i+9)
            for xx in range(d): put(ox+31-xx,oy+y,BASE if (xx+y)%3 else MID)
        for cy in (4,13,23):
            ext=2+(cy+i)%2
            for dy in (-1,0,1):
                for dx in range(ext):
                    if abs(dy)+dx<ext+1: put(ox+31-depth(cy,i+9)-dx,oy+cy+dy,LIGHT if dx==ext-1 else MID)
    # Ground the fringe with sparse dark pixels, but only inside already-opaque grass.
    opaque=[]
    for y in range(T):
        for x in range(T):
            if px[ox+x,oy+y][3]: opaque.append((x,y))
    if opaque:
        step=max(1,len(opaque)//12)
        for x,y in opaque[::step][:12]: put(ox+x,oy+y,DARK)

for tile_id in range(16): edge_tile(tile_id,ID_TO_MASK[tile_id])
OUT.parent.mkdir(parents=True,exist_ok=True)
img.save(OUT)
print(f'wrote {OUT} {img.size[0]}x{img.size[1]}')
