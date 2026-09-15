/* KELO-INDEX
 * area: ABILITIES / SOURCE CAST
 * owner: KeloAbilities is the source-native delivery/effect runtime owner; this file is compatibility SUPPORT only
 * keys: ABILITY SOURCE CAST EQUIPMENT MOUNT COMPAT AUTHORITY LAZY UI
 * purpose: conserva KeloAbilitySourceCast como boca compatible delegando a KeloAbilities.engine.castSource sin tocar el hotbar Stone; expone un facade UI mínimo mientras el runtime pesado sigue lazy
 * public-api: KeloAbilitySourceCast.cast/isAvailable + KeloAbilities.openStonePanel lazy facade before runtime boot
 * consumes: KeloAbilities.engine.castSource + KeloAbilitiesLoader.ensure
 * state-owned: ninguno
 * extension-points: sourceType/sourceId/sourceSlot/sourceFingerprint
 * online: identidad estable viaja al owner KeloAbilities; el servidor futuro valida ownership/loadout de la fuente
 * legacy: compatibility shim para consumidores antiguos; código nuevo usa KeloAbilities.engine.castSource directamente
 * do-not: no crear delivery/effect handlers, no tocar hotbar/STATE.equipped, no persistir cooldowns, no mutar HP
 */
(function(root){'use strict';if(root.KeloAbilitySourceCast)return;
const VERSION='ability-source-cast-v2.1.0-lazy-ui-facade';
function cast(options){
 const runtime=root.KeloAbilities?.engine;
 if(!runtime?.castSource)return{valid:false,reason:'ABILITY_SOURCE_RUNTIME_UNAVAILABLE'};
 try{return runtime.castSource(options||{});}catch(error){return{valid:false,reason:'CAST_EXCEPTION',error:String(error&&error.message||error)};}
}
root.KeloAbilitySourceCast=Object.freeze({version:VERSION,cast,isAvailable:()=>typeof root.KeloAbilities?.engine?.castSource==='function'});

// Luxe Shell is intentionally lightweight and may render before the heavy ability
// foundations have been requested. Keep the menu route functional without eagerly
// booting combat/effects: the first tap asks the canonical loader to ensure the
// runtime, whose boot() replaces this writable facade with the frozen real API.
if(!root.KeloAbilities&&root.KeloAbilitiesLoader?.ensure){
 root.KeloAbilities={
   openStonePanel(){
     return root.KeloAbilitiesLoader.ensure().then(api=>{
       if(!api?.openStonePanel)throw new Error('KELO_ABILITY_PANEL_UNAVAILABLE');
       return api.openStonePanel();
     });
   }
 };
}

root.KELO_ABILITY_SOURCE_CAST_AUDIT=Object.freeze({version:VERSION,compatibilityShim:true,nativeRuntime:true,lazyUiFacade:true,hotbarWrites:0,stoneStateWrites:0,duplicateDeliveryHandlers:0,persistentState:false,legacyBridge:false});
})(typeof globalThis!=='undefined'?globalThis:window);
