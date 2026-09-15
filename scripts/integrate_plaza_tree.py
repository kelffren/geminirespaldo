from pathlib import Path
import json

registry_path = Path('src/environment/tile-registry.js')
manifest_path = Path('src/environment/art-asset-manifest.json')
asset_path = Path('assets/plaza-tree-large-v1.png')

assert asset_path.exists(), 'extracted tree PNG missing'

registry = registry_path.read_text(encoding='utf-8')
old_atlas = """  const plazaNatureAtlas = Object.freeze({\n    id:'plaza-nature', src:'assets/plaza-nature-v2.png?art=302', width:192, height:96,\n    spriteWidth:96, spriteHeight:96, columns:2, spriteCount:2\n  });"""
new_atlas = """  const plazaNatureAtlas = Object.freeze({\n    id:'plaza-nature', src:'assets/plaza-tree-large-v1.png?art=303', width:367, height:489,\n    spriteWidth:367, spriteHeight:489, columns:1, spriteCount:1\n  });"""
assert old_atlas in registry, 'expected Plaza nature atlas block not found'
registry = registry.replace(old_atlas, new_atlas, 1)

old_props = """  const plazaNatureProps = Object.freeze([\n    Object.freeze({id:'plaza-tree-nw',sprite:0,x:1120,y:1302,w:96,h:96,baseY:1388}),\n    Object.freeze({id:'plaza-tree-ne',sprite:1,x:1664,y:1302,w:96,h:96,baseY:1388}),\n    Object.freeze({id:'plaza-tree-sw',sprite:1,x:1120,y:1654,w:96,h:96,baseY:1740}),\n    Object.freeze({id:'plaza-tree-se',sprite:0,x:1664,y:1654,w:96,h:96,baseY:1740})\n  ]);"""
new_props = """  const plazaNatureProps = Object.freeze([\n    Object.freeze({id:'plaza-tree-nw',sprite:0,x:1096,y:1196,w:144,h:192,baseY:1388}),\n    Object.freeze({id:'plaza-tree-ne',sprite:0,x:1640,y:1196,w:144,h:192,baseY:1388}),\n    Object.freeze({id:'plaza-tree-sw',sprite:0,x:1096,y:1548,w:144,h:192,baseY:1740}),\n    Object.freeze({id:'plaza-tree-se',sprite:0,x:1640,y:1548,w:144,h:192,baseY:1740})\n  ]);"""
assert old_props in registry, 'expected Plaza nature props block not found'
registry = registry.replace(old_props, new_props, 1)
registry = registry.replace("version:'1.10.29'", "version:'1.10.30'", 1)
registry_path.write_text(registry, encoding='utf-8')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assets = manifest['assets']
old = next((a for a in assets if a.get('id') == 'plaza-nature-v2'), None)
assert old, 'plaza-nature-v2 manifest entry missing'
new = dict(old)
new.update({
    'id': 'plaza-tree-large-v1',
    'family': 'plaza-nature',
    'version': '1.0.0',
    'path': 'assets/plaza-tree-large-v1.png',
    'kind': 'prop-sprite',
    'width': 367,
    'height': 489,
    'frames': {'mode':'single','count':1},
    'cache': {'strategy':'query','key':'art','value':'303'}
})
assets[assets.index(old)] = new
manifest_path.write_text(json.dumps(manifest, separators=(',',':')) + '\n', encoding='utf-8')

print('PASS integrated authored Plaza tree metadata')
