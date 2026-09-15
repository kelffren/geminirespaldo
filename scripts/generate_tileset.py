#!/usr/bin/env python3
"""Generate Kelo World's production 512x512 / 32px Roman-garden tileset.
No external libraries. Output is deterministic RGBA PNG.
"""
import struct, zlib, random
from pathlib import Path

W = H = 512
T = 32
pix = bytearray(W * H * 4)

def setpx(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 4
        pix[i:i+4] = bytes(c)

def rect(x, y, w, h, c):
    x0=max(0,x); y0=max(0,y); x1=min(W,x+w); y1=min(H,y+h)
    row = bytes(c) * max(0, x1-x0)
    for yy in range(y0,y1):
        i=(yy*W+x0)*4
        pix[i:i+len(row)] = row

def line(x0,y0,x1,y1,c):
    dx=abs(x1-x0); sx=1 if x0<x1 else -1
    dy=-abs(y1-y0); sy=1 if y0<y1 else -1
    err=dx+dy
    while True:
        setpx(x0,y0,c)
        if x0==x1 and y0==y1: break
        e2=2*err
        if e2>=dy: err+=dy; x0+=sx
        if e2<=dx: err+=dx; y0+=sy

def circle(cx,cy,r,c,fill=True):
    rr=r*r
    inner=(r-1)*(r-1)
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            d=(x-cx)*(x-cx)+(y-cy)*(y-cy)
            if (fill and d<=rr) or ((not fill) and inner<=d<=rr): setpx(x,y,c)

def ellipse(cx,cy,rx,ry,c):
    if rx<=0 or ry<=0: return
    for y in range(cy-ry,cy+ry+1):
        for x in range(cx-rx,cx+rx+1):
            if ((x-cx)*(x-cx))/(rx*rx)+((y-cy)*(y-cy))/(ry*ry)<=1: setpx(x,y,c)

def tile_xy(i): return (i%16*T, i//16*T)

GRASS=(80,207,55,255); GRASS2=(91,219,64,255); GRASS3=(68,187,51,255); DARK=(43,142,43,255); LIGHT=(131,235,91,255)
MARBLE=(248,244,226,255); MARBLE2=(239,233,207,255); WHITE=(255,251,237,255); VEIN=(195,184,159,255)
GOLD=(218,169,48,255); GOLD2=(167,116,27,255); GOLDL=(246,207,78,255); GREEN=(55,157,68,255)
WATER=(35,184,222,255); WATER2=(83,221,240,255); WOOD=(116,70,28,255); WOOD2=(69,43,23,255)
STONE=(232,226,207,255); SHADOW=(0,0,0,80); CLEAR=(0,0,0,0)

# Transparent canvas by default.
for i in range(32):
    x,y=tile_xy(i)
    base = GRASS if i in (0,3,24) else GRASS2 if i in (1,25) else GRASS3 if i==2 else MARBLE if i not in (16,17,18,19,20,21,22,23) else GRASS
    rect(x,y,T,T,base)

# Grass tiles 0-3, 24-25.
def grass(i, seed, flowers=False, soft=False):
    x,y=tile_xy(i); rect(x,y,T,T,GRASS2 if soft else GRASS)
    rnd=random.Random(seed)
    for _ in range(28):
        px=x+rnd.randrange(2,30); py=y+rnd.randrange(2,30)
        setpx(px,py,DARK if rnd.random()<.55 else LIGHT)
    if flowers:
        for ox,oy,col in [(7,8,(255,255,246,255)),(21,17,(255,220,78,255)),(14,25,(255,151,190,255)),(25,7,(169,152,255,255))]:
            rect(x+ox,y+oy,3,2,col); setpx(x+ox+1,y+oy+1,GOLDL)
for i,s,f,soft in [(0,101,0,0),(1,202,0,0),(2,303,0,0),(3,404,1,0),(24,505,1,0),(25,606,0,1)]: grass(i,s,bool(f),bool(soft))

# Marble tiles.
def marble(i, base=MARBLE, frame=False, diamond=False, green=False, medallion=False):
    x,y=tile_xy(i); rect(x,y,T,T,base)
    rect(x,y,T,1,WHITE); rect(x,y+31,T,1,(218,208,185,255))
    line(x+3,y+25,x+10,y+18,VEIN); line(x+10,y+18,x+15,y+19,VEIN); line(x+15,y+19,x+22,y+10,VEIN); line(x+22,y+10,x+29,y+6,VEIN)
    if frame:
        rect(x+2,y+2,28,2,GOLD); rect(x+2,y+28,28,2,GOLD); rect(x+2,y+2,2,28,GOLD); rect(x+28,y+2,2,28,GOLD)
        rect(x+5,y+5,22,1,GOLDL); rect(x+5,y+26,22,1,GOLDL)
    if diamond:
        pts=[(16,4),(28,16),(16,28),(4,16)]
        for a,b in zip(pts,pts[1:]+pts[:1]): line(x+a[0],y+a[1],x+b[0],y+b[1],GOLD)
        fill=GREEN if green else WHITE
        for yy in range(8,25):
            span=8-abs(16-yy)//2
            rect(x+16-span,y+yy,span*2+1,1,fill)
        for a,b in zip([(16,9),(23,16),(16,23),(9,16)],[(23,16),(16,23),(9,16),(16,9)]): line(x+a[0],y+a[1],x+b[0],y+b[1],GOLDL)
    if medallion:
        circle(x+16,y+16,12,GREEN); circle(x+16,y+16,12,GOLD,False); circle(x+16,y+16,9,GOLDL,False)
        for dx,dy in [(0,-8),(3,-3),(8,0),(3,3),(0,8),(-3,3),(-8,0),(-3,-3)]: line(x+16,y+16,x+16+dx,y+16+dy,GOLDL)

for i in [4,26,28]: marble(i,MARBLE)
for i in [5,27,29]: marble(i,MARBLE2)
marble(6,MARBLE,frame=True); marble(7,MARBLE2,frame=True)
marble(8,MARBLE,diamond=True,green=True); marble(9,MARBLE,medallion=True); marble(10,MARBLE,diamond=True)
marble(30,MARBLE,frame=True); marble(31,MARBLE2,frame=True)
for i in [11,12,13,14,15]: marble(i,MARBLE if i%2 else MARBLE2,frame=(i>=13))

# Grass/marble transitions 16-23: fully opaque, never transparent.
for i in range(16,24):
    x,y=tile_xy(i); grass(i,700+i,False,False)
    if i==16: rect(x,y,32,10,MARBLE)
    elif i==17: rect(x,y+22,32,10,MARBLE)
    elif i==18: rect(x,y,10,32,MARBLE)
    elif i==19: rect(x+22,y,10,32,MARBLE)
    elif i==20: rect(x,y,14,14,MARBLE)
    elif i==21: rect(x+18,y,14,14,MARBLE)
    elif i==22: rect(x,y+18,14,14,MARBLE)
    else: rect(x+18,y+18,14,14,MARBLE)

# Clear prop region rows >=2 before drawing sprites.
rect(0,64,512,448,CLEAR)

# Fountain 3x3 at ids 32,33,34 / 48..50 / 64..66 => x0,y64,w96,h96.
fx,fy=0,64
ellipse(fx+48,fy+73,43,12,SHADOW)
circle(fx+48,fy+49,38,STONE); circle(fx+48,fy+49,34,GOLD,False); circle(fx+48,fy+49,29,WATER)
circle(fx+48,fy+49,22,WATER2,False)
rect(fx+44,fy+20,8,32,STONE); rect(fx+42,fy+18,12,4,GOLD)
circle(fx+48,fy+17,8,STONE); circle(fx+48,fy+17,6,WATER)
rect(fx+47,fy+2,3,17,WATER2); rect(fx+40,fy+8,2,12,WATER2); rect(fx+55,fy+8,2,12,WATER2)

# Tree 2x3 at x96,y64.
tx,ty=96,64
ellipse(tx+32,ty+85,22,7,SHADOW); rect(tx+27,ty+47,10,39,WOOD); rect(tx+29,ty+47,4,39,(145,89,34,255))
for cx,cy,r,col in [(32,30,22,GRASS3),(18,39,17,GRASS),(46,39,18,GRASS2),(31,17,16,GRASS2)]: circle(tx+cx,ty+cy,r,col)
for px,py in [(18,29),(35,13),(47,36),(29,42),(41,25)]: rect(tx+px,ty+py,3,3,LIGHT)

# Column 1x2 at x160,y64.
cx,cy=160,64
ellipse(cx+16,cy+60,13,5,SHADOW); rect(cx+7,cy+55,18,7,GOLD2); rect(cx+5,cy+51,22,6,STONE)
rect(cx+10,cy+12,12,40,STONE); rect(cx+12,cy+13,3,38,WHITE); rect(cx+18,cy+13,2,38,(201,191,169,255))
rect(cx+6,cy+7,20,7,GOLD); rect(cx+4,cy+4,24,5,STONE); rect(cx+8,cy+1,16,4,WHITE)

# Generic bush/planter tiles.
def bush_tile(i, flowers=False, planter=False):
    x,y=tile_xy(i)
    if planter:
        ellipse(x+16,y+28,13,4,SHADOW); rect(x+5,y+20,22,8,STONE); rect(x+7,y+18,18,4,GOLD); rect(x+8,y+22,16,4,(205,194,167,255))
    else: ellipse(x+16,y+27,13,4,SHADOW)
    for cx0,cy0,r,col in [(10,17,8,GRASS3),(18,13,10,GRASS2),(24,18,8,GRASS),(15,21,9,GRASS)]: circle(x+cx0,y+cy0,r,col)
    if flowers:
        for px0,py0,col in [(9,14,(255,168,194,255)),(19,9,(255,247,230,255)),(23,18,(255,210,68,255)),(14,21,(169,152,255,255))]: rect(x+px0,y+py0,3,2,col)
for i,f,p in [(38,0,0),(39,1,0),(54,0,0),(55,1,0),(56,0,1),(57,1,1)]: bush_tile(i,bool(f),bool(p))

# Flowerbed 2x1 ids 40,41 at x256,y64.
x,y=256,64
ellipse(x+32,y+28,29,4,SHADOW); rect(x+2,y+17,60,11,STONE); rect(x+3,y+15,58,5,GOLD)
for px0,col in [(8,(255,170,192,255)),(17,(255,247,230,255)),(27,(255,212,70,255)),(38,(170,154,255,255)),(49,(255,170,192,255))]:
    circle(x+px0,y+13,6,GRASS); rect(x+px0-1,y+10,3,3,col)

# Statue 1x2 ids 42,58 x320,y64.
x,y=320,64
ellipse(x+16,y+61,13,4,SHADOW); rect(x+5,y+52,22,9,STONE); rect(x+8,y+47,16,7,GOLD)
circle(x+16,y+16,7,STONE); rect(x+11,y+23,10,22,STONE); rect(x+7,y+27,5,17,STONE); rect(x+20,y+27,5,17,STONE)
line(x+12,y+25,x+4,y+15,STONE); line(x+20,y+25,x+28,y+15,STONE)

# Lamp 1x2 ids43,59 x352,y64.
x,y=352,64
ellipse(x+16,y+61,9,3,SHADOW); rect(x+14,y+22,4,37,GOLD2); rect(x+11,y+57,10,4,GOLD)
rect(x+9,y+11,14,13,(38,43,48,255)); rect(x+11,y+13,10,9,(255,226,120,255)); rect(x+13,y+3,6,8,GOLD); rect(x+10,y+9,12,3,GOLD)

# Bench 2x1 ids44,45 x384,y64.
x,y=384,64
ellipse(x+32,y+28,28,4,SHADOW); rect(x+5,y+12,54,8,WOOD); rect(x+7,y+9,50,4,(161,99,42,255)); rect(x+9,y+20,5,9,WOOD2); rect(x+50,y+20,5,9,WOOD2)

# Rug 2x2 ids46,47,62,63 x448,y64.
x,y=448,64
rect(x+3,y+3,58,58,(21,116,65,255)); rect(x+5,y+5,54,2,GOLD); rect(x+5,y+57,54,2,GOLD); rect(x+5,y+5,2,54,GOLD); rect(x+57,y+5,2,54,GOLD)
for d in range(-10,11):
    setpx(x+32+d,y+32-abs(d),GOLDL); setpx(x+32+d,y+32+abs(d),GOLDL)

# Brazier id60 and pot id61.
x,y=tile_xy(60); ellipse(x+16,y+28,12,4,SHADOW); circle(x+16,y+20,11,GOLD2); rect(x+9,y+17,14,5,(65,50,29,255));
for ox,oy,col in [(0,-11,(255,93,43,255)),(-4,-7,(255,181,44,255)),(4,-8,(255,221,74,255))]: circle(x+16+ox,y+17+oy,5,col)
x,y=tile_xy(61); ellipse(x+16,y+28,11,3,SHADOW); rect(x+7,y+11,18,15,(228,215,185,255)); rect(x+5,y+9,22,5,GOLD); rect(x+9,y+24,14,4,GOLD2)

# A few water/edge utility tiles in row4 after props, all fully opaque only where used as ground alternatives.
for i in range(69,80):
    x,y=tile_xy(i); rect(x,y,T,T,WATER if i%2 else MARBLE)
    if i%2: line(x+2,y+10,x+12,y+8,WATER2); line(x+17,y+20,x+29,y+18,WATER2)
    else: line(x+3,y+25,x+28,y+6,VEIN)

# PNG writer.
def chunk(kind, data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
raw=bytearray()
stride=W*4
for y in range(H): raw.append(0); raw.extend(pix[y*stride:(y+1)*stride])
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
out=Path('assets/tileset.png'); out.parent.mkdir(parents=True,exist_ok=True); out.write_bytes(png)
print(f'wrote {out} {W}x{H} bytes={len(png)}')
