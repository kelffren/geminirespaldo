/* KELO-INDEX
 * area: QA / AVATAR
 * owner: FOUNDATION CI
 * keys: AVATAR RENDER BASE MIDDLEWARE FALLBACK CONTRACT
 * purpose: valida KeloAvatar como único owner de renderAvatar y conserva el orden de fallback LIVE
 * public-api: CLI
 * consumes: avatar owner, engines d/e/w/ab, character-appearance, armor-aura, visual-integration, index.html
 * state-owned: ninguno
 * extension-points: invariantes pequeñas del contrato Avatar
 * reuse: Foundation CI
 * legacy: simula la cadena histórica sin Canvas real
 * do-not: no sustituir smoke browser visual
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/avatar-render-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-d.js','engine-e.js','engine-w.js','engine-ab.js','src/characters/character-appearance.js','src/systems/armor-aura.js','src/visuals/visual-integration.js'];
const trace=[];
const context={console,renderAvatar:function(){trace.push('engine-c');return 'engine-c';}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'avatar-render-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
function directAvatarAssignment(text){return /\b(?:window\.|globalThis\.|root\.)renderAvatar\s*=/.test(text)||/(?:^|[;{}]|\))\s*renderAvatar\s*=/m.test(text);}
ok(context.KeloAvatar&&context.KELO_AVATAR_RENDER_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloAvatar.setBase('engine-d',()=>{trace.push('d');return 'd';});
context.KeloAvatar.setBase('engine-e',()=>{trace.push('e');return 'e';});
context.KeloAvatar.setBase('engine-w',()=>{trace.push('w');return 'w';});
let heroReady=false,appearanceReady=false;
context.KeloAvatar.use('engine-ab',(actor,isSelf,next)=>{trace.push('ab');return heroReady?'ab':next();},100);
context.KeloAvatar.use('appearance',(actor,isSelf,next)=>{trace.push('appearance');return appearanceReady?'appearance':next();},200);
context.KeloAvatar.use('armor',(actor,isSelf,next)=>{trace.push('armor-back');const out=next();trace.push('armor-front');return out;},300);
context.KeloAvatar.use('visual',(actor,isSelf,next)=>{trace.push('visual-back');const out=next();trace.push('visual-front');return out;},400);
trace.length=0;let out=context.renderAvatar({},true);
ok(out==='w'&&trace.join('|')==='visual-back|armor-back|appearance|ab|w|armor-front|visual-front','FALLBACK_ORDER');
heroReady=true;trace.length=0;out=context.renderAvatar({},true);
ok(out==='ab'&&trace.join('|')==='visual-back|armor-back|appearance|ab|armor-front|visual-front','HERO_OVERRIDE');
appearanceReady=true;trace.length=0;out=context.renderAvatar({},true);
ok(out==='appearance'&&trace.join('|')==='visual-back|armor-back|appearance|armor-front|visual-front','APPEARANCE_OVERRIDE');
const snap=context.KeloAvatar.snapshot();
ok(snap.baseOwner==='engine-w','LAST_BASE_WINS');
ok(snap.middleware.every((entry,index)=>index===0||snap.middleware[index-1].priority>=entry.priority),'MIDDLEWARE_PRIORITY_DESC');
const owners=new Set(snap.middleware.map(x=>x.owner));
for(const owner of ['visual','armor','appearance','main-hero:base-zoo','engine-ab'])ok(owners.has(owner),'MIDDLEWARE_OWNER_'+owner);
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!directAvatarAssignment(text),file+'_MUST_NOT_ASSIGN_RENDER_AVATAR');});
ok(fs.readFileSync('engine-d.js','utf8').includes("KeloAvatar.setBase('engine-d:rank-jewels'"),'ENGINE_D_BASE');
ok(fs.readFileSync('engine-e.js','utf8').includes("KeloAvatar.setBase('engine-e:identity-jewels'"),'ENGINE_E_BASE');
ok(fs.readFileSync('engine-w.js','utf8').includes("KeloAvatar.setBase('engine-w:legacy-pixel-hero'"),'ENGINE_W_BASE');
ok(fs.readFileSync('engine-ab.js','utf8').includes("KeloAvatar.use('engine-ab:production-hero'")&&fs.readFileSync('engine-ab.js','utf8').includes(', 100);'),'ENGINE_AB_MIDDLEWARE');
ok(fs.readFileSync('src/characters/character-appearance.js','utf8').includes("KeloAvatar.use('character-appearance:custom-sprite'")&&fs.readFileSync('src/characters/character-appearance.js','utf8').includes(', 200);'),'APPEARANCE_MIDDLEWARE');
ok(fs.readFileSync('src/systems/armor-aura.js','utf8').includes("KeloAvatar.use('armor-aura:actor-shell'")&&fs.readFileSync('src/systems/armor-aura.js','utf8').includes(',300);'),'ARMOR_AURA_MIDDLEWARE');
ok(fs.readFileSync('src/visuals/visual-integration.js','utf8').includes("KeloAvatar.use('visual-integration:actor-fx-transform'")&&fs.readFileSync('src/visuals/visual-integration.js','utf8').includes('}, 400);'),'VISUAL_INTEGRATION_MIDDLEWARE');
const iC=html.indexOf('engine-c.js');const iA=html.indexOf('src/core/avatar-render-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iA>iC&&iD>iA,'LOAD_ORDER');
console.log('AVATAR_RENDER_OK: single owner + ordered visual middleware + conditional fallback chain passed');
