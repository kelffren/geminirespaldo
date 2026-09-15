/* KELO-INDEX
 * area: INSTANCES
 * keys: PROPERTY HOUSE BRIDGE AUTHORITY PLACEMENTS
 * hace: documenta y expone el puente entre parcels House y la autoridad de instancias
 * online: Property conserva request(); las mutaciones House se enrutan al adapter de autoridad
 */
(function(){
  'use strict';
  const S=window.KELO_PROPERTY_SYSTEM;
  if(!S){console.error('[Kelo house bridge] property system missing');return;}
  function currentHouseParcel(){const i=window.KELO_HOUSES?.current?.();return i?.parcelId?S.parcel(i.parcelId):null;}
  function isHouseParcel(parcelId){return S.parcel(parcelId)?.kind==='house';}
  window.KELO_PROPERTY_HOUSE_BRIDGE=Object.freeze({version:'property-house-bridge-v1.0.0',currentHouseParcel,isHouseParcel,placements:()=>{const p=currentHouseParcel();return p?S.getPlacements(p.parcelId):[];},onlineReady:true});
})();