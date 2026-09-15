from __future__ import annotations

import json
from pathlib import Path

ROOT = Path('.')
# One-shot idempotent migration used by CI to wire generated irregular atlas metadata
# into the existing generic renderer without asset-specific draw branches.


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'INTEGRATE_FAIL missing {label}')
    return text.replace(old, new, 1)


index_path = ROOT / 'index.html'
index = index_path.read_text(encoding='utf-8')
old = '<script src="src/environment/terrain-contract.js?v=1"></script><script src="src/environment/tile-registry.js?v=235"></script>'
new = '<script src="src/environment/terrain-contract.js?v=1"></script><script src="src/environment/generated/arboleskelo1-atlas.js?v=1"></script><script src="src/environment/tile-registry.js?v=236"></script>'
index = replace_once(index, old, new, 'generated atlas metadata script ordering')
index_path.write_text(index, encoding='utf-8')

reg_path = ROOT / 'src/environment/tile-registry.js'
reg = reg_path.read_text(encoding='utf-8')
old = """  const plazaNatureAtlas = Object.freeze({
    id:'plaza-nature', src:'assets/plaza-tree-large-v1.png?art=304', width:430, height:530,
    spriteWidth:430, spriteHeight:530, columns:1, spriteCount:1
  });"""
new = """  const plazaNatureMeta = window.KELO_ARBOL_1_ATLAS_META;
  if (!plazaNatureMeta?.frames?.tree_large) {
    console.error('[Kelo registry] Arboleskelo1 irregular atlas metadata missing');
    return;
  }
  const plazaNatureAtlas = Object.freeze({
    id:'plaza-nature', src:'assets/Arboleskelo1.atlas.png?art=305',
    width:plazaNatureMeta.width, height:plazaNatureMeta.height,
    frameMode:'irregular', frames:plazaNatureMeta.frames,
    spriteCount:Object.keys(plazaNatureMeta.frames).length
  });"""
reg = replace_once(reg, old, new, 'plazaNature irregular atlas declaration')
start = reg.index('  const plazaNatureProps = Object.freeze([')
end = reg.index('  ]);', start) + len('  ]);')
block = reg[start:end].replace('sprite:0', "frame:'tree_large'")
reg = reg[:start] + block + reg[end:]
reg = reg.replace("version:'1.10.32'", "version:'1.11.0'", 1)
reg_path.write_text(reg, encoding='utf-8')

prop_path = ROOT / 'src/environment/prop-contract.js'
prop = prop_path.read_text(encoding='utf-8')
prop = replace_once(prop, "frame:p.sprite||0", "frame:(p.frame??p.sprite??0)", 'prop frame selection')
old = "plazaNature:Object.freeze({id:'plazaNature',src:plazaNatureAtlas?.src,width:plazaNatureAtlas?.width,height:plazaNatureAtlas?.height,frameWidth:plazaNatureAtlas?.spriteWidth,frameHeight:plazaNatureAtlas?.spriteHeight,columns:plazaNatureAtlas?.columns})"
new = "plazaNature:Object.freeze({id:'plazaNature',src:plazaNatureAtlas?.src,width:plazaNatureAtlas?.width,height:plazaNatureAtlas?.height,frameMode:plazaNatureAtlas?.frameMode,frames:plazaNatureAtlas?.frames,frameWidth:plazaNatureAtlas?.spriteWidth,frameHeight:plazaNatureAtlas?.spriteHeight,columns:plazaNatureAtlas?.columns})"
prop = replace_once(prop, old, new, 'prop irregular frame metadata')
prop = prop.replace("version:'1.4.0'", "version:'1.5.0'", 1).replace("mode:'generic-prop-contract-v4'", "mode:'generic-prop-contract-v5'", 1)
prop_path.write_text(prop, encoding='utf-8')

gp_path = ROOT / 'src/environment/generic-props.js'
gp = gp_path.read_text(encoding='utf-8')
old = "function frameOrigin(a,f){const cols=a.columns||1;return{x:(f%cols)*a.frameWidth,y:Math.floor(f/cols)*a.frameHeight};}\n  function drawProp(g,p){const a=C.assets[p.asset],img=images.get(p.asset);if(!a||!img||!readyAssets.has(p.asset))return false;const s=frameOrigin(a,p.frame||0);g.drawImage(img,s.x,s.y,a.frameWidth,a.frameHeight,p.position.x,p.position.y,p.size.w,p.size.h);return true;}"
new = "function frameRect(a,f){if(a?.frames&&typeof f==='string'&&a.frames[f]){const r=a.frames[f];return{x:Number(r.x)||0,y:Number(r.y)||0,w:Number(r.w)||0,h:Number(r.h)||0};}const i=Number(f)||0,cols=a.columns||1;return{x:(i%cols)*a.frameWidth,y:Math.floor(i/cols)*a.frameHeight,w:a.frameWidth,h:a.frameHeight};}\n  function drawProp(g,p){const a=C.assets[p.asset],img=images.get(p.asset);if(!a||!img||!readyAssets.has(p.asset))return false;const s=frameRect(a,p.frame??0);if(!(s.w>0&&s.h>0))return false;g.drawImage(img,s.x,s.y,s.w,s.h,p.position.x,p.position.y,p.size.w,p.size.h);return true;}"
gp = replace_once(gp, old, new, 'generic irregular frame renderer')
gp = gp.replace("version:'generic-props-v1.5'", "version:'generic-props-v1.6'", 2).replace("rendererMode:'data-driven-props-v4'", "rendererMode:'data-driven-props-v5-irregular-frames'", 1)
gp_path.write_text(gp, encoding='utf-8')

validator_path = ROOT / 'scripts/validate-art-assets.mjs'
validator = validator_path.read_text(encoding='utf-8')
validator = replace_once(validator, "const frameModes = new Set(['grid','single']);", "const frameModes = new Set(['grid','single','irregular']);", 'irregular frame mode allowance')
validator = replace_once(validator, "fail(`${asset.id} frames must declare mode=grid|single and positive integer count`);", "fail(`${asset.id} frames must declare mode=grid|single|irregular and positive integer count`);", 'frame mode validation message')
needle = "  if (asset.frames?.mode === 'grid' && !hasGrid) fail(`${asset.id} frames.mode=grid requires grid metadata`);\n  if (asset.frames?.mode === 'single' && hasGrid) fail(`${asset.id} frames.mode=single must not declare grid metadata`);"
insert = "  if (asset.frames?.mode === 'grid' && !hasGrid) fail(`${asset.id} frames.mode=grid requires grid metadata`);\n  if (asset.frames?.mode === 'single' && hasGrid) fail(`${asset.id} frames.mode=single must not declare grid metadata`);\n  if (asset.frames?.mode === 'irregular') {\n    if (hasGrid) fail(`${asset.id} frames.mode=irregular must not declare grid metadata`);\n    if (!isNonEmptyString(asset.frames.metadata)) {\n      fail(`${asset.id} irregular frames require frames.metadata`);\n    } else {\n      const metadataPath = path.join(root, asset.frames.metadata);\n      if (!fs.existsSync(metadataPath)) fail(`${asset.id} missing irregular metadata ${asset.frames.metadata}`);\n      else {\n        try {\n          const atlasMeta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));\n          const entries = Object.entries(atlasMeta.frames || {});\n          if (atlasMeta.width !== width || atlasMeta.height !== height) fail(`${asset.id} irregular metadata dimensions do not match PNG`);\n          if (entries.length !== asset.frames.count) fail(`${asset.id} irregular frame count ${entries.length} != declared ${asset.frames.count}`);\n          for (const [frameId, r] of entries) {\n            if (![r.x,r.y,r.w,r.h].every(Number.isInteger) || r.w <= 0 || r.h <= 0 || r.x < 0 || r.y < 0 || r.x+r.w > width || r.y+r.h > height) fail(`${asset.id} invalid irregular frame ${frameId}`);\n          }\n        } catch (err) { fail(`${asset.id} invalid irregular metadata: ${err.message}`); }\n      }\n    }\n  }"
validator = replace_once(validator, needle, insert, 'irregular metadata validation')
validator_path.write_text(validator, encoding='utf-8')

manifest_path = ROOT / 'src/environment/art-asset-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
# Idempotency: remove both the legacy one-off tree and any prior generated-atlas entry.
manifest['assets'] = [a for a in manifest['assets'] if a.get('id') not in {'plaza-tree-large-v1','arboleskelo1-atlas-v1'} and a.get('path') != 'assets/Arboleskelo1.atlas.png']
meta = json.loads((ROOT / 'assets/Arboleskelo1.atlas.json').read_text(encoding='utf-8'))
asset = {
    'id':'arboleskelo1-atlas-v1','family':'plaza-nature','version':'1.0.0','path':'assets/Arboleskelo1.atlas.png','kind':'prop-atlas-irregular',
    'width':meta['width'],'height':meta['height'],'requireAlpha':True,'sampling':'nearest','padding':0,'spacing':0,
    'frames':{'mode':'irregular','count':len(meta['frames']),'metadata':'assets/Arboleskelo1.atlas.json'},
    'anchor':{'mode':'registry-frame'},'visualBounds':{'mode':'registry-frame'},'footprint':{'mode':'registry-instance'},'collider':{'mode':'registry-instance'},
    'ownership':'tile-registry','layers':['props_back','props_front'],'priority':10,'occlusion':{'mode':'registry-instance'},'districtCompatibility':['central'],
    'cache':{'strategy':'query','key':'art','value':'305'},'fallback':{'mode':'none'}
}
insert_at = next((i+1 for i,a in enumerate(manifest['assets']) if a.get('id')=='plaza-ground-v1'), len(manifest['assets']))
manifest['assets'].insert(insert_at, asset)
manifest_path.write_text(json.dumps(manifest,separators=(',',':'))+'\n',encoding='utf-8')

print('INTEGRATE_OK irregular atlas metadata -> generic prop renderer')
