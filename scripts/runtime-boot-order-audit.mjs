/* KELO-INDEX
 * area: QA / RUNTIME BOOT
 * owner: Runtime Boot Contract
 * owns: deterministic validation of critical index.html script precedence
 * does-not-own: runtime loading, feature behavior, cache versions
 * purpose: convert fragile implicit script order into an executable CI contract
 * public-api: CLI `node scripts/runtime-boot-order-audit.mjs`
 * extension-points: add only critical dependency edges; avoid mirroring every script
 * reuse: quality CI before runtime/deploy verification
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const INDEX=path.join(ROOT,'index.html');
let failures=0;
let warnings=0;
const fail=message=>{failures+=1;console.error('BOOT_ORDER_FAIL:',message);};
const warn=message=>{warnings+=1;console.warn('BOOT_ORDER_WARN:',message);};
const ok=message=>console.log('BOOT_ORDER_OK:',message);

if(!fs.existsSync(INDEX)){
  fail('index.html missing');
} else {
  const html=fs.readFileSync(INDEX,'utf8');
  const scripts=[];
  const re=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while((match=re.exec(html))){
    const raw=match[1];
    const normalized=raw.split('?')[0].split('#')[0];
    scripts.push({raw,normalized,offset:match.index});
  }

  const local=scripts.filter(item=>!/^https?:\/\//i.test(item.normalized)&&!/^\/\//.test(item.normalized));
  const positions=new Map();
  for(let i=0;i<local.length;i++){
    const key=local[i].normalized;
    if(!positions.has(key)) positions.set(key,[]);
    positions.get(key).push(i);
  }

  for(const [src,indices] of positions){
    if(indices.length>1) fail(`duplicate local script bootstrap: ${src} at positions ${indices.join(', ')}`);
  }

  const requireScript=src=>{
    const indices=positions.get(src)||[];
    if(indices.length!==1){
      if(indices.length===0) fail('required boot script missing: '+src);
      return null;
    }
    return indices[0];
  };
  const before=(a,b,reason)=>{
    const ai=requireScript(a), bi=requireScript(b);
    if(ai==null||bi==null) return;
    if(ai>=bi) fail(`${a} must load before ${b}${reason?` (${reason})`:''}`);
  };

  const edges=[
    ['src/core/events/event-bus.js','src/core/input-lock-system.js','events exist before lock consumers'],
    ['src/core/input-lock-system.js','src/core/kelo-runtime-bootstrap.js','bootstrap consumes core primitives'],
    ['src/physics/collision-utils.js','engine-a.js','legacy physics delegates collision contract'],
    ['engine-a.js','src/core/input-system.js','legacy base exists before input owner adoption'],
    ['src/core/input-system.js','src/core/movement-system.js','movement consumes normalized input owner'],
    ['src/core/movement-system.js','engine-b.js','legacy movement consumers follow owner bridge'],
    ['engine-c.js','src/core/camera-system.js','camera adopts initialized player/runtime state'],
    ['src/core/camera-system.js','src/core/avatar-render-system.js','avatar presentation follows viewport owner'],
    ['src/core/avatar-render-system.js','src/core/render-extension-system.js','render extensions wrap established avatar owner'],
    ['src/environment/terrain-contract.js','src/environment/tile-registry.js','tiles consume terrain semantics'],
    ['src/environment/tile-registry.js','src/environment/atlas-contract.js','atlas contract sees registered tiles'],
    ['src/environment/atlas-contract.js','src/environment/world-map.js','world map consumes managed atlas contract'],
    ['src/environment/world-map.js','src/environment/environment-layer-stack.js','layer stack consumes authored world'],
    ['src/environment/environment-layer-stack.js','src/environment/prop-contract.js','props attach to established draw phases'],
    ['src/environment/prop-contract.js','src/environment/generic-props.js','generic renderer consumes prop contract'],
    ['src/environment/generic-props.js','engine-l.js','legacy world renderer follows managed props'],
    ['src/core/kelo-runtime-bootstrap.js','src/systems/pvp-combat-runtime-loader.js','PvP must reuse shared lazy foundations'],
    ['src/config/online-runtime-config.js','engine-net.js','network reads online runtime config before transport boot'],
    ['src/systems/player-stats.js','src/systems/title-system.js','titles consume canonical player stats'],
    ['src/stats/stat-modifier-system.js','src/systems/equipment-system.js','equipment publishes through stat modifier owner'],
    ['src/appearance/appearance-system.js','src/mounts/mount-system.js','mounts consume canonical appearance'],
    ['src/property/property-asset-catalog.js','src/property/property-system.js','property runtime consumes catalog'],
    ['src/property/forest-plaza-asset-catalog.js','src/property/property-system.js','forest assets register before property runtime'],
    ['src/systems/guardian-authority.js','src/systems/guardian-system.js','guardian authority before client orchestration'],
    ['src/systems/guardian-system.js','src/ui/guardian-ui.js','guardian UI consumes system API'],
    ['src/systems/game-tuning-authority.js','src/systems/game-tuning-system.js','tuning authority before client system'],
    ['src/systems/game-tuning-system.js','src/ui/game-tuning-admin-ui.js','tuning UI consumes system API']
  ];
  for(const edge of edges) before(...edge);

  // Auth intentionally starts after DOMContentLoaded so a slow third-party Supabase CDN
  // can never hold the game's first frame. Validate that post-DCL chain separately
  // instead of pretending those files are parser-time boot scripts.
  const loaderMatch=html.match(/\bvar\s+urls\s*=\s*\[([\s\S]*?)\]\s*;/);
  if(!loaderMatch){
    fail('post-DCL auth loader missing');
  } else {
    const dynamic=[];
    const stringRe=/['"]([^'"]+)['"]/g;
    let item;
    while((item=stringRe.exec(loaderMatch[1]))) dynamic.push(item[1].split('?')[0].split('#')[0]);
    const dynamicPos=new Map(dynamic.map((src,index)=>[src,index]));
    const requireDynamic=src=>{
      const index=dynamicPos.get(src);
      if(index==null){fail('required post-DCL auth script missing: '+src);return null;}
      return index;
    };
    const dynamicBefore=(a,b,reason)=>{
      const ai=requireDynamic(a),bi=requireDynamic(b);
      if(ai==null||bi==null)return;
      if(ai>=bi)fail(`${a} must load before ${b} in post-DCL auth chain${reason?` (${reason})`:''}`);
    };
    const sdk=dynamic.find(src=>/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@/i.test(src));
    if(!sdk)fail('Supabase SDK missing from post-DCL auth chain');
    else dynamicBefore(sdk,'src/auth/supabase-auth-runtime.js','auth runtime consumes Supabase SDK');
    dynamicBefore('src/auth/supabase-auth-runtime.js','src/auth/online-auth-lifecycle-bridge.js','lifecycle consumes auth runtime');
    dynamicBefore('src/auth/online-auth-lifecycle-bridge.js','src/ui/account-auth-ui.js','account UI follows lifecycle owner');
    dynamicBefore('src/ui/account-auth-ui.js','src/auth/guest-play-bypass.js','guest bypass applies after canonical account UI');
    ok(`validated ${dynamic.length} post-DCL auth loader entries`);
  }

  const inlineMutations=[...html.matchAll(/<script>([^<]*(?:window|globalThis)\.[A-Z0-9_]+\s*=.*?)[<]\/script>/gsi)];
  if(inlineMutations.length) warn(`${inlineMutations.length} inline global boot mutation(s) remain; migrate them into explicit config owners gradually`);

  ok(`validated ${local.length} local script tags and ${edges.length} critical dependency edges`);
}

if(failures){
  console.error(`\nRuntime boot order audit failed with ${failures} violation(s) and ${warnings} warning(s).`);
  process.exit(1);
}
ok(`Runtime boot order contract passed${warnings?` with ${warnings} warning(s)`:''}`);