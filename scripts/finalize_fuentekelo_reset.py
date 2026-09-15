from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def rw(path, transform):
    p = ROOT / path
    old = p.read_text(encoding='utf-8')
    new = transform(old)
    if new != old:
        p.write_text(new, encoding='utf-8')


def patch_index(text):
    # The user intentionally reset the world art. Do not preload deleted legacy art.
    for needle in [
        '  <link rel="preload" as="image" href="assets/bot-crimson-v1.png?v=1">\n',
        '  <link rel="preload" as="image" href="assets/plaza-ground-v1.png?art=193" fetchpriority="high">\n',
        '  <link rel="preload" as="image" href="assets/tileset-vclean.png?art=131">\n',
        '  <link rel="preload" as="image" href="assets/kelo-luxe-boutique.png?v=6">\n',
    ]:
        text = text.replace(needle, '')

    marker = '<script src="src/environment/rural-nature-atlas.js?v=200"></script>'
    reset = '<script>window.KELO_WORLD_DECORATION_RESET=true;</script>'
    if reset not in text:
        if marker not in text:
            raise RuntimeError('environment bootstrap marker missing in index.html')
        text = text.replace(marker, reset + marker, 1)

    # Keep the reusable files in the repository, but do not execute old visual consumers
    # while the user rebuilds the city from zero.
    disabled = [
        r'<script src="src/environment/generic-prefabs\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/gardens-junction-overlay\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/district-decals\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/rural-ground\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/rural-landmarks\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/plaza-nature\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/luxe-compose\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/luxe-kiosk-atlas\.js\?v=[^"]+"></script>',
        r'<script src="src/environment/gardens-landmark\.js\?v=[^"]+"></script>',
    ]
    for pattern in disabled:
        text = re.sub(pattern, '', text)
    return text


def patch_world(text):
    old = 'window.KELO_WORLD_RENDERER=Object.freeze({draw,districts:DISTRICTS,chunkSize:CHUNK,get ready(){return ready}});acquireManagedAtlases();'
    new = "window.KELO_WORLD_RENDERER=Object.freeze({draw,districts:DISTRICTS,chunkSize:CHUNK,get ready(){return window.KELO_WORLD_DECORATION_RESET===true?true:ready}});if(window.KELO_WORLD_DECORATION_RESET===true){ready=true;window.KELO_WORLD_AUDIT.ready=true;window.KELO_WORLD_AUDIT.assetLoaded=false;window.KELO_WORLD_AUDIT.terrainAtlasesReady=false;window.KELO_WORLD_AUDIT.resetBootstrap=true;}else acquireManagedAtlases();"
    if old in text:
        text = text.replace(old, new, 1)
    elif 'resetBootstrap=true' not in text:
        raise RuntimeError('world-map bootstrap marker missing')
    return text


def patch_prop(text):
    if "const RESET=window.KELO_WORLD_DECORATION_RESET===true;" not in text:
        text = text.replace("  const R=window.KELO_TILE_REGISTRY;\n", "  const R=window.KELO_TILE_REGISTRY;\n  const RESET=window.KELO_WORLD_DECORATION_RESET===true;\n", 1)
    text = text.replace('  if(plazaNatureAtlas&&Array.isArray(R.plazaNatureProps)){', '  if(!RESET&&plazaNatureAtlas&&Array.isArray(R.plazaNatureProps)){')
    text = text.replace("plazaNature:Object.freeze({id:'plazaNature',src:plazaNatureAtlas?.src", "plazaNature:Object.freeze({id:'plazaNature',src:RESET?null:plazaNatureAtlas?.src")
    text = text.replace("ruralProps:Object.freeze({id:'ruralProps',src:ruralPropsAtlas?.src", "ruralProps:Object.freeze({id:'ruralProps',src:RESET?null:ruralPropsAtlas?.src")
    return text


def prune_manifest(text):
    data = json.loads(text)
    kept = []
    for asset in data.get('assets', []):
        path = asset.get('path')
        if path == 'assets/fuentekelo-runtime.PNG':
            kept.append(asset)
            continue
        if path and (ROOT / path).exists():
            kept.append(asset)
    data['assets'] = kept
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'


rw('index.html', patch_index)
rw('src/environment/world-map.js', patch_world)
rw('src/environment/prop-contract.js', patch_prop)
rw('src/environment/art-asset-manifest.json', prune_manifest)
print('PASS reset bootstrap: only fuentekelo is active environment art')
