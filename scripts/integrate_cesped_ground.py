from pathlib import Path
import json, re
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/cesped.PNG'
RUNTIME = ROOT / 'assets/cesped-runtime.PNG'
COLS = ROWS = 5
CELL = 32
ART = '501'


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def trim_cell(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert('RGB'), dtype=np.uint8)
    lum = rgb.mean(axis=2)
    h, w = lum.shape
    max_trim = max(3, min(18, min(w, h) // 12))

    def dark_row(y):
        row = lum[y, :]
        return float(row.mean()) < 48 or float((row < 38).mean()) > 0.58

    def dark_col(x):
        col = lum[:, x]
        return float(col.mean()) < 48 or float((col < 38).mean()) > 0.58

    t = 0
    while t < max_trim and dark_row(t): t += 1
    b = 0
    while b < max_trim and dark_row(h - 1 - b): b += 1
    l = 0
    while l < max_trim and dark_col(l): l += 1
    r = 0
    while r < max_trim and dark_col(w - 1 - r): r += 1

    # Remove one extra pixel after detected separator/shadow fringe, but do not
    # destroy authored foliage that reaches close to the tile edge.
    t = min(t + 1, max_trim)
    b = min(b + 1, max_trim)
    l = min(l + 1, max_trim)
    r = min(r + 1, max_trim)
    crop = img.crop((l, t, max(l + 2, w - r), max(t + 2, h - b)))
    cw, ch = crop.size
    side = min(cw, ch)
    x0 = max(0, (cw - side) // 2)
    y0 = max(0, (ch - side) // 2)
    return crop.crop((x0, y0, x0 + side, y0 + side))


def build_runtime():
    if not SOURCE.exists():
        raise RuntimeError('assets/cesped.PNG is missing')
    src = Image.open(SOURCE).convert('RGB')
    w, h = src.size
    if w < 500 or h < 500 or abs(w / h - 1.0) > 0.08:
        raise RuntimeError(f'cesped source must be a large near-square 5x5 sheet, got {w}x{h}')

    out = Image.new('RGB', (COLS * CELL, ROWS * CELL))
    for row in range(ROWS):
        for col in range(COLS):
            x0 = round(col * w / COLS)
            x1 = round((col + 1) * w / COLS)
            y0 = round(row * h / ROWS)
            y1 = round((row + 1) * h / ROWS)
            tile = trim_cell(src.crop((x0, y0, x1, y1)))
            # High-quality prefilter: retain the depth/shading information from
            # the HD source while producing a mobile-friendly 32px runtime tile.
            tile = tile.resize((CELL, CELL), Image.Resampling.LANCZOS)
            tile = tile.filter(ImageFilter.UnsharpMask(radius=0.6, percent=115, threshold=3))
            out.paste(tile, (col * CELL, row * CELL))

    out.save(RUNTIME, optimize=True)
    check = Image.open(RUNTIME)
    if check.size != (160, 160):
        raise RuntimeError(f'bad runtime atlas size {check.size}')
    print(f'CESPED_RUNTIME source={w}x{h} runtime=160x160 tiles=25 cell=32')


def patch_registry():
    path = ROOT / 'src/environment/tile-registry.js'
    text = path.read_text(encoding='utf-8')
    text = re.sub(r"\n  const cespedAtlas = Object\.freeze\(\{.*?\n  \}\);", '', text, flags=re.S)
    marker = "  const transitionAtlas = Object.freeze({"
    block = (
        "  const cespedAtlas = Object.freeze({\n"
        "    id:'cesped-hd', src:'assets/cesped-runtime.PNG?art=501', width:160, height:160,\n"
        "    tileWidth:TILE, tileHeight:TILE, columns:5, tileCount:25, family:'ground_grass'\n"
        "  });\n"
    )
    if marker not in text:
        raise RuntimeError('tile registry transition marker missing')
    text = text.replace(marker, block + marker, 1)
    text = re.sub(r"version:'1\.\d+\.\d+'", "version:'1.13.0'", text, count=1)

    style_line = "    surfaceGround:Object.freeze({mode:'rebuild-hd-grass-v1',asset:'cesped',baseFrames:Object.freeze([1,7,12,21]),detailFrames:Object.freeze([0,2,6,10,16,19,24]),detailModulo:11}),\n"
    if "surfaceGround:Object.freeze" not in text:
        style_marker = "    districtGround:Object.freeze({mode:'district-profile-v1'"
        if style_marker not in text:
            raise RuntimeError('districtGround style marker missing')
        text = text.replace(style_marker, style_line + style_marker, 1)

    if 'cesped:cespedAtlas' not in text:
        atlas_marker = 'atlases:Object.freeze({plaza:atlas,'
        if atlas_marker not in text:
            raise RuntimeError('registry atlases export marker missing')
        text = text.replace(atlas_marker, 'atlases:Object.freeze({cesped:cespedAtlas,plaza:atlas,', 1)
    write_text(path, text)


def patch_atlas_contract():
    path = ROOT / 'src/environment/atlas-contract.js'
    text = path.read_text(encoding='utf-8')
    if "cesped:'core'" not in text:
        marker = "plaza:'core',plazaGround:'core',transitions:'core',grassVariation:'core',marbleVariation:'core',plazaNature:'core',"
        if marker not in text:
            raise RuntimeError('atlas role marker missing')
        text = text.replace(marker, "cesped:'core'," + marker, 1)
    write_text(path, text)


def surface_ground_source():
    return r"""(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY,L=window.KELO_ENVIRONMENT_LAYERS,A=window.KELO_ATLAS_CONTRACT;
if(!R||!L?.register||!A?.acquire){console.error('[Kelo surface ground] registry/layers/atlas contract missing');return;}
const style=R.styles?.surfaceGround, atlas=style&&R.atlases?.[style.asset];
if(!style||!atlas){console.error('[Kelo surface ground] surfaceGround metadata missing');return;}
const TILE=R.worldTileSize||32,CHUNK=512,COLS=atlas.columns||5,BASE=style.baseFrames||[1],DETAIL=style.detailFrames||[],MOD=Math.max(2,Number(style.detailModulo)||11),cache=new Map(),MAX=16;
let img=null,ready=false,failed=false,drawnTiles=0;
function hash(x,y,s=0){return Math.abs(((x+17+s)*73856093)^((y+29+s)*19349663))}
function frameFor(X,Y){const detail=DETAIL.length&&hash(X,Y,71)%MOD===0;const pool=detail?DETAIL:BASE;return pool[hash(X,Y,detail?191:23)%pool.length]}
function drawFrame(g,id,dx,dy){const sx=(id%COLS)*atlas.tileWidth,sy=Math.floor(id/COLS)*atlas.tileHeight;g.drawImage(img,sx,sy,atlas.tileWidth,atlas.tileHeight,dx,dy,TILE,TILE);drawnTiles++;}
function build(cx,cy){const key=cx+','+cy;if(cache.has(key))return cache.get(key);const c=document.createElement('canvas');c.width=CHUNK;c.height=CHUNK;const g=c.getContext('2d');g.imageSmoothingEnabled=false;const wx=cx*CHUNK,wy=cy*CHUNK,n=Math.ceil(CHUNK/TILE);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const X=Math.floor((wx+x*TILE)/TILE),Y=Math.floor((wy+y*TILE)/TILE);drawFrame(g,frameFor(X,Y),x*TILE,y*TILE)}cache.set(key,c);if(cache.size>MAX)cache.delete(cache.keys().next().value);return c}
function visibleBounds(){const z=window.CONFIG?.zoom||1,cam=window.camera||{x:1440,y:1520},sw=window.screenW||innerWidth,sh=window.screenH||innerHeight,ww=window.CONFIG?.worldWidth||3600,wh=window.CONFIG?.worldHeight||3200,hw=sw/(2*z)+CHUNK,hh=sh/(2*z)+CHUNK;return{minX:Math.max(0,Math.floor((cam.x-hw)/CHUNK)),maxX:Math.min(Math.ceil(ww/CHUNK)-1,Math.floor((cam.x+hw)/CHUNK)),minY:Math.max(0,Math.floor((cam.y-hh)/CHUNK)),maxY:Math.min(Math.ceil(wh/CHUNK)-1,Math.floor((cam.y+hh)/CHUNK))}}
function draw(g){if(!ready||failed||!img)return;const b=visibleBounds();for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)g.drawImage(build(x,y),x*CHUNK,y*CHUNK);audit.chunkCacheSize=cache.size;audit.lastDrawnTiles=drawnTiles;drawnTiles=0;}
const audit=window.KELO_SURFACE_GROUND_AUDIT={version:'surface-ground-v1.0.0',mode:style.mode,ready:false,failed:false,asset:style.asset,src:atlas.src,tileCount:atlas.tileCount,baseFrameCount:BASE.length,detailFrameCount:DETAIL.length,detailModulo:MOD,worldTileSize:TILE,chunkSize:CHUNK,chunkCacheCap:MAX,chunkCacheSize:0,lastDrawnTiles:0,worldWidth:window.CONFIG?.worldWidth||3600,worldHeight:window.CONFIG?.worldHeight||3200,visibleDuringReset:true};
try{L.register({id:'kelo-surface-ground',phase:'ground',priority:0,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw,ownership:'surface-ground-v1',bounds:()=>[{id:'world-surface',x:0,y:0,w:audit.worldWidth,h:audit.worldHeight}]});}catch(err){failed=true;audit.failed=true;console.error('[Kelo surface ground] layer registration failed',err);return;}
if(!A.describe(style.asset)){failed=true;audit.failed=true;console.error('[Kelo surface ground] atlas not registered',style.asset);return;}
A.acquire(style.asset).then(image=>{img=image;ready=true;audit.ready=true;try{window.dispatchEvent(new CustomEvent('kelo:surface-ground-ready'))}catch{}}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo surface ground] atlas load failed',err)});
})();
"""


def patch_surface_ground():
    write_text(ROOT / 'src/environment/surface-ground.js', surface_ground_source())


def patch_manifest():
    path = ROOT / 'src/environment/art-asset-manifest.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    assets = [a for a in data.get('assets', []) if a.get('id') != 'cesped-ground-v1' and a.get('path') != 'assets/cesped-runtime.PNG']
    assets.append({
        'id':'cesped-ground-v1','family':'ground_grass','version':'1.0.0','path':'assets/cesped-runtime.PNG','kind':'ground-atlas',
        'width':160,'height':160,'requireAlpha':False,'sampling':'nearest','padding':0,'spacing':0,
        'frames':{'mode':'grid','count':25},'cellWidth':32,'cellHeight':32,'columns':5,'rows':5,
        'anchor':{'mode':'tile-origin'},'visualBounds':{'mode':'cell'},'footprint':{'mode':'none'},'collider':{'mode':'none'},
        'ownership':'surface-ground-v1','layers':['ground'],'priority':0,'occlusion':{'mode':'none'},'districtCompatibility':['*'],
        'cache':{'strategy':'query','key':'art','value':ART},'fallback':{'mode':'none'}
    })
    data['assets'] = assets
    write_text(path, json.dumps(data, separators=(',',':')) + '\n')


def patch_png_policy():
    path = ROOT / 'src/environment/png-validation-policy.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    items = [x for x in data.get('excludedFromWorldContract', []) if x.get('path') != 'assets/cesped.PNG']
    items.append({'path':'assets/cesped.PNG','scope':'source-sheet','reason':'Original Kelo-uploaded HD grass sheet retained as visual source-of-truth; LIVE renders the deterministic mobile runtime atlas cesped-runtime.png.'})
    data['excludedFromWorldContract'] = items
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def patch_index():
    path = ROOT / 'index.html'
    text = path.read_text(encoding='utf-8')
    if 'assets/cesped-runtime.PNG?art=501' not in text:
        marker = '<link rel="preload" as="image" href="assets/fuentekelo-runtime.PNG?art=401" fetchpriority="high">'
        if marker not in text:
            raise RuntimeError('fountain preload marker missing')
        text = text.replace(marker, marker + '\n  <link rel="preload" as="image" href="assets/cesped-runtime.PNG?art=501" fetchpriority="high">', 1)
    if 'src/environment/surface-ground.js' not in text:
        marker = '<script src="src/environment/environment-layer-stack.js?v=4"></script>'
        if marker not in text:
            raise RuntimeError('environment layer stack script marker missing')
        text = text.replace(marker, marker + '<script src="src/environment/surface-ground.js?v=1"></script>', 1)
    text = text.replace('src/environment/tile-registry.js?v=236', 'src/environment/tile-registry.js?v=237')
    write_text(path, text)


def main():
    build_runtime()
    patch_registry()
    patch_atlas_contract()
    patch_surface_ground()
    patch_manifest()
    patch_png_policy()
    patch_index()
    print('CESPED_INTEGRATION_OK')

if __name__ == '__main__':
    main()
