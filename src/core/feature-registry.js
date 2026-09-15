/* KELO-INDEX
 * area: CORE / FEATURE REGISTRY
 * owner: KELO_FEATURE_REGISTRY
 * keys: FEATURE MODULE DEPENDENCY LAZY ASSET LIFECYCLE SCALABILITY
 * purpose: fuente única de verdad para paquetes opcionales; Module Loader y Asset Registry consumen este catálogo
 * public-api: KELO_FEATURE_REGISTRY.ids/has/get/files/catalog/resolve
 * state-owned: definiciones inmutables de features; no carga scripts ni modifica gameplay
 * do-not: NO ejecutar features, NO crear segundo loader, NO meter estado runtime mutable
 */
(function(root){
'use strict';
if(root.KELO_FEATURE_REGISTRY)return;
const VERSION='kelo-feature-registry-v2.0.0';
const raw={
  social:{dependencies:[],policy:'first-use',files:[
    {src:'src/ui/player-nameplate.js?v=2',name:'placas'},
    {src:'src/systems/nobility.js?v=4',name:'títulos'},
    {src:'src/environment/plaza-depth.js?v=219',name:'plaza'},
    {src:'src/ui/profile-panel-close.js?v=2',name:'perfil'},
    {src:'src/ui/self-interaction-ui.js?v=1',name:'perfil'}
  ]},
  world:{dependencies:[],policy:'first-use',files:[
    {src:'engine-m.js?v=94',name:'mundo'},
    {src:'engine-n.js?v=230',name:'mundo'},
    {src:'engine-o.js?v=96',name:'mundo'},
    {src:'engine-p.js?v=96',name:'mundo'},
    {src:'engine-q.js?v=94',name:'mundo'},
    {src:'engine-s.js?v=96',name:'mundo'},
    {src:'engine-ah.js?v=95',name:'mundo'},
    {src:'engine-ai.js?v=95',name:'mundo'},
    {src:'src/systems/illumination.js?v=2',name:'luz'}
  ]},
  bag:{dependencies:[],policy:'first-use',files:[
    {src:'src/ui/backpack-fantasy-v1.css?v=1',name:'estilo mochila',type:'style'},
    {src:'src/systems/backpack-system.js?v=2',name:'mochila'},
    {src:'src/ui/backpack-ui.js?v=4',name:'mochila'}
  ]},
  mounts:{dependencies:[],policy:'first-use',files:[
    {src:'src/mounts/mount-catalog.js?v=2',name:'monturas'},
    {src:'src/mounts/mount-system.js?v=2',name:'monturas'},
    {src:'src/ui/mount-panel.js?v=2',name:'monturas'}
  ]},
  market:{dependencies:[],policy:'first-use',files:[
    {src:'src/systems/market-escrow-system.js?v=1',name:'mercado'},
    {src:'src/ui/market-ui.js?v=2',name:'mercado'}
  ]},
  titles:{dependencies:[],policy:'first-use',files:[
    {src:'src/systems/title-catalog.js?v=1',name:'títulos'},
    {src:'src/systems/player-stats.js?v=1',name:'títulos'},
    {src:'src/systems/title-system.js?v=1',name:'títulos'}
  ]},
  appearance:{dependencies:[],policy:'first-use',files:[
    {src:'src/characters/character-customization.js?v=1',name:'apariencia'},
    {src:'src/ui/character-customizer-ui.js?v=1',name:'apariencia'}
  ]},
  properties:{dependencies:[],policy:'first-use',files:[
    {src:'src/property/property-system.js?v=4',name:'propiedades'},
    {src:'src/ui/house-instance-ui.js?v=1',name:'propiedades'}
  ]}
};
const ALIASES=Object.freeze({nobility:'social',emotes:'social'});
const definitions=Object.create(null);
for(const [id,spec] of Object.entries(raw)){
  definitions[id]=Object.freeze({
    id,
    policy:String(spec.policy||'first-use'),
    dependencies:Object.freeze((spec.dependencies||[]).map(String)),
    files:Object.freeze((spec.files||[]).map(item=>Object.freeze({...item})))
  });
}
const IDS=Object.freeze(Object.keys(definitions));
function resolve(id){const key=String(id||'');return ALIASES[key]||key;}
function get(id){return definitions[resolve(id)]||null;}
function has(id){return !!get(id);}
function files(id){return get(id)?.files||null;}
function catalog(){return Object.freeze(Object.fromEntries(IDS.map(id=>[id,definitions[id]])));}
root.KELO_FEATURE_REGISTRY=Object.freeze({version:VERSION,ids:IDS,aliases:ALIASES,resolve,has,get,files,catalog});
})(typeof globalThis!=='undefined'?globalThis:window);
