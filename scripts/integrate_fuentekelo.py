from __future__ import annotations

from pathlib import Path
import json
import re

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
SRC = ASSETS / 'fuentekelo.PNG'
RUNTIME = ASSETS / 'fuentekelo-runtime.png'

EXPECTED_SIZE = (1312, 1199)
WORLD_CENTER = (1440, 1520)
DRAW_W = 720
DRAW_H = 658
DRAW_X = WORLD_CENTER[0] - DRAW_W // 2
DRAW_Y = WORLD_CENTER[1] - DRAW_H
BASE_Y = 1505


def write_text(path: Path, text: str) -> None:
    old = path.read_text(encoding='utf-8') if path.exists() else None
    if old != text:
        path.write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise RuntimeError(f'{label}: expected source fragment not found')


def clean_checkerboard_source() -> None:
    if not SRC.exists():
        raise RuntimeError('assets/fuentekelo.PNG is missing')
    image = Image.open(SRC).convert('RGB')
    if image.size != EXPECTED_SIZE:
        raise RuntimeError(f'fuentekelo.PNG dimensions {image.size} != {EXPECTED_SIZE}')

    rgb = np.asarray(image, dtype=np.uint8)
    work = rgb.astype(np.int16)
    spread = work.max(axis=2) - work.min(axis=2)
    mean = work.mean(axis=2)
    eligible = ((spread < 18) & (mean > 175)).reshape(-1)
    h, w = rgb.shape[:2]
    total = h * w
    seen = np.zeros(total, dtype=np.uint8)
    queue = np.empty(total, dtype=np.int32)
    tail = 0

    def push(idx: int) -> None:
        nonlocal tail
        if eligible[idx] and not seen[idx]:
            seen[idx] = 1
            queue[tail] = idx
            tail += 1

    for x in range(w):
        push(x)
        push((h - 1) * w + x)
    for y in range(h):
        push(y * w)
        push(y * w + (w - 1))

    head = 0
    while head < tail:
        idx = int(queue[head])
        head += 1
        y, x = divmod(idx, w)
        if x > 0:
            push(idx - 1)
        if x + 1 < w:
            push(idx + 1)
        if y > 0:
            push(idx - w)
        if y + 1 < h:
            push(idx + w)

    bg = seen.reshape(h, w).astype(bool)
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # One-pixel soft fringe only around the removed background. This preserves
    # the authored stone/gold details while avoiding a hard checkerboard halo.
    adjacent_bg = np.zeros_like(bg)
    adjacent_bg[:-1, :] |= bg[1:, :]
    adjacent_bg[1:, :] |= bg[:-1, :]
    adjacent_bg[:, :-1] |= bg[:, 1:]
    adjacent_bg[:, 1:] |= bg[:, :-1]
    edge = (~bg) & adjacent_bg
    neutral = np.clip((spread.astype(np.float32) - 2.0) / 18.0, 0.0, 1.0)
    dark = np.clip((230.0 - mean.astype(np.float32)) / 80.0, 0.0, 1.0)
    confidence = np.maximum(neutral, dark)
    alpha[edge] = (80.0 + 175.0 * confidence[edge]).astype(np.uint8)

    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba, 'RGBA').save(RUNTIME, optimize=True)

    check = Image.open(RUNTIME)
    if check.mode != 'RGBA' or check.size != EXPECTED_SIZE or check.getchannel('A').getextrema() != (0, 255):
        raise RuntimeError('runtime fountain transparency validation failed')


def patch_prop_contract() -> None:
    path = ROOT / 'src/environment/prop-contract.js'
    text = path.read_text(encoding='utf-8')
    text = text.replace("version:'1.5.0',mode:'generic-prop-contract-v5'", "version:'1.6.0',mode:'generic-prop-contract-v6-reset-centerpiece'")
    text = replace_required(
        text,
        "    plazaFountain:Object.freeze({id:'plaza-fountain',ownership:'plaza-fountain-v1',priority:10,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),",
        "    plazaFountain:Object.freeze({id:'plaza-fountain',ownership:'plaza-fountain-kelo-v1',priority:20,renderMode:'layer-stack',visibleDuringReset:true,front:Object.freeze({phase:'props_front'})}),",
        'plaza fountain layer group',
    )

    lines = text.splitlines()
    filtered = []
    inserted_asset = False
    inserted_prop = False
    for line in lines:
        if "plazaFountainBack:Object.freeze" in line or "plazaFountainFront:Object.freeze" in line:
            continue
        if "defs.push(Object.freeze({id:'plaza-fountain-central-back'" in line or "defs.push(Object.freeze({id:'plaza-fountain-central-front'" in line:
            continue
        filtered.append(line)
        if "ruralProps:Object.freeze" in line and not inserted_asset:
            filtered.append("    plazaFountainKelo:Object.freeze({id:'plazaFountainKelo',src:'assets/fuentekelo-runtime.PNG?art=401',width:1312,height:1199,frameWidth:1312,frameHeight:1199,columns:1}),")
            inserted_asset = True
        if line.strip() == '});' and 'const assets=Object.freeze({' in '\n'.join(filtered[-8:]) and not inserted_prop:
            pass

    text = '\n'.join(filtered) + '\n'
    marker = "  function ruralTile(frame,x,y,id,family){"
    new_prop = (
        "  defs.push(Object.freeze({id:'plaza-fountain-kelo',family:'landmark_prop',asset:'plazaFountainKelo',frame:0,"
        "layerGroup:'plazaFountain',layerRole:'front',position:Object.freeze({x:1080,y:862}),"
        "size:Object.freeze({w:720,h:658}),anchor:Object.freeze({x:0.5,y:1}),"
        "visualBounds:Object.freeze({x:1080,y:862,w:720,h:658}),"
        "footprint:Object.freeze({x:1190,y:1430,w:500,h:90}),collider:Object.freeze({mode:'none'}),"
        "layers:Object.freeze({back:null,front:'props_front'}),priority:20,district:'central',"
        "occlusion:Object.freeze({mode:'actor-base-y-redraw-v1',baseY:1505,bounds:Object.freeze({x:1080,y:862,w:720,h:658})}),visualOnly:false}));\n"
    )
    if "id:'plaza-fountain-kelo'" not in text:
        if marker not in text:
            raise RuntimeError('prop contract insertion marker missing')
        text = text.replace(marker, new_prop + marker, 1)
    if not inserted_asset and "plazaFountainKelo:Object.freeze" not in text:
        raise RuntimeError('failed to register fuentekelo asset in prop contract')
    write_text(path, text)


def patch_environment_layer_stack() -> None:
    path = ROOT / 'src/environment/environment-layer-stack.js'
    text = path.read_text(encoding='utf-8')
    text = text.replace("environment-layer-stack-v2.4", "environment-layer-stack-v2.5")
    text = text.replace("blank-world-decoration-reset-v1", "blank-world-reset-visible-landmarks-v2")
    text = replace_required(
        text,
        "const layer=Object.freeze({id:String(spec.id),phase:spec.phase,priority:Number(spec.priority)||0,required:spec.required!==false,draw:spec.draw,ready:typeof spec.ready==='function'?spec.ready:()=>true,bounds:spec.bounds||null,ownership:String(spec.ownership||'unspecified')});",
        "const layer=Object.freeze({id:String(spec.id),phase:spec.phase,priority:Number(spec.priority)||0,required:spec.required!==false,visibleDuringReset:spec.visibleDuringReset===true,draw:spec.draw,ready:typeof spec.ready==='function'?spec.ready:()=>true,bounds:spec.bounds||null,ownership:String(spec.ownership||'unspecified')});",
        'layer reset visibility metadata',
    )
    text = replace_required(
        text,
        "function drawTiming(g,timing){\n  if(DECORATION_RESET)return;\n  for(const layer of layers){if(timingForPhase(layer.phase)!==timing)continue;if(layer.ready())layer.draw(g);}\n}",
        "function drawTiming(g,timing){\n  for(const layer of layers){if(timingForPhase(layer.phase)!==timing)continue;if(DECORATION_RESET&&!layer.visibleDuringReset)continue;if(layer.ready())layer.draw(g);}\n}",
        'reset layer drawing',
    )
    text = replace_required(
        text,
        "  if(DECORATION_RESET){drawBlankWorld(g);syncAudit();return true;}",
        "  if(DECORATION_RESET){drawBlankWorld(g);drawTiming(g,'base');syncAudit();return true;}",
        'blank world base draw',
    )
    text = replace_required(
        text,
        "ownership:l.ownership,boundsCount:normalizeBounds(l.bounds).length",
        "ownership:l.ownership,visibleDuringReset:l.visibleDuringReset,boundsCount:normalizeBounds(l.bounds).length",
        'layer audit reset flag',
    )
    write_text(path, text)


def patch_generic_props() -> None:
    path = ROOT / 'src/environment/generic-props.js'
    text = path.read_text(encoding='utf-8')
    text = text.replace("version:'generic-props-v1.6'", "version:'generic-props-v1.7'")
    text = text.replace("rendererMode:'data-driven-props-v5-irregular-frames'", "rendererMode:'data-driven-props-v6-reset-visible'")
    text = replace_required(
        text,
        "function drawInstances(g,props,track){if(failed||!g||!Array.isArray(props)||window.KELO_WORLD_DECORATION_RESET===true)return 0;let count=0;g.save();g.imageSmoothingEnabled=false;for(const p of props)if(p&&drawProp(g,p))count++;g.restore();if(track){audit.immediateDrawCalls++;audit.immediatePropCount=count;}return count;}",
        "function drawInstances(g,props,track,allowDuringReset=false){if(failed||!g||!Array.isArray(props)||(window.KELO_WORLD_DECORATION_RESET===true&&!allowDuringReset))return 0;let count=0;g.save();g.imageSmoothingEnabled=false;for(const p of props)if(p&&drawProp(g,p))count++;g.restore();if(track){audit.immediateDrawCalls++;audit.immediatePropCount=count;}return count;}",
        'generic drawInstances reset support',
    )
    text = replace_required(
        text,
        "function drawBack(groupKey,g){if(failed||window.KELO_WORLD_DECORATION_RESET===true)return;backDrawCountByGroup[groupKey]=drawInstances(g,propsForRole(groupKey,'back'),false);}",
        "function drawBack(groupKey,g){const allowReset=C.layerGroups?.[groupKey]?.visibleDuringReset===true;if(failed||(window.KELO_WORLD_DECORATION_RESET===true&&!allowReset))return;backDrawCountByGroup[groupKey]=drawInstances(g,propsForRole(groupKey,'back'),false,allowReset);}",
        'generic back reset support',
    )
    text = replace_required(
        text,
        "  function drawFront(groupKey,g){\n    if(failed||window.KELO_WORLD_DECORATION_RESET===true)return;",
        "  function drawFront(groupKey,g){\n    const allowReset=C.layerGroups?.[groupKey]?.visibleDuringReset===true;\n    if(failed||(window.KELO_WORLD_DECORATION_RESET===true&&!allowReset))return;",
        'generic front reset support',
    )
    text = replace_required(
        text,
        "  function boundsFor(groupKey,role){return()=>window.KELO_WORLD_DECORATION_RESET===true?[]:propsForRole(groupKey,role).map(p=>({id:p.id,...p.visualBounds}));}",
        "  function boundsFor(groupKey,role){return()=>window.KELO_WORLD_DECORATION_RESET===true&&C.layerGroups?.[groupKey]?.visibleDuringReset!==true?[]:propsForRole(groupKey,role).map(p=>({id:p.id,...p.visualBounds}));}",
        'generic reset bounds',
    )
    text = text.replace("ownership:group.ownership,bounds:boundsFor", "ownership:group.ownership,visibleDuringReset:group.visibleDuringReset===true,bounds:boundsFor")
    write_text(path, text)


def patch_fountain_audit_bridge() -> None:
    path = ROOT / 'src/environment/plaza-depth.js'
    text = """(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const G=window.KELO_GENERIC_PROPS;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const fountain=C?.props?.find(p=>p.id==='plaza-fountain-kelo');
  if(!C||!G||!L||!fountain){console.error('[Kelo fountain audit bridge] fuentekelo generic prop unavailable');return;}
  const baseY=fountain.occlusion?.baseY||1505;
  const asset=C.assets?.plazaFountainKelo;
  const audit={
    version:'plaza-fountain-v3.0',failed:false,
    depthMode:'single-front-layer-with-actor-redraw-v1',renderWrapped:false,environmentLayerStack:true,
    postActorBridgeRestored:false,postActorBridgeAvailable:true,bridgePolicy:'generic-prop-contract-v1',
    frontLayer:'props_front',frontLayerId:'plaza-fountain-front',spatialOwnership:'plaza-fountain-kelo-v1',
    assetMode:'single-authored-png-v1',alignmentMode:'bottom-centered-on-plaza-v1',
    x:fountain.position.x,y:fountain.position.y,width:fountain.size.w,height:fountain.size.h,visualHeight:fountain.size.h,baseY,
    sourceWidth:asset?.width||0,sourceHeight:asset?.height||0,asset:asset?.src||'',collision:{...fountain.collider},
    decorationResetVisible:true,
    get ready(){return !!G.ready&&G.isAssetReady('plazaFountainKelo');},
    get loaded(){return G.isAssetReady('plazaFountainKelo');},
    get lastLocalDepth(){return (typeof localPlayer!=='undefined'&&localPlayer)?((localPlayer.y||0)>baseY?'in-front-of-front-layer':'behind-front-layer'):null;},
    get lastFrontActorRedraws(){return Number(window.KELO_GENERIC_PROP_AUDIT?.actorRedrawCountByGroup?.plazaFountain||0);},
    get frontDrawCount(){return Number(window.KELO_GENERIC_PROP_AUDIT?.frontDrawCountByGroup?.plazaFountain||0);}
  };
  window.KELO_PLAZA_FOUNTAIN_AUDIT=audit;
  if(window.KELO_PLAZA_AUDIT){
    window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
    window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
    window.KELO_PLAZA_AUDIT.fountainAssetMode=audit.assetMode;
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainReady',{configurable:true,get:()=>audit.ready});
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainLastLocalDepth',{configurable:true,get:()=>audit.lastLocalDepth});
  }
  window.KELO_PLAZA_FOUNTAIN=Object.freeze({version:audit.version,prefab:fountain,get ready(){return audit.ready;},get failed(){return audit.failed;}});
})();
"""
    write_text(path, text)


def patch_manifest_and_policy() -> None:
    manifest_path = ROOT / 'src/environment/art-asset-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    remove_ids = {'plaza-fountain-back', 'plaza-fountain-front', 'fuentekelo-v1'}
    manifest['assets'] = [a for a in manifest.get('assets', []) if a.get('id') not in remove_ids]
    manifest['assets'].append({
        'id': 'fuentekelo-v1',
        'family': 'plaza-fountain',
        'version': '1.0.0',
        'path': 'assets/fuentekelo-runtime.PNG',
        'kind': 'landmark-prop',
        'width': 1312,
        'height': 1199,
        'requireAlpha': True,
        'sampling': 'nearest',
        'padding': 0,
        'spacing': 0,
        'frames': {'mode': 'single', 'count': 1},
        'anchor': {'mode': 'registry-instance'},
        'visualBounds': {'mode': 'asset'},
        'footprint': {'mode': 'registry-instance'},
        'collider': {'mode': 'registry-instance'},
        'ownership': 'generic-props',
        'layers': ['props_front'],
        'priority': 20,
        'occlusion': {'mode': 'registry-instance'},
        'districtCompatibility': ['central'],
        'cache': {'strategy': 'query', 'key': 'art', 'value': '401'},
        'fallback': {'mode': 'none'},
    })
    write_text(manifest_path, json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')

    policy_path = ROOT / 'src/environment/png-validation-policy.json'
    policy = json.loads(policy_path.read_text(encoding='utf-8'))
    for item in policy.get('excludedFromWorldContract', []):
        if item.get('path') == 'assets/fuentekelo.PNG':
            item['scope'] = 'unadopted-archive'
            item['reason'] = 'Original Kelo-uploaded fountain source retained untouched; LIVE uses the deterministic alpha-clean derivative fuentekelo-runtime.png.'
    write_text(policy_path, json.dumps(policy, ensure_ascii=False, indent=2) + '\n')


def patch_index_and_ci() -> None:
    index_path = ROOT / 'index.html'
    text = index_path.read_text(encoding='utf-8')
    text = text.replace('src/environment/environment-layer-stack.js?v=3', 'src/environment/environment-layer-stack.js?v=4')
    text = text.replace('src/environment/prop-contract.js?v=5', 'src/environment/prop-contract.js?v=6')
    text = text.replace('src/environment/generic-props.js?v=5', 'src/environment/generic-props.js?v=6')
    text = text.replace('src/environment/plaza-depth.js?v=218', 'src/environment/plaza-depth.js?v=219')
    if 'assets/fuentekelo-runtime.PNG?art=401' not in text:
        text = text.replace('<link rel="preload" as="image" href="assets/plaza-ground-v1.png?art=193" fetchpriority="high">', '<link rel="preload" as="image" href="assets/plaza-ground-v1.png?art=193" fetchpriority="high">\n  <link rel="preload" as="image" href="assets/fuentekelo-runtime.PNG?art=401" fetchpriority="high">')
    write_text(index_path, text)

    ci_path = ROOT / '.github/workflows/ci.yml'
    ci = ci_path.read_text(encoding='utf-8')
    ci = ci.replace('          test -f assets/plaza-fountain-back.PNG\n          test -f assets/plaza-fountain-front.PNG', '          test -f assets/fuentekelo-runtime.PNG')
    ci = ci.replace("grep -q \"version:'1.5.0'\" src/environment/prop-contract.js", "grep -q \"version:'1.6.0'\" src/environment/prop-contract.js")
    ci = ci.replace('grep -q "generic-prop-contract-v5" src/environment/prop-contract.js', 'grep -q "generic-prop-contract-v6-reset-centerpiece" src/environment/prop-contract.js')
    ci = ci.replace('          grep -q "plazaFountainBack" src/environment/prop-contract.js\n          grep -q "plazaFountainFront" src/environment/prop-contract.js', '          grep -q "plazaFountainKelo" src/environment/prop-contract.js\n          grep -q "visibleDuringReset:true" src/environment/prop-contract.js')
    ci = ci.replace('grep -q "generic-props-v1.6" src/environment/generic-props.js', 'grep -q "generic-props-v1.7" src/environment/generic-props.js')
    ci = ci.replace('grep -q "data-driven-props-v5-irregular-frames" src/environment/generic-props.js', 'grep -q "data-driven-props-v6-reset-visible" src/environment/generic-props.js')
    ci = ci.replace('          grep -q "plaza-fountain-v2.0" src/environment/plaza-depth.js\n          grep -q "generic-prop-contract-v1" src/environment/plaza-depth.js\n          grep -q "formal-back-front-layer-stack-v1" src/environment/plaza-depth.js\n          grep -q "backLayer:\'props_back\'" src/environment/plaza-depth.js\n          grep -q "frontLayer:\'props_front\'" src/environment/plaza-depth.js\n          grep -q "renderWrapped:false" src/environment/plaza-depth.js\n          grep -q "postActorBridgeRestored:false" src/environment/plaza-depth.js', '          grep -q "plaza-fountain-v3.0" src/environment/plaza-depth.js\n          grep -q "generic-prop-contract-v1" src/environment/plaza-depth.js\n          grep -q "single-front-layer-with-actor-redraw-v1" src/environment/plaza-depth.js\n          grep -q "frontLayer:\'props_front\'" src/environment/plaza-depth.js\n          grep -q "renderWrapped:false" src/environment/plaza-depth.js\n          grep -q "decorationResetVisible:true" src/environment/plaza-depth.js')
    ci = ci.replace("('assets/plaza-fountain-back.PNG',(1254,1254)),('assets/plaza-fountain-front.PNG',(1254,1254))", "('assets/fuentekelo-runtime.PNG',(1312,1199))")
    ci = ci.replace("if 'plaza-fountain-' in path:", "if 'fuentekelo-runtime' in path:")
    write_text(ci_path, ci)


def patch_live_fountain_audit() -> None:
    path = ROOT / 'scripts/live-fountain-audit.mjs'
    text = """import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedFountain=process.env.EXPECTED_FOUNTAIN||'plaza-fountain-v3.0';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function contractOk(d){
  const f=d.fountain,l=d.layers,g=d.generic;
  const front=l?.layers?.find(x=>x.id==='plaza-fountain-front');
  return f?.ready&&!f?.failed&&f?.version===expectedFountain&&f?.assetMode==='single-authored-png-v1'&&
    f?.alignmentMode==='bottom-centered-on-plaza-v1'&&f?.decorationResetVisible===true&&
    g?.ready===true&&g?.failed===false&&g?.rendererMode==='data-driven-props-v6-reset-visible'&&g?.contractVersion==='1.6.0'&&
    front?.ready===true&&front?.phase==='props_front'&&front?.timing==='post_actor'&&front?.visibleDuringReset===true;
}

let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?fuentekelo-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({fountain:window.KELO_PLAZA_FOUNTAIN_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null}));
    if(contractOk(d)){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?fuentekelo-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);
const state=await page.evaluate(()=>{
  localPlayer.x=1440;localPlayer.y=1600;camera.x=1440;camera.y=1520;camera.targetX=1440;camera.targetY=1520;render();
  const c=document.getElementById('game-canvas');
  return {fountain:{...window.KELO_PLAZA_FOUNTAIN_AUDIT},layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,generic:window.KELO_GENERIC_PROP_AUDIT||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},dataUrl:c.toDataURL('image/png')};
});
fs.writeFileSync('artifacts/live-fuentekelo-390x844.png',Buffer.from(state.dataUrl.split(',')[1],'base64'));
delete state.dataUrl;
const report={loaded,state,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/fuentekelo-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!loaded)throw new Error('LIVE never reached fuentekelo contract');
if(!contractOk(state))throw new Error(`Final fuentekelo contract invalid: ${JSON.stringify(state)}`);
if(state.fountain?.sourceWidth!==1312||state.fountain?.sourceHeight!==1199)throw new Error('fuentekelo source dimensions invalid');
if(state.fountain?.x!==1080||state.fountain?.y!==862||state.fountain?.width!==720||state.fountain?.height!==658||state.fountain?.baseY!==1505)throw new Error(`fuentekelo geometry invalid: ${JSON.stringify(state.fountain)}`);
if((state.generic?.frontDrawCountByGroup?.plazaFountain||0)<1)throw new Error('fuentekelo front pass did not execute');
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
"""
    write_text(path, text)


def remove_superseded_fountain_layers() -> None:
    for name in ('plaza-fountain-back.PNG', 'plaza-fountain-front.PNG'):
        path = ASSETS / name
        if path.exists():
            path.unlink()


def main() -> None:
    clean_checkerboard_source()
    remove_superseded_fountain_layers()
    patch_prop_contract()
    patch_environment_layer_stack()
    patch_generic_props()
    patch_fountain_audit_bridge()
    patch_manifest_and_policy()
    patch_index_and_ci()
    patch_live_fountain_audit()
    print(f'Integrated fuentekelo at plaza center {WORLD_CENTER}; draw={DRAW_W}x{DRAW_H} at {DRAW_X},{DRAW_Y}; baseY={BASE_Y}')


if __name__ == '__main__':
    main()
