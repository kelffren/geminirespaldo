'use strict';
const fs=require('fs');
const vm=require('vm');
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1;}else console.log('PASS:',msg);}
function compile(path){try{new Function(read(path));assert(true,path+' parses');}catch(error){assert(false,path+' parses: '+error.message);}}

const paths={
  schema:'src/characters/character-slot-schema.js',core:'src/characters/character-customization.js',presets:'src/characters/character-visual-presets.js',
  packs:'src/characters/character-content-packs.js',stack:'src/characters/character-visual-stack.js',kit:'src/characters/character-demo-kit.js',
  preview:'src/ui/character-customizer-preview.js',ui:'src/ui/character-customizer-ui.js',profile:'src/ui/profile-panel-close.js',self:'src/ui/self-interaction-ui.js'
};
Object.values(paths).forEach(compile);
const schema=read(paths.schema),core=read(paths.core),presets=read(paths.presets),packs=read(paths.packs),stack=read(paths.stack),kit=read(paths.kit),preview=read(paths.preview),ui=read(paths.ui),profile=read(paths.profile),self=read(paths.self);

const expected=['body','skinTone','face','eyes','eyebrows','nose','mouth','hair','facialHair','torso','legs','feet','gloves','head','faceAccessory','armor','back','weaponMain','weaponSecondary','accessory1','accessory2','aura','weaponSkin','characterFX'];
expected.forEach(s=>assert(schema.includes("'"+s+"'"),'schema declares slot '+s));
const schemaFaceOrder=(schema.match(/const FACE_ORDER[\s\S]*?const SLOT_GROUPS/)||[''])[0];
expected.forEach(s=>assert(schemaFaceOrder.includes("'"+s+"'"),'directional order includes '+s));
assert(schema.includes("const VERSION = 'character-slot-schema-v2.0.0'"),'slot schema is V2');
assert(schema.includes("appearance:Object.freeze(['body','skinTone','face','eyes','eyebrows','nose','mouth','hair','facialHair'])"),'appearance group owns facial slots');
assert(schema.includes('isRequiredAppearance'),'schema exposes required-base policy');
assert(!/\.hp\s*=|\.damage\s*=|basicCooldown\s*=|attackPower\s*=/.test(schema),'slot schema stays gameplay-stat free');

assert(core.includes('const Schema = root.KeloCharacterSlotSchema'),'customization consumes shared slot schema');
assert(core.includes("const NETWORK_SCHEMA = 'kelo-character-visual-v2'"),'network snapshot schema is V2');
assert(core.includes("const LEGACY_NETWORK_SCHEMA = 'kelo-character-visual-v1'"),'legacy V1 network payload remains accepted');
assert(core.includes('palettes:Object.freeze')&&core.includes('function registerPalette(')&&core.includes('function setPalette('),'core owns reusable palette selection');
assert(core.includes('paletteImageCache')&&core.includes('source +')===false,'palette cache exists without source-string mutation');
assert(core.includes('function undo(')&&core.includes('function redo(')&&core.includes('HISTORY_LIMIT = 40'),'bounded undo/redo exists');
assert(core.includes('function randomize(')&&core.includes('lockedSlots'),'smart randomizer accepts slot locks');
assert(core.includes('SAVE_SLOT_COUNT = 5')&&core.includes('saveProfile')&&core.includes('loadProfile')&&core.includes('deleteProfile'),'five visual save slots exist');
assert(core.includes("const SHARE_PREFIX = 'KW2'")&&core.includes('checksum(')&&core.includes('decodeCode')&&core.includes('importCode'),'versioned checksummed share/import code exists');
assert(core.includes("root.KeloAvatar.use('character-customization:modular-layers'")&&core.includes(', 250);'),'modular layers extend KeloAvatar at priority 250');
assert(!/renderAvatar\s*=\s*function|renderAvatar\s*=\s*\(/.test(core),'customization does not wrap renderAvatar directly');
assert(!/\.hp\s*=|\.damage\s*=|basicCooldown\s*=|attackPower\s*=/.test(core),'customization stays gameplay-stat free');
assert(core.includes('KeloAnimation.sampleTransform')&&core.includes('KeloAnchors.get'),'modular layers reuse shared actor transforms/sockets');

assert(presets.includes("version:'kelo-character-asset-v1'")&&presets.includes('width:512')&&presets.includes('height:768')&&presets.includes('width:128')&&presets.includes('height:192'),'asset contract freezes 512x768 / 128x192 4x4 layout');
assert(presets.includes('function palette(')&&presets.includes("factories:Object.freeze(['source','sheet','socket','weapon','palette'])"),'visual factories include reusable palette descriptor');
assert(packs.includes('presets:Object.freeze')&&packs.includes('palettes:Object.freeze'),'content packs support presets and palettes declaratively');
assert(!packs.includes('setInterval('),'content pack registry does not poll');
assert(stack.includes('paletteId')&&stack.includes('revisionCache:true'),'visual stack is palette-aware and revision-cached');
assert(stack.includes("const UP_BACK_SLOTS = new Set(['back','weaponSecondary','weaponMain','weaponSkin'])"),'visual stack still owns UP depth policy');
assert(!stack.includes('drawImage('),'visual stack remains a pure resolver');

assert(preview.includes('KeloCharacterVisualStack')&&preview.includes("VALID_FACES = ['down','left','right','up']"),'preview uses shared stack and four faces');
assert(preview.includes("motion:'idle'")&&preview.includes("String(motion) === 'walk'")&&preview.includes('requestAnimationFrame(loop)'),'preview exposes real idle/walk without timer polling');
assert(preview.includes('previewSource')&&preview.includes('entry.paletteId'),'preview consumes palette-resolved source');
assert(!preview.includes('MutationObserver'),'preview avoids DOM-wide observer');
assert(ui.includes("tabs:['appearance','clothing','equipment','cosmetics']"),'UI exposes appearance / clothing / equipment / cosmetics');
assert(ui.includes('KeloInputLocks')&&ui.includes('locks.acquire')&&ui.includes('locks.release'),'UI uses token input owner');
assert(!/KELO_MODAL_INPUT_LOCK\s*=/.test(ui),'UI has zero direct legacy modal writes');
assert(!ui.includes('openSocialTool=')&&!ui.includes('MutationObserver'),'customizer no longer monkey-patches profile route or installs observer');
assert(ui.includes('data-kc-face')&&ui.includes('data-kc-motion')&&ui.includes('data-kc-lock'),'UI exposes directional preview and randomizer locks');
assert(ui.includes('data-kc-save')&&ui.includes('data-kc-import')&&ui.includes('data-kc-undo'),'UI exposes save/import/undo controls');
assert(self.includes('KeloCharacterCustomizer')&&self.includes('profileUsesCharacterCustomizer:true'),'self profile routes through existing customizer API');

const bootOrder=['character-slot-schema.js?v=2','character-customization.js?v=6','character-visual-presets.js?v=3','character-content-packs.js?v=2','character-visual-stack.js?v=3','character-demo-kit.js?v=3','character-customizer-ui.js?v=3','character-customizer-preview.js?v=3'].map(x=>profile.indexOf(x));
assert(bootOrder.every(x=>x>=0)&&bootOrder.every((x,i)=>i===0||x>bootOrder[i-1]),'bootstrap loads V2 schema -> core -> factories -> packs -> stack -> content -> UI -> preview');

// Execute the pure/domain slice in a fake browser to test real operations rather than regex only.
const listeners=new Map();
const storage=new Map();
const middleware=[];
const context={console,performance:{now:()=>0},setTimeout:()=>0,clearTimeout:()=>{},TextEncoder,TextDecoder,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init&&init.detail;}},
  localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
  dispatchEvent:event=>{(listeners.get(event.type)||[]).slice().forEach(fn=>fn(event));return true;},
  Image:class Image{set src(v){this._src=v;}get src(){return this._src;}},
  document:{createElement:()=>({width:0,height:0,getContext:()=>null})},
  KeloAvatar:{use:(owner,fn,priority)=>{middleware.push({owner,fn,priority});return 'mw-'+middleware.length;}},
  KeloEquipment:null,KeloAnimation:null,KeloAnchors:null
};
context.globalThis=context;context.window=context;
vm.createContext(context);
function run(path){vm.runInContext(read(path),context,{filename:path});}
try{
  run(paths.schema);run(paths.presets);run(paths.core);run(paths.stack);run(paths.packs);run(paths.kit);
  const S=context.KeloCharacterSlotSchema,A=context.KeloCharacterCustomization,Stack=context.KeloCharacterVisualStack;
  assert(S.slots.length===24&&A.slots.length===24,'runtime exposes exactly 24 shared slots');
  assert(middleware.some(x=>x.owner==='character-customization:modular-layers'&&x.priority===250),'runtime registers modular KeloAvatar middleware');
  assert(A.listPresets().length===4,'starter content registers four editable presets');
  assert(A.listPalettes('skinTone').length===8,'starter content registers eight skin palettes');
  assert(A.listPalettes('hair').length===6,'starter content registers six hair palettes');
  assert(A.listPalettes('eyes').length===5,'starter content registers five eye palettes');
  assert(A.applyPreset('preset_kelo_natural').ok,'preset applies through owner API');
  let st=A.getState();
  assert(st.slots.eyebrows==='eyebrows_soft_01'&&st.slots.nose==='nose_small_01'&&st.slots.mouth==='mouth_neutral_01','preset fills new facial slots');
  assert(st.palettes.skinTone==='skin_warm'&&st.palettes.hair==='hair_black','preset applies palette IDs');
  const lockedBefore=st.slots.hair;
  const rand=A.randomize({group:'appearance',lockedSlots:['hair'],rng:()=>0.999});
  assert(rand.ok&&A.getState().slots.hair===lockedBefore,'randomizer honors locked hair slot');
  assert(A.canUndo()&&A.undo().ok&&A.canRedo()&&A.redo().ok,'undo and redo traverse committed appearance changes');
  const beforeSave=A.getState();
  assert(A.saveProfile(1,'Audit Hero').ok,'visual save slot writes');
  A.applyPreset('preset_kelo_sharp');
  assert(A.loadProfile(1).ok&&A.getState().slots.hair===beforeSave.slots.hair,'saved profile restores visual state');
  const code=A.exportCode();
  assert(/^KW2\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/.test(code),'share code format is compact/versioned/checksummed');
  const decoded=A.decodeCode(code);
  assert(decoded.ok&&!decoded.warnings.length,'own share code validates cleanly');
  assert(!A.decodeCode(code.slice(0,-1)+'0').ok,'corrupted share code is rejected');
  assert(A.importCode(code).ok,'validated share code imports through owner API');
  const net=A.networkSnapshot();
  assert(net.schema==='kelo-character-visual-v2'&&net.palettes&&net.slots,'network snapshot sends visual IDs + palettes only');
  const remote={id:'remote-a'};
  assert(A.applyRemote(remote,net)===true,'V2 remote visual snapshot applies');
  const legacy={schema:'kelo-character-visual-v1',mode:'modular',baseAppearanceId:'player_hero_v1',outfitId:null,slots:{body:'body_legacy_hero',skinTone:'skin_default',face:'face_default',eyes:'eyes_default'},revision:1};
  const remoteLegacy={id:'remote-legacy'};
  assert(A.applyRemote(remoteLegacy,legacy)===true&&A.stateForActor(remoteLegacy).slots.eyebrows==='eyebrows_default','legacy V1 remote state normalizes new facial slots');
  const entries=Stack.resolve({state:A.getState(),face:'up'});
  assert(entries.every(e=>Object.prototype.hasOwnProperty.call(e,'paletteId')),'visual stack entries carry resolved palette IDs');
}catch(error){assert(false,'domain runtime audit executes: '+(error&&error.stack||error));}

assert(fs.existsSync('docs/systems/CHARACTER_CUSTOMIZATION_SYSTEM.md'),'technical system documentation exists');
const catalog=read('docs/system-catalog.json');
assert(catalog.includes('"id": "character-customization"')&&catalog.includes('CHARACTER_CUSTOMIZATION_SYSTEM.md'),'system catalog registers Character Customization');

if(process.exitCode){console.error('\nCharacter Creator V2 audit FAILED');process.exit(process.exitCode);}else console.log('\nCharacter Creator V2 audit OK');
