'use strict';
const crypto=require('crypto');
const {createPlayerEconomyStore,DEFAULT_SLOTS}=require('./player-economy-store');
const SLOTS=DEFAULT_SLOTS;
const QUALITY_MULTIPLIER={1:1,2:1.05,3:1.10,4:1.17,5:1.25,6:1.35,7:1.47,8:1.62,9:1.80};
const GRADE_ARMOR_POINTS={1:0,2:20,3:40,4:70,5:110,6:170,7:260,8:400,9:650};
const GRADE_SPECIAL_MULTIPLIER={1:1,2:1.05,3:1.10,4:1.17,5:1.25,6:1.35,7:1.50,8:1.70,9:2};
const AURA_THRESHOLDS=[0,330,475,750,950,1350,1720,2225,3860,5250];
const BASE_CHANCE={2:100,3:90,4:80,5:68,6:55,7:42,8:28,9:15};
const MATERIAL_BONUS={1:0,2:8,3:16,4:24};
const CRYSTAL_BONUS={1:2,2:4,3:8,4:12};
const GOLD_COST={2:500,3:1000,4:2500,5:5000,6:10000,7:25000,8:60000,9:150000};
const FAMILY_BY_TYPE={level:'ruby',quality:'sapphire',grade:'emerald'};
function clampTier(v){v=Math.floor(Number(v));if(!Number.isFinite(v))throw new Error('INVALID_TIER');return Math.max(1,Math.min(9,v));}
function auraRank(score){score=Math.max(0,Math.floor(Number(score)||0));let r=0;for(let i=1;i<AURA_THRESHOLDS.length;i++)if(score>=AURA_THRESHOLDS[i])r=i;return r;}
function calcChance(currentTier,materialLevel,crystals){const next=clampTier(currentTier)+1;if(next>9)return 0;const ml=Math.floor(Number(materialLevel));if(ml<1||ml>4)throw new Error('INVALID_MATERIAL_LEVEL');if(!Array.isArray(crystals))crystals=[];if(crystals.length>25)throw new Error('TOO_MANY_CRYSTALS');let c=(BASE_CHANCE[next]||0)+(MATERIAL_BONUS[ml]||0);for(const raw of crystals){const l=Math.floor(Number(raw));if(l<1||l>4)throw new Error('INVALID_CRYSTAL');c+=CRYSTAL_BONUS[l]||0;}return Math.max(0,Math.min(100,c));}
function publicSnapshot(p){const equipped=Object.values(p.equipment).filter(x=>x.equipped);const armorScore=equipped.reduce((s,x)=>s+(GRADE_ARMOR_POINTS[clampTier(x.grade)]||0),0);const averageQuality=equipped.length?equipped.reduce((s,x)=>s+clampTier(x.quality),0)/equipped.length:0;const averageGrade=equipped.length?equipped.reduce((s,x)=>s+clampTier(x.grade),0)/equipped.length:0;return{gold:p.gold,inventory:{...p.inventory},equipment:equipped.map(x=>({...x})),armorScore,auraRank:auraRank(armorScore),averageQuality,averageGrade,equipmentSummary:equipped.map(x=>({slot:x.slot,itemLevel:x.itemLevel,quality:x.quality,grade:x.grade}))};}
function createForgeService(opts={}){
  const economy=opts.economyStore||createPlayerEconomyStore(opts),source=economy.source;
  async function ready(id){if(typeof economy.hydrate==='function')await economy.hydrate(id);return economy.ensure(id);}
  async function durable(id){if(typeof economy.flush==='function')await economy.flush(id);}
  return{
    source,economyStore:economy,
    ensurePlayer:async id=>publicSnapshot(await ready(id)),
    snapshot:async id=>publicSnapshot(await ready(id)),
    attempt:async function(id,input){
      const p=await ready(id),itemId=String(input.itemId||''),item=p.equipment[itemId];if(!item||item.owner!==id)throw new Error('ITEM_NOT_OWNED');
      const type=['level','quality','grade'].includes(input.forgeType)?input.forgeType:null;if(!type)throw new Error('INVALID_FORGE_TYPE');const current=type==='level'?Math.floor(Number(item.itemLevel)||1):clampTier(item[type]);if(current>=9)throw new Error('MAX_TIER');
      const ml=Math.floor(Number(input.materialLevel));if(ml<1||ml>4)throw new Error('INVALID_MATERIAL_LEVEL');const crystals=Array.isArray(input.crystals)?input.crystals.slice():[];if(crystals.length>25)throw new Error('TOO_MANY_CRYSTALS');const materialId=FAMILY_BY_TYPE[type]+'_'+ml;if((p.inventory[materialId]||0)<1)throw new Error('MATERIAL_REQUIRED');
      const needs={};crystals.forEach(raw=>{const l=Math.floor(Number(raw));if(l<1||l>4)throw new Error('INVALID_CRYSTAL');const cid='forge_crystal_'+l;needs[cid]=(needs[cid]||0)+1;});Object.keys(needs).forEach(cid=>{if((p.inventory[cid]||0)<needs[cid])throw new Error('CRYSTAL_REQUIRED');});
      const next=current+1,cost=GOLD_COST[next]||0;if(p.gold<cost)throw new Error('INSUFFICIENT_GOLD');const chance=calcChance(current,ml,crystals);p.inventory[materialId]-=1;Object.keys(needs).forEach(cid=>{p.inventory[cid]-=needs[cid];});p.gold-=cost;const roll=crypto.randomInt(0,1000000)/10000,success=roll<chance;if(success){if(type==='level')item.itemLevel=next;else item[type]=next;}
      const row={at:Date.now(),itemId,type,fromTier:current,toTier:next,chance,roll,success,cost};p.history.unshift(row);p.history=p.history.slice(0,100);await durable(id);const snap=publicSnapshot(p);return{success,chance,roll:+roll.toFixed(2),item:{...item},gold:p.gold,inventory:{...p.inventory},armorScore:snap.armorScore,auraRank:snap.auraRank,averageQuality:snap.averageQuality,averageGrade:snap.averageGrade,equipmentSummary:snap.equipmentSummary};
    },
    combine:async function(id,materialId){const p=await ready(id),m=/^(ruby|sapphire|emerald|forge_crystal)_([1-4])$/.exec(String(materialId||''));if(!m)throw new Error('INVALID_MATERIAL');const level=Number(m[2]);if(level>=4)throw new Error('MAX_MATERIAL_LEVEL');if((p.inventory[materialId]||0)<6)throw new Error('NEED_SIX');const to=m[1]+'_'+(level+1);p.inventory[materialId]-=6;p.inventory[to]=(p.inventory[to]||0)+1;await durable(id);return publicSnapshot(p);},
    _debugPlayer:id=>economy.ensure(id)
  };
}
module.exports={createForgeService,calcChance,auraRank,CONFIG:{SLOTS,QUALITY_MULTIPLIER,GRADE_ARMOR_POINTS,GRADE_SPECIAL_MULTIPLIER,AURA_THRESHOLDS,BASE_CHANCE,MATERIAL_BONUS,CRYSTAL_BONUS,GOLD_COST}};
