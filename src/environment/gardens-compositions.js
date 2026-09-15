(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY,G=window.KELO_GARDENS_ATLAS,J=window.KELO_GARDENS_JOINS,T_JUNCTION_ATLAS=R?.atlases?.gardensTJunctions;
if(!R||!G?.tiles||!J?.tiles||!T_JUNCTION_ATLAS){console.error('[Kelo gardens compositions] registry or gardens atlases missing');return;}
const C=Object.freeze([
  Object.freeze({id:'north-west-hedge-run',cells:Object.freeze([[6,4,'HEDGE_CAP_L'],[7,4,'HEDGE_H'],[8,4,'HEDGE_CAP_R']])}),
  Object.freeze({id:'north-east-hedge-run',cells:Object.freeze([[16,4,'HEDGE_CAP_L'],[17,4,'HEDGE_MID_ALT'],[18,4,'HEDGE_CAP_R']])}),
  Object.freeze({id:'south-west-hedge-run',cells:Object.freeze([[6,17,'HEDGE_CAP_L'],[7,17,'HEDGE_H'],[8,17,'HEDGE_CAP_R']])}),
  Object.freeze({id:'south-east-hedge-run',cells:Object.freeze([[18,17,'HEDGE_CAP_L'],[19,17,'HEDGE_H'],[20,17,'HEDGE_MID_ALT'],[21,17,'HEDGE_CAP_R']])}),
  Object.freeze({id:'west-hedge-run',cells:Object.freeze([[5,14,'HEDGE_CAP_T'],[5,15,'HEDGE_V'],[5,16,'HEDGE_V_ALT'],[5,17,'HEDGE_T_NES',2],[5,18,'HEDGE_CAP_B']])}),
  Object.freeze({id:'east-upper-hedge-run',cells:Object.freeze([[24,13,'HEDGE_CAP_T'],[24,14,'HEDGE_V_ALT'],[24,15,'HEDGE_CAP_B']])}),
  Object.freeze({id:'east-lower-hedge-run',cells:Object.freeze([[22,15,'HEDGE_CAP_T'],[22,16,'HEDGE_V_ALT'],[22,17,'HEDGE_T_NWS',0],[22,18,'HEDGE_CAP_B']])}),
  Object.freeze({id:'flowerbed-nw',cells:Object.freeze([[8,8,'FLOWER_CAP_L'],[9,8,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-ne',cells:Object.freeze([[19,13,'FLOWER_CAP_L'],[20,13,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-sw',cells:Object.freeze([[8,14,'FLOWER_CAP_L'],[9,14,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-se',cells:Object.freeze([[17,14,'FLOWER_CAP_L'],[18,14,'FLOWER_MID_ALT'],[19,14,'FLOWER_CAP_R']])})
]);
const FIXED=Object.freeze([
  Object.freeze([5,4,'HEDGE_CORNER',0]),Object.freeze([22,4,'HEDGE_CORNER',1]),
  Object.freeze([9,11,'WATER']),Object.freeze([19,11,'WATER']),Object.freeze([5,11,'PLINTH']),Object.freeze([25,11,'PLINTH']),
  Object.freeze([9,16,'STEPPING_STONES'])
]);
const declaredCellCount=C.reduce((n,comp)=>n+comp.cells.length,0)+FIXED.length;
const styles=Object.freeze({...R.styles,gardensCompositions:Object.freeze({
  mode:'registry-authored-garden-compositions-v20',sourceAtlas:G.id,joinAtlas:J.id,tJunctionAtlas:T_JUNCTION_ATLAS,
  centerVariationMode:'authored-mid-variant-selection-v2',verticalVariationMode:'mirrored-authored-vertical-mid-v1',
  junctionMode:'authored-four-orientation-t-family-v7',tJunctionOwnership:'tile-registry-overlay-exclusive-v2',legacyVirtualTJunctions:false,
  fixedPlacementMode:'registry-authored-fixed-accents-v3',navigationSafeRelocationMode:'authored-road-clear-placements-v10',
  compositionCount:C.length,fixedPlacementCount:FIXED.length,declaredCellCount,compositions:C,fixedPlacements:FIXED,preservePathClearance:true,preserveLandmarkClearance:true
})});
window.KELO_TILE_REGISTRY=Object.freeze({...R,styles});
window.KELO_GARDENS_COMPOSITION_AUDIT=Object.freeze({
  version:'gardens-compositions-v20',auditRevision:'registry-owned-t-atlas-v1',ready:true,mode:styles.gardensCompositions.mode,
  centerVariationMode:styles.gardensCompositions.centerVariationMode,verticalVariationMode:styles.gardensCompositions.verticalVariationMode,
  junctionMode:styles.gardensCompositions.junctionMode,tJunctionOwnership:styles.gardensCompositions.tJunctionOwnership,legacyVirtualTJunctions:false,
  fixedPlacementMode:styles.gardensCompositions.fixedPlacementMode,navigationSafeRelocationMode:styles.gardensCompositions.navigationSafeRelocationMode,
  compositionCount:C.length,fixedPlacementCount:FIXED.length,declaredCellCount,joinAtlas:J.id,joinMode:J.mode,tJunctionAtlas:T_JUNCTION_ATLAS.id,
  tJunctionRegistryKey:'gardensTJunctions',tJunctionRegistryOwned:true,tJunctionOrientationCount:4,altCenterTileCount:4,verticalAltUsageCount:3,navigationConflictFixCount:16,connectedJunctionCount:4,tJunctionCount:2,
  southeastTJunctionAnchor:Object.freeze([22,17]),southeastTBranchEnd:Object.freeze([22,18]),southwestTJunctionAnchor:Object.freeze([5,17]),
  southwestTBranchEnd:Object.freeze([5,18]),southwestHorizontalRunAnchor:Object.freeze([6,17]),southwestVerticalRunAnchor:Object.freeze([5,14]),
  relocatedEastRunAnchor:Object.freeze([24,13]),relocatedFlowerbedNWAnchor:Object.freeze([8,8]),relocatedFlowerbedNEAnchor:Object.freeze([19,13]),
  relocatedFlowerbedSWAnchor:Object.freeze([8,14]),relocatedWaterAnchors:Object.freeze([Object.freeze([9,11]),Object.freeze([19,11])]),
  relocatedWestPlinthAnchor:Object.freeze([5,11]),relocatedEastPlinthAnchor:Object.freeze([25,11]),relocatedSteppingStoneAnchor:Object.freeze([9,16])
});
})();