/* KELO-INDEX
 * area: EFFECTS
 * owner: KeloEffectSchema
 * keys: SCHEMA DAMAGE HEAL SHIELD STATUS CC BUFF DEBUFF STAGGER INVULNERABLE
 * purpose: vocabulario canónico de efectos reutilizables; no ejecuta habilidades ni presentation
 * online: definitions comparten los mismos type IDs con autoridad server
 */
(function(root){
  'use strict';
  const VERSION='effect-schema-v2.0.0-pvp-bible';
  const TYPES=Object.freeze(['damage','heal','shield','status','burn','slow','poison','bleed','stun','knockback','stagger','root','silence','invulnerable','movement_buff','damage_buff','damage_debuff','buff','debuff','lifesteal']);
  function supports(type){return TYPES.indexOf(String(type||''))>=0;}
  root.KELO_EFFECT_SCHEMA_AUDIT={version:VERSION,ready:true,typeCount:TYPES.length,ccNormalized:true};
  root.KeloEffectSchema=Object.freeze({version:VERSION,types:TYPES,supports});
})(typeof globalThis!=='undefined'?globalThis:window);
