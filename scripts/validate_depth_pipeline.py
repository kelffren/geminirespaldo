from pathlib import Path


def text(path):
    return Path(path).read_text(encoding='utf-8')


env = text('src/environment/environment-layer-stack.js')
engine = text('engine-c.js')
contract = text('src/environment/prop-contract.js')
generic = text('src/environment/generic-props.js')
rural = text('src/environment/rural-ground.js')
fountain = text('src/environment/plaza-depth.js')

checks = {
    'environment stack exposes props_back pre-actor phase': "PRE_ACTOR_PHASES=new Set(['props_back'])" in env,
    'environment stack exposes drawPreActors': 'function drawPreActors(g)' in env and 'drawPreActors,drawPostActors' in env,
    'environment stack reports formal base/back/actor/front mode': "formal-base-back-actor-front-order-v1" in env,
    'engine calls pre-actor pass': 'KELO_WORLD_RENDERER.drawPreActors(ctx)' in engine,
    'pre-actor pass occurs after farm scene': engine.find('renderFarm(STATE.farm)') < engine.find('KELO_WORLD_RENDERER.drawPreActors(ctx)'),
    'pre-actor pass occurs before avatars': engine.find('KELO_WORLD_RENDERER.drawPreActors(ctx)') < engine.find('renderAvatar(arenaPvP.rival'),
    'rural boundary is layer-stack owned': "rural-boundary',ownership:'rural-farm-boundary-props-v1',priority:8,renderMode:'layer-stack'" in contract,
    'rural source exposes dynamic instances': 'instances:function()' in contract and 'buildRuralFarmBoundary(STATE.farm)' in contract,
    'generic renderer consumes dynamic sources': 'sourcePropsFor(groupKey)' in generic and 'source.instances()' in generic,
    'rural renderer no longer draws generic props immediately': 'GENERIC_PROPS.drawInstances' not in rural,
    'rural audit declares formal props_back mode': "boundaryMode:'environment-layer-stack-props-back-v1'" in rural,
    'rural audit declares no immediate boundary draw': 'immediateBoundaryDraw:false' in rural,
    'fountain uses generic prop layer group': "plazaFountain:Object.freeze({id:'plaza-fountain'" in contract and "layerRole:'front'" in contract,
    'generic renderer supports split front role': "p.layerRole==='front'" in generic and "p.layerRole!=='front'" in generic,
    'generic renderer supports actor base-y redraw': "actor-base-y-redraw-v1" in contract and "p.occlusion?.mode==='actor-base-y-redraw-v1'" in generic,
    'generic renderer owns static prop colliders': 'registerStaticColliders()' in generic and '_genericPropCollision:true' in generic,
    'plaza fountain legacy file is telemetry only': 'new Image()' not in fountain and 'g.drawImage' not in fountain and 'renderAvatar(' not in fountain and 'L.register(' not in fountain,
    'fountain bridge declares generic contract ownership': "bridgePolicy:'generic-prop-contract-v1'" in fountain,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)
if failed:
    raise SystemExit('Depth pipeline validation failed: ' + '; '.join(failed))
print(f'PASS: {len(checks)} formal depth pipeline checks')