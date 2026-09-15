(function(){
'use strict';

const VERSION='master-bot-pipelines-v1.0.0';
const SOCIAL_PIPELINE=Object.freeze({
  id:'social_master_v1',
  role:'social_master',
  authority:'local-fallback',
  futureAuthority:'server-ai',
  stages:Object.freeze(['perception','social-context','dialogue-policy','response','presentation'])
});
const PVP_PIPELINE=Object.freeze({
  id:'pvp_training_master_v1',
  role:'pvp_master',
  authority:'local-training',
  futureAuthority:'server-ai',
  stages:Object.freeze(['combat-state','target-policy','ability-policy','authority-command','result','presentation'])
});

const socialMasters=Object.freeze([
  Object.freeze({id:'social_master_guide_01',name:'Maestro Social',title:'Guía de Kelo World',pipelineId:SOCIAL_PIPELINE.id,zone:'social',behavior:'future-ai'})
]);

const pvpMasters=Object.freeze([
  Object.freeze({
    id:'pvp_master_hook_01',
    name:'Maestro del Enganche',
    title:'Maestro PvP',
    pipelineId:PVP_PIPELINE.id,
    zone:'pvp_training',
    behavior:'stationary-training',
    hp:1000,
    maxHp:1000,
    radius:20,
    spawnX:3190,
    spawnY:720,
    network:Object.freeze({entityType:'pvp_master',replicationKey:'pvp_master_hook_01',authority:'server-ready'})
  })
]);

window.KeloMasterBots=Object.freeze({
  version:VERSION,
  pipelines:Object.freeze({social:SOCIAL_PIPELINE,pvp:PVP_PIPELINE}),
  socialMasters,
  pvpMasters,
  getPvPMaster:function(id){return pvpMasters.find(function(x){return x.id===id;})||pvpMasters[0];},
  getSocialMaster:function(id){return socialMasters.find(function(x){return x.id===id;})||socialMasters[0];}
});

window.KELO_MASTER_BOT_PIPELINE_AUDIT=Object.freeze({
  version:VERSION,
  separateSocialAndPvPRoles:true,
  serverAuthorityReady:true,
  socialPipeline:SOCIAL_PIPELINE.id,
  pvpPipeline:PVP_PIPELINE.id
});
})();
