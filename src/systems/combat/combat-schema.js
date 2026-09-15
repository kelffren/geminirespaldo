/* KELO-INDEX
 * area: COMBAT
 * owner: KeloCombatSchema
 * keys: SCHEMA EVENTS ATTACK HIT MISS DAMAGE BLOCK SHIELD CC DODGE KILL AUTHORITY
 * purpose: única fuente de verdad para eventos/tipos semánticos de combate; no ejecuta gameplay
 * online: IDs estables compartidos por client prediction, server authority y presentation adapters
 * do-not: NO mutar estado, NO visuals, NO DOM
 */
(function(root){
  'use strict';
  const VERSION='combat-schema-v2.0.0-pvp-bible';
  const EVENTS=Object.freeze({
    ATTACK_REQUESTED:'combat:attack_requested',
    ATTACK_STARTED:'combat:attack_started',
    ATTACK_ACTIVE:'combat:attack_active',
    ATTACK_RESOLVED:'combat:attack_resolved',
    ATTACK_MISSED:'combat:attack_missed',
    HIT_CONFIRMED:'combat:hit_confirmed',
    DAMAGE_APPLIED:'combat:damage_applied',
    DAMAGE_BLOCKED:'combat:damage_blocked',
    SHIELD_ABSORBED:'combat:shield_absorbed',
    CC_APPLIED:'combat:cc_applied',
    CC_REMOVED:'combat:cc_removed',
    DODGE_STARTED:'combat:dodge_started',
    DODGE_ENDED:'combat:dodge_ended',
    ENTITY_KILLED:'combat:entity_killed',
    ATTACK_REJECTED:'combat:attack_rejected'
  });
  const ATTACK_KINDS=Object.freeze(['melee','projectile','instant','area','status','dodge','special']);
  const DAMAGE_TYPES=Object.freeze(['physical','fire','ice','lightning','shadow','poison','bleed','true']);
  const CC_TYPES=Object.freeze(['stun','root','slow','silence','knockback','stagger','invulnerable','burn','poison','bleed','movement_buff','damage_buff','damage_debuff']);
  function isAttackKind(value){return ATTACK_KINDS.indexOf(String(value||''))>=0;}
  function isDamageType(value){return DAMAGE_TYPES.indexOf(String(value||''))>=0;}
  function isCcType(value){return CC_TYPES.indexOf(String(value||''))>=0;}
  root.KELO_COMBAT_SCHEMA_AUDIT={version:VERSION,ready:true,singleSource:true,eventCount:Object.keys(EVENTS).length,ccTypes:CC_TYPES.length};
  root.KeloCombatSchema=Object.freeze({version:VERSION,events:EVENTS,attackKinds:ATTACK_KINDS,damageTypes:DAMAGE_TYPES,ccTypes:CC_TYPES,isAttackKind,isDamageType,isCcType});
})(typeof globalThis!=='undefined'?globalThis:window);
