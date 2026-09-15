'use strict';
const fs=require('fs');
function read(path){return fs.readFileSync(path,'utf8');}
function assert(ok,message){if(!ok){console.error('FAIL:',message);process.exitCode=1;}else console.log('PASS:',message);}
const schema=read('src/characters/character-slot-schema.js');
const kit=read('src/characters/character-demo-kit.js');
const presets=read('src/characters/character-visual-presets.js');
const packs=read('src/characters/character-content-packs.js');
const preview=read('src/ui/character-customizer-preview.js');
const bootstrap=read('src/ui/profile-panel-close.js');

const appearanceAssets=['skin-base.svg','face-soft.svg','face-angular.svg','eyes-round.svg','eyes-sharp.svg','eyebrows-soft.svg','eyebrows-bold.svg','nose-small.svg','nose-straight.svg','mouth-neutral.svg','mouth-smile.svg','hair-messy.svg','hair-short.svg'];
const vanguardSheetAssets=['vanguard-torso.svg','vanguard-legs.svg','vanguard-feet.svg','vanguard-crown.svg','night-visor.svg'];
const weaponAssets=['solar-saber.svg','onyx-katana.svg'];
const appearanceIds=['skin_base_01','face_soft_01','face_angular_01','eyes_round_01','eyes_sharp_01','eyebrows_soft_01','eyebrows_bold_01','nose_small_01','nose_straight_01','mouth_neutral_01','mouth_smile_01','hair_messy_01','hair_short_01'];
const vanguardIds=['torso_kelo_vanguard','legs_kelo_vanguard','feet_kelo_vanguard','head_vanguard_crown','head_night_visor','weapon_solar_saber','weapon_onyx_katana','outfit_kelo_vanguard'];
const presetIds=['preset_kelo_natural','preset_kelo_sharp','preset_kelo_silver','preset_kelo_bronze'];
appearanceIds.concat(vanguardIds,presetIds).forEach(id=>assert(kit.includes(id),'starter kit declares '+id));

assert(schema.includes("eyebrows")&&schema.includes("nose")&&schema.includes("mouth"),'starter kit facial slots exist in shared schema');
assert(kit.includes("id:'kelo-character-starter-v2'")&&kit.includes('Packs.define({'),'starter content is one declarative named pack');
assert(kit.includes('palettes:palettes')&&kit.includes('presets:['),'pack declares palettes and presets as data');
assert(kit.includes("skinPalette('skin_porcelain'")&&kit.includes("skinPalette('skin_umber'"),'starter has 8 skin palette endpoints');
assert((kit.match(/skinPalette\('/g)||[]).length===8,'starter declares exactly 8 skin palettes');
assert((kit.match(/hairPalette\('/g)||[]).length===6,'starter declares exactly 6 hair palettes');
assert((kit.match(/eyePalette\('/g)||[]).length===5,'starter declares exactly 5 eye palettes');
assert((kit.match(/id:'preset_kelo_/g)||[]).length===4,'starter declares 4 editable appearance presets');
assert(kit.includes("defaultPaletteId:'skin_warm'")&&kit.includes("defaultPaletteId:'hair_black'")&&kit.includes("defaultPaletteId:'eyes_slate'"),'recolorable starter pieces define safe default palettes');
assert(!kit.includes('setInterval(')&&!packs.includes('setInterval('),'content registration uses no polling loop');
assert(!/\.hp\s*=|\.damage\s*=|cooldown\s*=|attackPower\s*=/.test(kit),'starter kit contains no gameplay stat mutation');

assert(presets.includes("version:'kelo-character-asset-v1'")&&presets.includes('width:512')&&presets.includes('height:768'),'shared asset contract is explicit');
appearanceAssets.concat(vanguardSheetAssets).forEach(name=>{
  const path='src/characters/customization-assets/'+name;
  assert(fs.existsSync(path),name+' exists');
  if(!fs.existsSync(path))return;
  const svg=read(path);
  assert(/<svg[^>]+width="512"[^>]+height="768"/.test(svg),name+' uses canonical 512x768 actor sheet');
  assert((svg.match(/<use\b/g)||[]).length===16,name+' explicitly covers all 16 grid frames');
  assert(svg.includes('shape-rendering="crispEdges"'),name+' requests crisp pixel sampling');
  assert(!/<rect[^>]+(?:width="512"|width="100%")/i.test(svg),name+' has no full-sheet background rectangle');
});
weaponAssets.forEach(name=>{
  const path='src/characters/customization-assets/'+name;
  assert(fs.existsSync(path),name+' exists');
  if(!fs.existsSync(path))return;
  const svg=read(path);
  assert(/<svg[^>]+width="64"[^>]+height="64"/.test(svg),name+' uses compact 64x64 socket canvas');
  assert(svg.includes('shape-rendering="crispEdges"'),name+' keeps crisp pixel sampling');
});
const skin=read('src/characters/customization-assets/skin-base.svg');
['#f1bd8b','#d98f61','#aa5f42'].forEach(c=>assert(skin.toLowerCase().includes(c),'skin base contains controlled palette key '+c));
['hair-messy.svg','hair-short.svg'].forEach(name=>{const svg=read('src/characters/customization-assets/'+name).toLowerCase();['#263341','#17212c','#0b1017'].forEach(c=>assert(svg.includes(c),name+' contains hair palette key '+c));});
['eyes-round.svg','eyes-sharp.svg'].forEach(name=>assert(read('src/characters/customization-assets/'+name).toLowerCase().includes('#4f6680'),name+' contains eye palette key'));

const order=['character-slot-schema.js?v=2','character-customization.js?v=6','character-visual-presets.js?v=3','character-content-packs.js?v=2','character-visual-stack.js?v=3','character-demo-kit.js?v=3','character-customizer-ui.js?v=3','character-customizer-preview.js?v=3'].map(x=>bootstrap.indexOf(x));
assert(order.every(x=>x>=0)&&order.every((x,i)=>i===0||x>order[i-1]),'bootstrap loads V2 foundations before starter content/UI');
assert(preview.includes('KeloCharacterVisualStack')&&!preview.includes('SHEET_SLOTS')&&!preview.includes('state.slots.weaponMain'),'preview is generic and not coupled to starter slots');
assert(preview.includes('image-rendering:pixelated'),'preview preserves pixel-art sampling');
assert(preview.includes("face:'down'")&&preview.includes("motion:'idle'"),'preview starts in deterministic down/idle state');

if(process.exitCode){console.error('\nCharacter Creator V2 starter kit audit FAILED');process.exit(process.exitCode);}else console.log('\nCharacter Creator V2 starter kit audit OK');
