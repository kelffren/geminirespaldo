/* KELO-INDEX
 * area: CHARACTERS
 * owner: content only
 * keys: CUSTOMIZATION DEMO KIT APPEARANCE PALETTE PRESET OUTFIT VANGUARD CONTENT PACK
 * purpose: primer vertical slice real de cara/piel/pelo + Vanguard usando las factories/registries compartidas
 * public-api: N/A; registra data declarativa en KeloCharacterContentPacks
 * consumes: KeloCharacterVisualPresets + KeloCharacterContentPacks
 * state-owned: ninguno
 * extension-points: copiar este patrón para nuevos packs sin tocar CharacterCustomization
 * reuse: demuestra piel, ojos, cejas, nariz, boca, pelo, palettes, presets, ropa, equipo y armas
 * legacy: conserva IDs Vanguard v1
 * do-not: NO loaders, polling, stats, inventario ni lógica de render
 * online: solo IDs/metadatos visuales; servidor futuro valida ownership
 */
(function (root) {
  'use strict';

  const VERSION = 'character-demo-kit-v2.0.0';
  const BASE = 'src/characters/customization-assets/';
  const V = root.KeloCharacterVisualPresets;
  const Packs = root.KeloCharacterContentPacks;
  if (!V || !Packs) throw new Error('CHARACTER_CONTENT_FOUNDATION_NOT_LOADED');

  function asset(name) { return V.source(BASE, name, 2); }
  function sheet(name, options) { return V.sheet(asset(name), options || {}); }
  function weapon(name) { return V.weapon(asset(name)); }

  const APPEARANCE_IDS = Object.freeze([
    'skin_base_01','face_soft_01','face_angular_01','eyes_round_01','eyes_sharp_01','eyebrows_soft_01','eyebrows_bold_01',
    'nose_small_01','nose_straight_01','mouth_neutral_01','mouth_smile_01','hair_messy_01','hair_short_01'
  ]);
  const VANGUARD_IDS = Object.freeze([
    'torso_kelo_vanguard','legs_kelo_vanguard','feet_kelo_vanguard','head_vanguard_crown','head_night_visor','weapon_solar_saber','weapon_onyx_katana'
  ]);
  const APPEARANCE_ASSETS = Object.freeze([
    asset('skin-base.svg'),asset('face-soft.svg'),asset('face-angular.svg'),asset('eyes-round.svg'),asset('eyes-sharp.svg'),
    asset('eyebrows-soft.svg'),asset('eyebrows-bold.svg'),asset('nose-small.svg'),asset('nose-straight.svg'),asset('mouth-neutral.svg'),asset('mouth-smile.svg'),
    asset('hair-messy.svg'),asset('hair-short.svg')
  ]);
  const VANGUARD_ASSETS = Object.freeze([
    asset('vanguard-torso.svg'),asset('vanguard-legs.svg'),asset('vanguard-feet.svg'),asset('vanguard-crown.svg'),asset('night-visor.svg'),asset('solar-saber.svg'),asset('onyx-katana.svg')
  ]);

  const skinMap = Object.freeze({ '#f1bd8b':'#f1bd8b','#d98f61':'#d98f61','#aa5f42':'#aa5f42' });
  function skinPalette(id,name,light,base,shadow){return V.palette(id,name,{'#f1bd8b':light,'#d98f61':base,'#aa5f42':shadow},['skinTone'],{swatch:base,tags:['skin']});}
  function hairPalette(id,name,light,base,shadow){return V.palette(id,name,{'#263341':light,'#17212c':base,'#0b1017':shadow},['hair'],{swatch:base,tags:['hair']});}
  function eyePalette(id,name,color){return V.palette(id,name,{'#4f6680':color},['eyes'],{swatch:color,tags:['eyes']});}

  const palettes = [
    skinPalette('skin_porcelain','Porcelana','#ffd9ba','#efb184','#c7795a'),
    skinPalette('skin_warm','Cálida',skinMap['#f1bd8b'],skinMap['#d98f61'],skinMap['#aa5f42']),
    skinPalette('skin_honey','Miel','#e8b77c','#c98552','#92543d'),
    skinPalette('skin_caramel','Caramelo','#d69b66','#ad6d45','#75412f'),
    skinPalette('skin_bronze','Bronce','#bd8256','#91583b','#633728'),
    skinPalette('skin_deep','Profunda','#966347','#704331','#46291f'),
    skinPalette('skin_espresso','Espresso','#76503d','#54372d','#35231e'),
    skinPalette('skin_umber','Umber','#5f4234','#402c25','#281b18'),
    hairPalette('hair_black','Negro','#263341','#17212c','#0b1017'),
    hairPalette('hair_brown','Castaño','#72513f','#4a3229','#281c19'),
    hairPalette('hair_blonde','Rubio','#d7b86c','#a98745','#67532d'),
    hairPalette('hair_silver','Plata','#d1d7de','#8995a1','#4d5963'),
    hairPalette('hair_red','Rojo','#a9533f','#713126','#3e1a17'),
    hairPalette('hair_blue','Azul noche','#355a7b','#213b57','#101f31'),
    eyePalette('eyes_slate','Pizarra','#4f6680'),
    eyePalette('eyes_brown','Marrón','#7b5239'),
    eyePalette('eyes_green','Verde','#50795c'),
    eyePalette('eyes_hazel','Avellana','#8c7544'),
    eyePalette('eyes_blue','Azul','#4d82b6')
  ];

  const pack = Packs.define({
    id:'kelo-character-starter-v2',
    version:VERSION,
    tags:['kelo','starter','modular','appearance','palette','preset','vanguard'],
    palettes:palettes,
    items:[
      {id:'skin_base_01',slot:'skinTone',name:'Piel base',group:'appearance',rarity:'Base',icon:'◉',defaultPaletteId:'skin_warm',tags:['skin','starter'],visual:sheet('skin-base.svg',{paletteRole:'skin'})},
      {id:'face_soft_01',slot:'face',name:'Rostro suave',group:'appearance',rarity:'Base',icon:'◡',tags:['face'],visual:sheet('face-soft.svg')},
      {id:'face_angular_01',slot:'face',name:'Rostro angular',group:'appearance',rarity:'Base',icon:'◇',tags:['face'],visual:sheet('face-angular.svg')},
      {id:'eyes_round_01',slot:'eyes',name:'Ojos redondos',group:'appearance',rarity:'Base',icon:'●',defaultPaletteId:'eyes_slate',tags:['eyes'],visual:sheet('eyes-round.svg',{paletteRole:'eyes'})},
      {id:'eyes_sharp_01',slot:'eyes',name:'Ojos afilados',group:'appearance',rarity:'Base',icon:'◆',defaultPaletteId:'eyes_slate',tags:['eyes'],visual:sheet('eyes-sharp.svg',{paletteRole:'eyes'})},
      {id:'eyebrows_soft_01',slot:'eyebrows',name:'Cejas suaves',group:'appearance',rarity:'Base',icon:'⌒',tags:['eyebrows'],visual:sheet('eyebrows-soft.svg')},
      {id:'eyebrows_bold_01',slot:'eyebrows',name:'Cejas marcadas',group:'appearance',rarity:'Base',icon:'━',tags:['eyebrows'],visual:sheet('eyebrows-bold.svg')},
      {id:'nose_small_01',slot:'nose',name:'Nariz pequeña',group:'appearance',rarity:'Base',icon:'·',tags:['nose'],visual:sheet('nose-small.svg')},
      {id:'nose_straight_01',slot:'nose',name:'Nariz recta',group:'appearance',rarity:'Base',icon:'│',tags:['nose'],visual:sheet('nose-straight.svg')},
      {id:'mouth_neutral_01',slot:'mouth',name:'Boca neutra',group:'appearance',rarity:'Base',icon:'—',tags:['mouth'],visual:sheet('mouth-neutral.svg')},
      {id:'mouth_smile_01',slot:'mouth',name:'Sonrisa',group:'appearance',rarity:'Base',icon:'⌣',tags:['mouth'],visual:sheet('mouth-smile.svg')},
      {id:'hair_messy_01',slot:'hair',name:'Pelo rebelde',group:'appearance',rarity:'Base',icon:'✦',defaultPaletteId:'hair_black',tags:['hair'],visual:sheet('hair-messy.svg',{paletteRole:'hair'})},
      {id:'hair_short_01',slot:'hair',name:'Pelo corto',group:'appearance',rarity:'Base',icon:'✧',defaultPaletteId:'hair_black',tags:['hair'],visual:sheet('hair-short.svg',{paletteRole:'hair'})},
      { id:'torso_kelo_vanguard', slot:'torso', name:'Chaqueta Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit','teal','gold'], visual:sheet('vanguard-torso.svg') },
      { id:'legs_kelo_vanguard', slot:'legs', name:'Pantalón Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-legs.svg') },
      { id:'feet_kelo_vanguard', slot:'feet', name:'Botas Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-feet.svg') },
      { id:'head_vanguard_crown', slot:'head', name:'Corona Vanguard', group:'equipment', rarity:'Épico', icon:'♜', tags:['helmet','vanguard','gold'], visual:sheet('vanguard-crown.svg') },
      { id:'head_night_visor', slot:'head', name:'Visor Nocturno', group:'equipment', rarity:'Épico', icon:'▰', tags:['helmet','visor','night'], visual:sheet('night-visor.svg') },
      { id:'weapon_solar_saber', slot:'weaponMain', name:'Sable Solar', group:'equipment', rarity:'Épico', icon:'†', tags:['weapon','sword','gold'], visual:weapon('solar-saber.svg') },
      { id:'weapon_onyx_katana', slot:'weaponMain', name:'Katana Ónix', group:'equipment', rarity:'Épico', icon:'╱', tags:['weapon','katana','onyx'], visual:weapon('onyx-katana.svg') }
    ],
    outfits:[
      { id:'outfit_kelo_vanguard', name:'Kelo Vanguard', slots:{ torso:'torso_kelo_vanguard', legs:'legs_kelo_vanguard', feet:'feet_kelo_vanguard' } }
    ],
    presets:[
      {id:'preset_kelo_natural',name:'Natural',description:'Rasgos suaves, pelo rebelde y tonos cálidos.',slots:{skinTone:'skin_base_01',face:'face_soft_01',eyes:'eyes_round_01',eyebrows:'eyebrows_soft_01',nose:'nose_small_01',mouth:'mouth_neutral_01',hair:'hair_messy_01'},palettes:{skinTone:'skin_warm',eyes:'eyes_brown',hair:'hair_black'}},
      {id:'preset_kelo_sharp',name:'Sharp',description:'Rostro angular, mirada afilada y pelo corto.',slots:{skinTone:'skin_base_01',face:'face_angular_01',eyes:'eyes_sharp_01',eyebrows:'eyebrows_bold_01',nose:'nose_straight_01',mouth:'mouth_neutral_01',hair:'hair_short_01'},palettes:{skinTone:'skin_honey',eyes:'eyes_green',hair:'hair_brown'}},
      {id:'preset_kelo_silver',name:'Silver',description:'Una base clara con pelo plata y ojos azules.',slots:{skinTone:'skin_base_01',face:'face_soft_01',eyes:'eyes_round_01',eyebrows:'eyebrows_soft_01',nose:'nose_straight_01',mouth:'mouth_smile_01',hair:'hair_messy_01'},palettes:{skinTone:'skin_porcelain',eyes:'eyes_blue',hair:'hair_silver'}},
      {id:'preset_kelo_bronze',name:'Bronze',description:'Tono profundo, ojos avellana y cabello oscuro.',slots:{skinTone:'skin_base_01',face:'face_angular_01',eyes:'eyes_sharp_01',eyebrows:'eyebrows_bold_01',nose:'nose_small_01',mouth:'mouth_smile_01',hair:'hair_short_01'},palettes:{skinTone:'skin_bronze',eyes:'eyes_hazel',hair:'hair_black'}}
    ]
  });

  root.KELO_CHARACTER_DEMO_KIT_AUDIT = Object.freeze({
    version:VERSION,ready:true,packId:pack.id,outfitId:'outfit_kelo_vanguard',
    appearanceIds:APPEARANCE_IDS,vanguardIds:VANGUARD_IDS,pieceIds:Object.freeze(APPEARANCE_IDS.concat(VANGUARD_IDS)),
    appearanceAssets:APPEARANCE_ASSETS,vanguardAssets:VANGUARD_ASSETS,assets:Object.freeze(APPEARANCE_ASSETS.concat(VANGUARD_ASSETS)),
    paletteCount:palettes.length,presetCount:4,declarative:true,sharedVisualFactories:true,sharedPackRegistry:true,statsFree:true,modular:true,assetContract:V.assetContract&&V.assetContract.version
  });
  try { root.dispatchEvent(new CustomEvent('kelo:character-demo-kit-ready', { detail:root.KELO_CHARACTER_DEMO_KIT_AUDIT })); } catch (e) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);
