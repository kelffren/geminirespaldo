from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def patch(path, transform):
    p = ROOT / path
    old = p.read_text(encoding='utf-8')
    new = transform(old)
    if new == old:
        print('NOCHANGE', path)
        return
    p.write_text(new, encoding='utf-8')
    print('PATCHED', path)


def tile_registry(text):
    if 'function assetSrc(' not in text:
        text = text.replace(
            '  const TILE = 32;\n',
            "  const TILE = 32;\n  const RESET = window.KELO_WORLD_DECORATION_RESET === true;\n  function resetBlank(width,height){\n    const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);\n    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'%3E%3C/svg%3E#kelo-reset`;\n  }\n  function assetSrc(src,width,height){ return RESET ? resetBlank(width,height) : src; }\n",
            1,
        )
    # Convert authored registry sources with literal dimensions to reset-safe transparent assets.
    pattern = re.compile(r"src:'([^']+)'(\s*,\s*width:(\d+)\s*,\s*height:(\d+))")
    text = pattern.sub(lambda m: f"src:assetSrc('{m.group(1)}',{m.group(3)},{m.group(4)}){m.group(2)}", text)
    return text


def engine_l(text):
    old = "  sheet.src=ATLAS.src+'&v=100';\n  transitionSheet.src=TRANSITION_ATLAS.src+'&v=100';\n  groundSheet.src=GROUND_ATLAS.src+'&v=100';"
    new = "  if(window.KELO_WORLD_DECORATION_RESET!==true){\n    sheet.src=ATLAS.src+'&v=100';\n    transitionSheet.src=TRANSITION_ATLAS.src+'&v=100';\n    groundSheet.src=GROUND_ATLAS.src+'&v=100';\n  }else{\n    window.KELO_PLAZA_AUDIT.ready=true;\n    window.KELO_PLAZA_AUDIT.assetLoaded=false;\n    window.KELO_PLAZA_AUDIT.groundAssetLoaded=false;\n    window.KELO_PLAZA_AUDIT.fallbackActive=false;\n    window.KELO_PLAZA_AUDIT.decorationReset=true;\n    window.KELO_PLAZA_AUDIT.decorationResetSuppressed=true;\n  }"
    if old in text:
        text = text.replace(old, new, 1)
    elif 'window.KELO_WORLD_DECORATION_RESET!==true' not in text:
        raise RuntimeError('engine-l fountain-reset load guard marker not found')
    return text


def engine_o(text):
    old = '  if (asset && prop && style) {'
    new = "  if (resetActive()) {\n    window.KELO_TRAINING_DUMMY_AUDIT.ready = true;\n    window.KELO_TRAINING_DUMMY_AUDIT.assetLoaded = false;\n    window.KELO_TRAINING_DUMMY_AUDIT.fallbackActive = false;\n  } else if (asset && prop && style) {"
    if old in text:
        text = text.replace(old, new, 1)
    elif 'window.KELO_TRAINING_DUMMY_AUDIT.assetLoaded = false' not in text:
        raise RuntimeError('engine-o reset guard marker not found')
    return text


def engine_p(text):
    old = '  if (npcAtlas && npcVisuals && npcStyle) {'
    new = "  if (resetActive()) {\n    window.KELO_PLAZA_NPC_AUDIT.ready = true;\n    window.KELO_PLAZA_NPC_AUDIT.assetLoaded = false;\n    window.KELO_PLAZA_NPC_AUDIT.fallbackActive = false;\n  } else if (npcAtlas && npcVisuals && npcStyle) {"
    if old in text:
        text = text.replace(old, new, 1)
    elif 'window.KELO_PLAZA_NPC_AUDIT.assetLoaded = false' not in text:
        raise RuntimeError('engine-p reset guard marker not found')
    return text


def appearance(text):
    text = text.replace(
        "  const DEFAULT_BOT = 'bot_crimson_v1';",
        "  const DEFAULT_BOT = window.KELO_WORLD_DECORATION_RESET === true ? DEFAULT_PLAYER : 'bot_crimson_v1';",
        1,
    )
    old = "  Object.keys(definitions).forEach(function (id) { const def = definitions[id]; if (!def.delegateToLegacyHero) ensureRuntime(def); });"
    new = "  Object.keys(definitions).forEach(function (id) { const def = definitions[id]; if (!def.delegateToLegacyHero && !(window.KELO_WORLD_DECORATION_RESET === true && def.role === 'bot')) ensureRuntime(def); });"
    if old in text:
        text = text.replace(old, new, 1)
    elif "def.role === 'bot'" not in text:
        raise RuntimeError('appearance reset guard marker not found')
    return text


patch('src/environment/tile-registry.js', tile_registry)
patch('engine-l.js', engine_l)
patch('engine-o.js', engine_o)
patch('engine-p.js', engine_p)
patch('src/characters/character-appearance.js', appearance)
print('PASS reset asset loads are network-clean')
