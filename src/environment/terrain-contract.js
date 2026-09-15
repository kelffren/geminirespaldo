(function(){
  const SIDES=Object.freeze({top:1,right:2,bottom:4,left:8});
  const FRAME_BY_MASK=Object.freeze({0:15,1:0,2:1,3:5,4:2,5:12,6:6,7:9,8:3,9:4,10:13,11:8,12:7,13:11,14:10,15:14});
  const freezeList=(items)=>Object.freeze(items);
  const freezeRules=(rules)=>Object.freeze(rules);
  function defineDistrict(def){return Object.freeze({...def,bounds:Object.freeze(def.bounds),groundFamilies:freezeList(def.groundFamilies||[]),transitionFamilies:freezeList(def.transitionFamilies||[]),pathFamilies:freezeList(def.pathFamilies||[]),vegetationFamilies:freezeList(def.vegetationFamilies||[]),propFamilies:freezeList(def.propFamilies||[]),architectureFamilies:freezeList(def.architectureFamilies||[]),landmarkFamilies:freezeList(def.landmarkFamilies||[]),decorationRules:freezeRules(def.decorationRules||{}),placementRules:freezeRules(def.placementRules||{})});}

  const materials=Object.freeze({
    grass:Object.freeze({id:'grass',role:'base',atlas:'grassVariation',family:'grassAuthored',sampling:'nearest',variationMode:'deterministic-family-v1',variationGroups:Object.freeze([Object.freeze([0,1,2,3]),Object.freeze([4,5,6,7])])}),
    marble:Object.freeze({id:'marble',role:'path',atlas:'plaza',family:'marble',sampling:'nearest',variationMode:'deterministic-family-v1',detailAtlas:'marbleVariation',detailFamily:'marbleVariation',accentFamily:'marbleAccent'})
  });

  const transitions=Object.freeze({
    marble_to_grass:Object.freeze({id:'marble_to_grass',owner:'marble',neighbour:'grass',atlas:'transitions',topology:'edge-bitmask-4-v1',sideOrder:Object.freeze(['top','right','bottom','left']),sideBits:SIDES,frameByMask:FRAME_BY_MASK,overlay:true})
  });

  const profiles=Object.freeze({
    central:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:43,detailCluster:false,pathAccentEvery:0,pathDetail:false}),
    rural:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:31,detailCluster:true,pathAccentEvery:0,pathDetail:false}),
    arena:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:61,detailCluster:false,pathAccentEvery:29,pathDetail:true}),
    commerce:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:67,detailCluster:false,pathAccentEvery:23,pathDetail:true}),
    gardens:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:17,detailCluster:true,pathAccentEvery:0,pathDetail:true}),
    default:Object.freeze({baseTerrain:'grass',pathTerrain:'marble',detailEvery:53,detailCluster:false,pathAccentEvery:0,pathDetail:false})
  });

  const districtVisualProfiles=Object.freeze({
    central:defineDistrict({id:'central',name:'Plaza Central',kind:'plaza',bounds:{x:1040,y:1240,w:800,h:560},terrainProfile:'central',groundFamilies:['grass','marble'],transitionFamilies:['marble_to_grass'],pathFamilies:['marble'],vegetationFamilies:['plazaNature'],propFamilies:['plazaNature','plazaFountain'],architectureFamilies:['architecture'],landmarkFamilies:['plazaFountain','luxeBoutique'],palette:'bright-roman-garden',density:'medium',variation:'controlled',decorationRules:{negativeSpace:'medium',focalPoints:true},placementRules:{keepPrimaryPathsClear:true,landmarkPriority:'high'}}),
    rural:defineDistrict({id:'rural',name:'Distrito Rural',kind:'farm',bounds:{x:448,y:1320,w:720,h:640},terrainProfile:'rural',groundFamilies:['grass','ruralSoil'],transitionFamilies:['marble_to_grass'],pathFamilies:['marble','dirt'],vegetationFamilies:['ruralNature'],propFamilies:['ruralProps','ruralNature'],architectureFamilies:['ruralLandmarks'],landmarkFamilies:['ruralLandmarks'],palette:'warm-rural',density:'low-medium',variation:'clustered',decorationRules:{centerClear:true,northRoadClear:true},placementRules:{farmPerimeterAware:true,approachPathClear:true}}),
    arena:defineDistrict({id:'arena',name:'Distrito Arena',kind:'arena',bounds:{x:1728,y:448,w:864,h:640},terrainProfile:'arena',groundFamilies:['grass','marble'],transitionFamilies:['marble_to_grass'],pathFamilies:['marble'],vegetationFamilies:[],propFamilies:['arenaProps'],architectureFamilies:['arenaArchitecture'],landmarkFamilies:['arenaLandmarks'],palette:'stone-sport',density:'low',variation:'restrained',decorationRules:{combatReadability:true},placementRules:{combatCoreClear:true,edgeWeightedProps:true}}),
    commerce:defineDistrict({id:'commerce',name:'Distrito Comercio',kind:'commerce',bounds:{x:1888,y:1264,w:896,h:704},terrainProfile:'commerce',groundFamilies:['grass','marble'],transitionFamilies:['marble_to_grass'],pathFamilies:['marble'],vegetationFamilies:[],propFamilies:['commerceProps'],architectureFamilies:['commerceArchitecture'],landmarkFamilies:['commerceLandmarks'],palette:'premium-market',density:'medium-high',variation:'structured',decorationRules:{storefrontReadability:true},placementRules:{storefrontFrontageClear:true,pedestrianLaneClear:true}}),
    gardens:defineDistrict({id:'gardens',name:'Jardines del Sur',kind:'garden',bounds:{x:1056,y:2144,w:896,h:704},terrainProfile:'gardens',tileOverlayProvider:'garden-compositions-v1',groundFamilies:['grass','marble'],transitionFamilies:['marble_to_grass'],pathFamilies:['marble'],vegetationFamilies:['gardens'],propFamilies:['gardens'],architectureFamilies:[],landmarkFamilies:['gardensFountain'],palette:'lush-cyan-garden',density:'high',variation:'clustered',decorationRules:{landmarkClearance:true,negativeSpace:'controlled'},placementRules:{promenadeClear:true,fountainFootprintClear:true}})
  });
  const districtOrder=Object.freeze(['central','rural','arena','commerce','gardens']);
  const districts=Object.freeze(districtOrder.map(id=>{const p=districtVisualProfiles[id],b=p.bounds;return Object.freeze({id:p.id,name:p.name,kind:p.kind,x:b.x,y:b.y,w:b.w,h:b.h});}));

  function transitionKey(owner,neighbour){return owner+'_to_'+neighbour;}
  function getTransition(owner,neighbour){return transitions[transitionKey(owner,neighbour)]||null;}
  function frameFor(owner,neighbour,mask){const set=getTransition(owner,neighbour);return set?.frameByMask?.[mask]??null;}
  function districtVisualProfileFor(id){return districtVisualProfiles[id]||null;}
  function districtForPoint(x,y){return districts.find(d=>x>=d.x&&y>=d.y&&x<d.x+d.w&&y<d.y+d.h)||null;}
  function profileFor(id){const terrainId=districtVisualProfileFor(id)?.terrainProfile||id;return profiles[terrainId]||profiles.default;}
  function collectAtlasKeys(materialSet=materials,transitionSet=transitions){const keys=new Set();for(const def of Object.values(materialSet||{})){if(def?.atlas)keys.add(def.atlas);if(def?.detailAtlas)keys.add(def.detailAtlas)}for(const set of Object.values(transitionSet||{}))if(set?.atlas)keys.add(set.atlas);return [...keys];}
  const requiredAtlasKeys=Object.freeze(collectAtlasKeys());

  const districtApi=Object.freeze({version:'1.2.0',mode:'data-driven-district-visual-profiles-v3',profiles:districtVisualProfiles,order:districtOrder,districts,get:districtVisualProfileFor,terrainProfileFor:(id)=>districtVisualProfileFor(id)?.terrainProfile||id||'default',districtForPoint});
  window.KELO_DISTRICT_VISUAL_PROFILES=districtApi;
  window.KELO_TERRAIN_CONTRACT=Object.freeze({version:'1.5.0',tileSize:32,topology:'edge-bitmask-4-v1',defaults:Object.freeze({baseTerrain:'grass',pathTerrain:'marble'}),sideBits:SIDES,materials,transitions,profiles,districtVisualProfiles,districtOrder,districts,districtVisualProfileVersion:districtApi.version,requiredAtlasKeys,getTransition,frameFor,profileFor,districtVisualProfileFor,districtForPoint,collectAtlasKeys});
})();