/* KELO-INDEX
 * area: QA / SERVER PERSISTENCE
 * owner: Online Production Activation CI
 * keys: SUPABASE EDGE PERSISTENCE ECONOMY FORGE TITLES NOBILITY LEGACY FALLBACK
 * purpose: smoke determinista del bridge durable y de los stores autoritativos sin tocar servicios externos reales
 * do-not: NO usar credenciales reales, NO sustituir tests end-to-end de producción
 */
'use strict';
const assert=require('assert');
const http=require('http');
const {createServerStateBridge}=require('./server-state-bridge');
const {createPlayerEconomyStore,seedPlayer}=require('./player-economy-store');
const {createForgeService}=require('./forge-store');
const {createTitleService}=require('./title-store');
const {createNobilityService}=require('./nobility-store');

const CHARACTER='11111111-1111-4111-8111-111111111111';
const LEGACY='22222222-2222-4222-8222-222222222222';
const SERVER_KEY='test-only-server-key';
const states=new Map(),nobility=new Map();
const active=new Set([CHARACTER]);

function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});req.on('error',reject);});}
function reply(res,status,data){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers['x-kelo-server-key']!==SERVER_KEY)return reply(res,401,{ok:false,code:'SERVER_AUTH_REQUIRED'});
    const msg=await body(req),id=String(msg.characterId||'');if(!active.has(id))return reply(res,404,{ok:false,code:'CHARACTER_NOT_FOUND'});
    if(msg.op==='load')return reply(res,200,{ok:true,snapshot:states.get(id)||null});
    if(msg.op==='save'){
      const prior=states.get(id)||{character_id:id,revision:0,payload:{}};
      const snapshot={character_id:id,revision:prior.revision+1,schema_version:1,zone_key:'server-authoritative',payload:{...(prior.payload||{}),...(msg.state||{})},updated_at:new Date().toISOString()};states.set(id,snapshot);return reply(res,200,{ok:true,snapshot});
    }
    if(msg.op==='nobility:ensure'){
      let row=nobility.get(id);if(!row){row={player_id:id,name:String(msg.name||'Kelo'),gold:1500,kc:200,donation:0,donated_today:0,donation_day:new Date().toISOString().slice(0,10)};nobility.set(id,row);}return reply(res,200,{ok:true,row:{...row}});
    }
    if(msg.op==='nobility:get')return reply(res,200,{ok:true,row:nobility.get(id)||null});
    if(msg.op==='nobility:top')return reply(res,200,{ok:true,rows:[...nobility.values()].sort((a,b)=>b.donation-a.donation).slice(0,Number(msg.limit)||60).map(x=>({...x}))});
    if(msg.op==='nobility:donate'){
      const row=nobility.get(id);if(!row)return reply(res,400,{ok:false,code:'PLAYER_NOT_FOUND'});const value=Math.floor(Number(msg.amount));let added=value;if(msg.currency==='gold'){if(row.gold<value)return reply(res,400,{ok:false,code:'INSUFFICIENT_GOLD'});row.gold-=value;}else if(msg.currency==='kc'){if(row.kc<value)return reply(res,400,{ok:false,code:'INSUFFICIENT_KC'});row.kc-=value;added=value*50000;}row.donation+=added;row.donated_today+=added;return reply(res,200,{ok:true,row:{...row,donation_added:added}});
    }
    return reply(res,400,{ok:false,code:'UNKNOWN_OPERATION'});
  }catch(error){reply(res,500,{ok:false,code:String(error.message||error)});}
});

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address(),bridge=createServerStateBridge({url:`http://127.0.0.1:${port}`,serverKey:SERVER_KEY});
  assert.equal(bridge.configured,true);

  const seeded=seedPlayer(CHARACTER);seeded.gold=123456;seeded.inventory.ruby_1=7;
  states.set(CHARACTER,{character_id:CHARACTER,revision:1,payload:{economy:seeded}});
  const economy=createPlayerEconomyStore({persistenceBridge:bridge});
  const hydrated=await economy.hydrate(CHARACTER);assert.equal(hydrated.gold,123456);assert.equal(hydrated.inventory.ruby_1,7);
  hydrated.gold=123000;await economy.flush(CHARACTER);assert.equal(states.get(CHARACTER).payload.economy.gold,123000);

  const forge=createForgeService({economyStore:economy});const forgeSnap=await forge.snapshot(CHARACTER);assert.equal(forgeSnap.gold,123000);

  const titles=createTitleService({persistenceBridge:bridge});await titles.ensurePlayer(CHARACTER);
  await titles._adapter.savePlayer(CHARACTER,{progress:{openWorldPlayerKills:3},unlocked:[],equipped_title_id:null,kill_ledger:[]});
  assert.equal(states.get(CHARACTER).payload.titles.progress.openWorldPlayerKills,3);

  await Promise.all([bridge.save(CHARACTER,{serverMeta:{a:1}}),bridge.save(CHARACTER,{serverMeta:{b:2}})]);
  assert.equal(states.get(CHARACTER).payload.economy.gold,123000);assert.ok(states.get(CHARACTER).payload.titles);

  const nobleza=createNobilityService({persistenceBridge:bridge});const durable=await nobleza.snapshot(CHARACTER,'Kelo');assert.equal(durable.source,'supabase-edge-hybrid');
  const donated=await nobleza.donate(CHARACTER,'Kelo','gold',100);assert.equal(donated.donationAdded,100);assert.equal(nobility.get(CHARACTER).gold,1400);
  const legacy=await nobleza.snapshot(LEGACY,'Legacy');assert.equal(legacy.source,'supabase-edge-hybrid');assert.equal(legacy.wallet.gold,1500);

  const legacyTitles=createTitleService({persistenceBridge:bridge});const legacyTitleSnap=await legacyTitles.snapshot(LEGACY);assert.equal(legacyTitleSnap.source,'supabase-edge-hybrid');

  const audit=economy.auditPersistence();assert.equal(audit.configured,true);assert.ok(audit.loads>=1);assert.ok(audit.saves>=1);
  console.log('persistence smoke ok');
}
main().then(()=>server.close()).catch(error=>{console.error(error);server.close(()=>process.exit(1));});
