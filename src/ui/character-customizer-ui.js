/* KELO-INDEX
 * area: UI / CHARACTERS
 * owner: KeloCharacterCustomizer (presentation only)
 * keys: CHARACTER CUSTOMIZER MOBILE PRESET PALETTE RANDOM UNDO SAVE SHARE INPUT LOCK
 * purpose: editor premium mobile-first que consume exclusivamente las operaciones públicas de CharacterCustomization
 * public-api: KeloCharacterCustomizer.open/close/render/isOpen
 * consumes: KeloCharacterCustomization, KeloCharacterCustomizerPreview, KeloInputLocks
 * state-owned: tab/slot activo, locks de randomizador, panel de herramientas y token modal propio
 * extension-points: nuevos slots/paletas/presets aparecen desde schema/content packs sin tocar engine
 * reuse: perfil del jugador en móvil/desktop
 * legacy: reemplaza el write directo de KELO_MODAL_INPUT_LOCK y el monkey-patch de openSocialTool
 * do-not: NO escribir estado del personaje directamente; NO monkey-patchear input/render/profile routes
 * online: UI pide operaciones; ownership de cosméticos puede validarse en authority futura
 */
(function (root) {
  'use strict';

  const VERSION='character-customizer-ui-v2.0.0';
  const ROOT_ID='kelo-character-customizer';
  const LOCK_OWNER='character-customizer';
  const SLOT_LABELS={
    body:'Cuerpo',skinTone:'Piel',face:'Rostro',eyes:'Ojos',eyebrows:'Cejas',nose:'Nariz',mouth:'Boca',hair:'Pelo',facialHair:'Barba',
    torso:'Parte superior',legs:'Pantalones',feet:'Calzado',gloves:'Guantes',head:'Gorro / casco',faceAccessory:'Accesorio facial',armor:'Armadura',
    back:'Espalda / capa',weaponMain:'Arma principal',weaponSecondary:'Arma secundaria',accessory1:'Accesorio 1',accessory2:'Accesorio 2',
    aura:'Aura',weaponSkin:'Skin de arma',characterFX:'FX del personaje'
  };
  const TAB_LABELS={appearance:'APARIENCIA',clothing:'ROPA',equipment:'EQUIPO',cosmetics:'COSMÉTICOS'};
  let activeTab='appearance',activeSlot='body',open=false,toolsOpen=false,inputToken=null,renderQueued=false;
  const lockedSlots=new Set();

  const audit=root.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT={
    version:VERSION,ready:false,mobileFirst:true,tabs:['appearance','clothing','equipment','cosmetics'],openCount:0,lastSlot:null,
    tokenInputLock:true,directLegacyModalWrites:false,profileMonkeyPatch:false,smartRandomizer:true,undoRedo:true,saveSlots:true,shareCodes:true,
    safeArea:true,minTouchTargetPx:44,lastError:null
  };

  function api(){return root.KeloCharacterCustomization||null;}
  function previewApi(){return root.KeloCharacterCustomizerPreview||null;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(msg){if(typeof showToast==='function')showToast(msg);else console.info('[Character]',msg);}
  function claim(){
    if(inputToken)return true;
    const locks=root.KeloInputLocks;
    if(!locks||typeof locks.acquire!=='function'){audit.lastError='KELO_INPUT_LOCKS_UNAVAILABLE';return false;}
    inputToken=locks.acquire(LOCK_OWNER,{source:'character-customizer-ui'});
    return !!inputToken;
  }
  function release(){
    const token=inputToken;inputToken=null;
    if(!token)return false;
    const locks=root.KeloInputLocks;
    return !!(locks&&typeof locks.release==='function'&&locks.release(token));
  }
  function closeOtherPanels(){
    try{if(typeof closeMenu==='function')closeMenu();}catch(e){}
    try{if(root.KeloBackpackUI&&typeof root.KeloBackpackUI.close==='function')root.KeloBackpackUI.close();}catch(e){}
    try{if(root.KeloSelfInteractionUI&&typeof root.KeloSelfInteractionUI.close==='function')root.KeloSelfInteractionUI.close();}catch(e){}
    try{if(root.KeloSelfInteractionUI&&typeof root.KeloSelfInteractionUI.closeEmotes==='function')root.KeloSelfInteractionUI.closeEmotes();}catch(e){}
    try{if(typeof closeInspect==='function')closeInspect();}catch(e){}
  }

  function styles(){
    if(document.getElementById('kelo-character-customizer-style'))return;
    const s=document.createElement('style');s.id='kelo-character-customizer-style';s.textContent=`
#${ROOT_ID}{position:fixed;inset:0;z-index:420;display:none;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:rgba(2,6,8,.78);backdrop-filter:blur(11px);pointer-events:auto;color:#eef2ed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} textarea{font:inherit}#${ROOT_ID} button{touch-action:manipulation;cursor:pointer}
#${ROOT_ID} .kc-shell{width:min(980px,100%);height:min(720px,100%);min-height:500px;display:grid;grid-template-columns:minmax(270px,34%) 1fr;grid-template-rows:auto 1fr auto;border:1px solid rgba(231,197,106,.54);border-radius:24px;overflow:hidden;background:linear-gradient(145deg,#0d1718,#071014 62%,#0a1318);box-shadow:0 32px 110px rgba(0,0,0,.72)}
#${ROOT_ID} .kc-head{grid-column:1/-1;display:flex;align-items:center;gap:7px;padding:10px 12px 10px 17px;border-bottom:1px solid rgba(231,197,106,.2);background:rgba(17,31,31,.98)}
#${ROOT_ID} .kc-title{font-family:Georgia,serif;font-size:21px;font-weight:800;letter-spacing:.04em;color:#ead18b}#${ROOT_ID} .kc-sub{font-size:9px;color:#7f9890;margin-top:2px}#${ROOT_ID} .kc-spacer{flex:1}
#${ROOT_ID} .kc-icon-btn,#${ROOT_ID} .kc-tools-btn,#${ROOT_ID} .kc-close{min-width:44px;height:44px;border-radius:11px;border:1px solid rgba(231,197,106,.32);background:#101d20;color:#d9cc9d;font-weight:850}
#${ROOT_ID} .kc-icon-btn:disabled{opacity:.3;cursor:default}#${ROOT_ID} .kc-tools-btn{padding:0 12px;color:#ecd58d}.kc-tools-btn.active{border-color:#e1c268;background:#24382e}
#${ROOT_ID} .kc-close{width:46px;background:#67282b;color:#fff0df;font-size:25px;border-color:rgba(231,197,106,.58)}
#${ROOT_ID} .kc-preview{position:relative;border-right:1px solid rgba(231,197,106,.16);padding:14px;display:flex;flex-direction:column;align-items:center;gap:9px;overflow:auto;background:radial-gradient(circle at 50% 28%,rgba(45,92,78,.28),transparent 56%)}
#${ROOT_ID} .kc-stage{position:relative;width:min(236px,72vw);height:338px;border:1px solid rgba(231,197,106,.25);border-radius:22px;background:linear-gradient(180deg,rgba(18,38,37,.78),rgba(5,11,14,.94));overflow:hidden;box-shadow:inset 0 0 52px rgba(0,0,0,.3)}
#${ROOT_ID} .kc-stage:after{content:'';position:absolute;z-index:0;left:14%;right:14%;bottom:24px;height:19px;border-radius:50%;background:rgba(0,0,0,.42);filter:blur(5px)}
#${ROOT_ID} .kc-hero{position:absolute;z-index:2;left:50%;bottom:26px;transform:translateX(-50%);width:180px;height:270px;background-image:url('assets/hero.PNG');background-repeat:no-repeat;background-size:400% 400%;background-position:0 0;image-rendering:pixelated;transform-origin:50% 100%}
#${ROOT_ID} .kc-preview-controls{width:100%;display:grid;gap:7px}.kc-control-row{display:flex;justify-content:center;gap:6px}.kc-control{min-width:44px;height:44px;padding:0 10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#0e1a1f;color:#8ea29b;font-size:12px;font-weight:850}.kc-control.active{border-color:#dfbd5e;color:#f1d782;background:#1c3028}
#${ROOT_ID} .kc-preview-note{font-size:9px;color:#718681;text-align:center;line-height:1.35}
#${ROOT_ID} .kc-main{min-width:0;display:flex;flex-direction:column;overflow:hidden}.kc-tabs{display:flex;gap:6px;padding:11px;border-bottom:1px solid rgba(255,255,255,.055);overflow-x:auto;scrollbar-width:none}.kc-tabs::-webkit-scrollbar{display:none}.kc-tab{flex:1 0 auto;min-height:44px;padding:0 13px;border-radius:11px;border:1px solid rgba(231,197,106,.18);background:rgba(255,255,255,.025);color:#9eb0aa;font-size:10px;font-weight:900;letter-spacing:.04em}.kc-tab.active{background:rgba(231,197,106,.12);border-color:rgba(231,197,106,.58);color:#f0d68c}
#${ROOT_ID} .kc-content{overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:13px}.kc-section-title{margin:7px 0 9px;font-size:10px;font-weight:900;color:#d9c47f;letter-spacing:.08em}.kc-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.kc-section-actions{display:flex;gap:6px}.kc-mini{min-height:36px;padding:0 10px;border:1px solid rgba(231,197,106,.22);border-radius:9px;background:#101d21;color:#9eb0a9;font-size:9px;font-weight:850}.kc-mini.primary{border-color:#cfae55;color:#ecd17e;background:#1c3129}
#${ROOT_ID} .kc-presets,#${ROOT_ID} .kc-outfits{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:12px}.kc-preset,.kc-outfit{min-height:76px;padding:11px;border:1px solid rgba(231,197,106,.17);border-radius:12px;background:linear-gradient(145deg,rgba(27,49,43,.38),rgba(10,18,22,.58));color:#e8eee9;text-align:left}.kc-preset b,.kc-outfit b{display:block;color:#ead18a;font-size:12px}.kc-preset span,.kc-outfit span{display:block;margin-top:5px;color:#78908a;font-size:9px;line-height:1.35}.kc-preset.locked,.kc-outfit.locked{opacity:.45}.kc-outfit.selected{border-color:#e1c268}
#${ROOT_ID} .kc-slots{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.kc-slots::-webkit-scrollbar{display:none}.kc-slot-wrap{flex:0 0 auto;display:grid;grid-template-columns:1fr 38px;gap:3px;min-width:143px}.kc-slot{min-height:52px;padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-radius:10px 6px 6px 10px;background:#101b20;color:#a8b7b2;text-align:left}.kc-slot.active{border-color:#d6b85f;color:#ecd58d;background:#17251f}.kc-slot strong{display:block;font-size:10px}.kc-slot span{display:block;margin-top:3px;font-size:8px;color:#6f8580;max-width:99px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-lock{min-height:52px;border:1px solid rgba(255,255,255,.09);border-radius:6px 10px 10px 6px;background:#0d171c;color:#5f7570;font-size:14px}.kc-lock.locked{color:#e4c667;border-color:rgba(228,198,103,.55);background:#20291f}
#${ROOT_ID} .kc-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.kc-option{min-height:78px;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.028);color:#dbe4df;text-align:left}.kc-option.selected{border-color:#e0bf62;box-shadow:inset 0 0 0 1px rgba(224,191,98,.17);background:rgba(224,191,98,.08)}.kc-option.locked{opacity:.46}.kc-option .ico{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(231,197,106,.27);border-radius:8px;color:#e6cb78;background:#0b1519;margin-bottom:7px;font-size:14px}.kc-option strong{display:block;font-size:10px}.kc-option small{display:block;color:#718681;font-size:8px;margin-top:3px}.kc-empty{padding:20px;border:1px dashed rgba(231,197,106,.22);border-radius:12px;color:#72847f;font-size:10px;line-height:1.5;text-align:center}
#${ROOT_ID} .kc-palettes{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px}.kc-swatch{flex:0 0 auto;width:44px;height:44px;border-radius:50%;border:3px solid #192329;box-shadow:0 0 0 1px rgba(255,255,255,.12);position:relative}.kc-swatch.selected{box-shadow:0 0 0 2px #e2c267}.kc-swatch.none{background:linear-gradient(135deg,#777 0 46%,#b54141 47% 53%,#333 54%)}
#${ROOT_ID} .kc-tools{display:grid;gap:14px}.kc-save-list{display:grid;gap:8px}.kc-save-row{display:grid;grid-template-columns:54px 1fr auto auto auto;gap:6px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.kc-save-num{color:#d9c47f;font-size:10px;font-weight:900}.kc-save-name{min-width:0;height:40px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#091318;color:#dce7e1;padding:0 9px;font-size:10px}.kc-save-action{min-width:44px;height:40px;padding:0 9px;border:1px solid rgba(231,197,106,.22);border-radius:8px;background:#122027;color:#aabbb4;font-size:8px;font-weight:850}.kc-save-action.primary{color:#edd384;border-color:#c3a552;background:#20332a}.kc-save-action.danger{color:#ce8c8c}.kc-save-action:disabled{opacity:.25}.kc-code{width:100%;min-height:98px;resize:vertical;border:1px solid rgba(231,197,106,.2);border-radius:11px;background:#081217;color:#c7d7d0;padding:10px;font:9px ui-monospace,SFMono-Regular,Menlo,monospace;user-select:text;-webkit-user-select:text}.kc-code-actions{display:flex;gap:7px;flex-wrap:wrap}.kc-code-btn{min-height:44px;padding:0 13px;border:1px solid rgba(231,197,106,.28);border-radius:10px;background:#13242a;color:#d5c383;font-size:9px;font-weight:900}
#${ROOT_ID} .kc-foot{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:10px 13px;border-top:1px solid rgba(231,197,106,.16);background:#081216}.kc-note{font-size:8px;color:#637874;flex:1}.kc-reset,.kc-random,.kc-done{min-height:44px;padding:0 13px;border-radius:10px;font-weight:900;font-size:9px}.kc-reset{border:1px solid rgba(255,255,255,.12);background:#111c21;color:#9badab}.kc-random{border:1px solid rgba(231,197,106,.42);background:#172922;color:#e3c96f}.kc-done{border:1px solid #d4b75c;background:#213b31;color:#f0d88d}
@media(max-width:720px){#${ROOT_ID}{padding:0}#${ROOT_ID} .kc-shell{width:100%;height:100%;min-height:0;border-radius:0;border:0;grid-template-columns:1fr;grid-template-rows:auto 225px 1fr auto}#${ROOT_ID} .kc-head{padding-top:max(8px,env(safe-area-inset-top));padding-left:max(10px,env(safe-area-inset-left));padding-right:max(10px,env(safe-area-inset-right))}#${ROOT_ID} .kc-sub{display:none}#${ROOT_ID} .kc-title{font-size:17px}#${ROOT_ID} .kc-tools-btn{font-size:0;padding:0;width:44px}.kc-tools-btn:after{content:'★';font-size:15px}#${ROOT_ID} .kc-preview{border-right:0;border-bottom:1px solid rgba(231,197,106,.13);padding:7px 10px;display:grid;grid-template-columns:140px 1fr;gap:8px;overflow:hidden}#${ROOT_ID} .kc-stage{width:136px;height:205px;margin:0;border-radius:15px}#${ROOT_ID} .kc-hero{width:111px;height:166px;bottom:18px}#${ROOT_ID} .kc-preview-controls{align-self:center}.kc-control-row{flex-wrap:wrap}.kc-preview-note{display:none}#${ROOT_ID} .kc-options{grid-template-columns:repeat(2,minmax(0,1fr))}#${ROOT_ID} .kc-tabs{padding:8px}.kc-tab{min-height:44px;font-size:9px}#${ROOT_ID} .kc-content{padding:10px}#${ROOT_ID} .kc-foot{padding-bottom:max(9px,env(safe-area-inset-bottom));padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right))}.kc-note{display:none}.kc-reset,.kc-random,.kc-done{flex:1}.kc-save-row{grid-template-columns:42px minmax(84px,1fr) repeat(3,44px);gap:4px}.kc-save-action{padding:0;font-size:7px}}
@media(max-width:380px){#${ROOT_ID} .kc-title{display:none}#${ROOT_ID} .kc-preview{grid-template-columns:126px 1fr}#${ROOT_ID} .kc-stage{width:122px}.kc-save-row{grid-template-columns:34px 1fr 44px 44px}.kc-save-action.danger{grid-column:2/-1;width:100%}}
`;
    document.head.appendChild(s);
  }

  function ensure(){styles();let el=document.getElementById(ROOT_ID);if(el)return el;el=document.createElement('div');el.id=ROOT_ID;document.body.appendChild(el);return el;}
  function currentName(slot,id){const A=api();if(!id)return 'Ninguno';const item=A&&A.getItem(id);return item?item.name:id;}
  function selectedPalette(state,slot){return state.palettes&&state.palettes[slot]||null;}
  function tabSlots(tab,A){return (A.slotGroups&&A.slotGroups[tab])?A.slotGroups[tab].slice():[];}
  function tabRandomGroup(tab){return tab==='clothing'?'clothing':tab;}

  function previewHtml(){
    return '<div class="kc-stage"><div class="kc-hero" aria-label="Vista previa del personaje"></div></div><div class="kc-preview-controls"><div class="kc-control-row"><button class="kc-control" data-kc-face="down" aria-label="Mirar abajo">↓</button><button class="kc-control" data-kc-face="left" aria-label="Mirar izquierda">←</button><button class="kc-control" data-kc-face="right" aria-label="Mirar derecha">→</button><button class="kc-control" data-kc-face="up" aria-label="Mirar arriba">↑</button></div><div class="kc-control-row"><button class="kc-control" data-kc-motion="idle">QUIETO</button><button class="kc-control" data-kc-motion="walk">CAMINAR</button></div><div class="kc-preview-note">El preview usa las mismas capas y dirección que el personaje del juego.</div></div>';
  }
  function presetsHtml(A){
    const list=A.listPresets?A.listPresets():[];
    if(!list.length)return '';
    return '<div class="kc-section-title">PUNTOS DE PARTIDA</div><div class="kc-presets">'+list.map(function(p){return '<button class="kc-preset '+(p.locked?'locked':'')+'" data-kc-preset="'+esc(p.id)+'"><b>'+esc(p.name)+'</b><span>'+esc(p.description||'Preset editable: puedes cambiar cualquier pieza después.')+'</span></button>';}).join('')+'</div>';
  }
  function outfitsHtml(state,A){
    const list=A.listOutfits?A.listOutfits():[];
    if(!list.length)return '';
    return '<div class="kc-section-title">TRAJES</div><div class="kc-outfits">'+list.map(function(o){return '<button class="kc-outfit '+(state.outfitId===o.id?'selected ':'')+(o.locked?'locked':'')+'" data-kc-outfit="'+esc(o.id)+'"><b>'+esc(o.name)+'</b><span>Preset modular de ropa; el resto del personaje sigue independiente.</span></button>';}).join('')+'</div>';
  }
  function slotButtons(slots,state){
    return '<div class="kc-slots">'+slots.map(function(slot){const locked=lockedSlots.has(slot);return '<div class="kc-slot-wrap"><button class="kc-slot '+(activeSlot===slot?'active':'')+'" data-kc-slot="'+esc(slot)+'"><strong>'+esc(SLOT_LABELS[slot]||slot)+'</strong><span>'+esc(currentName(slot,state.slots[slot]))+'</span></button><button class="kc-lock '+(locked?'locked':'')+'" data-kc-lock="'+esc(slot)+'" aria-label="'+(locked?'Desbloquear ':'Bloquear ')+esc(SLOT_LABELS[slot]||slot)+'">'+(locked?'🔒':'○')+'</button></div>';}).join('')+'</div>';
  }
  function optionHtml(slot,state,A){
    if(!slot)return '<div class="kc-empty">No hay slots en esta categoría.</div>';
    const items=A.listItems(slot),selected=state.slots[slot];
    const required=Array.isArray(A.requiredAppearanceSlots)&&A.requiredAppearanceSlots.indexOf(slot)>=0;
    let options=[];if(!required)options.push({id:null,name:'Ninguno',rarity:'Vacío',icon:'×'});options=options.concat(items);
    if(!options.length)return '<div class="kc-empty">Este slot ya está preparado pero todavía no tiene assets registrados. Añade contenido por ContentPack; no hace falta tocar el engine.</div>';
    return '<div class="kc-section-title">'+esc(SLOT_LABELS[slot]||slot)+'</div><div class="kc-options">'+options.map(function(item){const id=item.id==null?null:item.id;return '<button class="kc-option '+(selected===id?'selected ':'')+(item.locked?'locked':'')+'" data-kc-item="'+esc(id==null?'__none__':id)+'"><span class="ico">'+esc(item.icon||'◇')+'</span><strong>'+esc(item.name)+'</strong><small>'+esc(item.rarity||'Visual')+'</small></button>';}).join('')+'</div>';
  }
  function paletteHtml(slot,state,A){
    if(!slot||!A.listPalettes)return '';
    const list=A.listPalettes(slot);if(!list.length)return '';
    const selected=selectedPalette(state,slot);
    return '<div class="kc-section-title">COLOR</div><div class="kc-palettes"><button class="kc-swatch none '+(!selected?'selected':'')+'" data-kc-palette="__none__" title="Color original" aria-label="Color original"></button>'+list.map(function(p){return '<button class="kc-swatch '+(selected===p.id?'selected':'')+'" data-kc-palette="'+esc(p.id)+'" title="'+esc(p.name)+'" aria-label="'+esc(p.name)+'" style="background:'+esc(p.swatch||'#888')+'"></button>';}).join('')+'</div>';
  }
  function editorHtml(state,A){
    const slots=tabSlots(activeTab,A);if(slots.indexOf(activeSlot)<0)activeSlot=slots[0]||null;
    let before='';if(activeTab==='appearance')before=presetsHtml(A);else if(activeTab==='clothing')before=outfitsHtml(state,A);
    return before+'<div class="kc-section-head"><div class="kc-section-title">PIEZAS</div><div class="kc-section-actions"><button class="kc-mini primary" data-kc-random="group">🎲 '+esc(TAB_LABELS[activeTab])+'</button></div></div>'+slotButtons(slots,state)+optionHtml(activeSlot,state,A)+paletteHtml(activeSlot,state,A);
  }
  function toolsHtml(A){
    const saves=A.listSavedProfiles?A.listSavedProfiles():[];
    const code=A.exportCode?A.exportCode():'';
    return '<div class="kc-tools"><div><div class="kc-section-title">MIS PERSONAJES · 5 GUARDADOS</div><div class="kc-save-list">'+saves.map(function(s){return '<div class="kc-save-row"><div class="kc-save-num">#'+s.slot+'</div><input class="kc-save-name" data-kc-save-name="'+s.slot+'" maxlength="40" value="'+esc(s.occupied?s.name:'Personaje '+s.slot)+'" aria-label="Nombre del guardado '+s.slot+'"><button class="kc-save-action primary" data-kc-save="'+s.slot+'">'+(s.occupied?'SOBRE':'GUARDA')+'</button><button class="kc-save-action" data-kc-load="'+s.slot+'" '+(s.occupied?'':'disabled')+'>CARGA</button><button class="kc-save-action danger" data-kc-delete="'+s.slot+'" '+(s.occupied?'':'disabled')+'>BORRA</button></div>';}).join('')+'</div></div><div><div class="kc-section-title">CÓDIGO DE PERSONAJE</div><textarea class="kc-code" spellcheck="false" aria-label="Código para exportar o importar">'+esc(code)+'</textarea><div class="kc-code-actions"><button class="kc-code-btn" data-kc-export>ACTUALIZAR CÓDIGO</button><button class="kc-code-btn" data-kc-copy>COPIAR</button><button class="kc-code-btn" data-kc-import>IMPORTAR PEGADO</button></div></div></div>';
  }

  function bind(el,A){
    el.querySelector('.kc-close').onclick=close;el.querySelector('.kc-done').onclick=close;
    el.querySelector('.kc-tools-btn').onclick=function(){toolsOpen=!toolsOpen;render();};
    el.querySelector('[data-kc-undo]').onclick=function(){const out=A.undo();if(!out.ok)toast('No hay cambios para deshacer');};
    el.querySelector('[data-kc-redo]').onclick=function(){const out=A.redo();if(!out.ok)toast('No hay cambios para rehacer');};
    el.querySelector('.kc-reset').onclick=function(){if(root.confirm&&!root.confirm('¿Restablecer la apariencia? Puedes deshacerlo después.'))return;A.reset();activeTab='appearance';activeSlot='body';toolsOpen=false;};
    el.querySelector('.kc-random').onclick=function(){const out=A.randomize({groups:['all'],lockedSlots:Array.from(lockedSlots)});if(!out.ok)toast('No hay opciones disponibles para aleatorizar');};
    el.querySelectorAll('[data-kc-tab]').forEach(function(b){b.onclick=function(){toolsOpen=false;activeTab=b.dataset.kcTab;const ss=tabSlots(activeTab,A);activeSlot=ss[0]||null;render();};});
    el.querySelectorAll('[data-kc-slot]').forEach(function(b){b.onclick=function(){activeSlot=b.dataset.kcSlot;audit.lastSlot=activeSlot;render();};});
    el.querySelectorAll('[data-kc-lock]').forEach(function(b){b.onclick=function(){const slot=b.dataset.kcLock;if(lockedSlots.has(slot))lockedSlots.delete(slot);else lockedSlots.add(slot);render();};});
    el.querySelectorAll('[data-kc-item]').forEach(function(b){b.onclick=function(){const id=b.dataset.kcItem==='__none__'?null:b.dataset.kcItem;const out=A.select(activeSlot,id);if(!out.ok)toast(out.error==='ITEM_LOCKED'?'Ese objeto está bloqueado':out.error==='REQUIRED_SLOT'?'Esta pieza base no puede quedar vacía':'No se pudo aplicar');};});
    el.querySelectorAll('[data-kc-palette]').forEach(function(b){b.onclick=function(){const id=b.dataset.kcPalette==='__none__'?null:b.dataset.kcPalette;const out=A.setPalette(activeSlot,id);if(!out.ok)toast('Ese color no es compatible con esta pieza');};});
    el.querySelectorAll('[data-kc-preset]').forEach(function(b){b.onclick=function(){const out=A.applyPreset(b.dataset.kcPreset);if(!out.ok)toast('No se pudo aplicar el preset');};});
    el.querySelectorAll('[data-kc-outfit]').forEach(function(b){b.onclick=function(){const out=A.applyOutfit(b.dataset.kcOutfit);if(!out.ok)toast('No se pudo aplicar el traje');};});
    el.querySelectorAll('[data-kc-random]').forEach(function(b){b.onclick=function(){const out=A.randomize({group:tabRandomGroup(activeTab),lockedSlots:Array.from(lockedSlots)});if(!out.ok)toast('No hay opciones para aleatorizar en esta categoría');};});
    el.querySelectorAll('[data-kc-face]').forEach(function(b){b.onclick=function(){const P=previewApi();if(P)P.setFace(b.dataset.kcFace);};});
    el.querySelectorAll('[data-kc-motion]').forEach(function(b){b.onclick=function(){const P=previewApi();if(P)P.setMotion(b.dataset.kcMotion);};});

    el.querySelectorAll('[data-kc-save]').forEach(function(b){b.onclick=function(){const slot=Number(b.dataset.kcSave),existing=(A.listSavedProfiles()[slot-1]||{}).occupied;if(existing&&root.confirm&&!root.confirm('¿Sobrescribir este personaje guardado?'))return;const input=el.querySelector('[data-kc-save-name="'+slot+'"]');const out=A.saveProfile(slot,input&&input.value);toast(out.ok?'Personaje guardado':'No se pudo guardar');render();};});
    el.querySelectorAll('[data-kc-load]').forEach(function(b){b.onclick=function(){const out=A.loadProfile(Number(b.dataset.kcLoad));toast(out.ok?(out.warnings&&out.warnings.length?'Cargado con algunos assets no disponibles':'Personaje cargado'):'No se pudo cargar');};});
    el.querySelectorAll('[data-kc-delete]').forEach(function(b){b.onclick=function(){if(root.confirm&&!root.confirm('¿Borrar este guardado?'))return;const out=A.deleteProfile(Number(b.dataset.kcDelete));toast(out.ok?'Guardado borrado':'No se pudo borrar');render();};});
    const codeArea=el.querySelector('.kc-code');
    const exportBtn=el.querySelector('[data-kc-export]');if(exportBtn)exportBtn.onclick=function(){if(codeArea)codeArea.value=A.exportCode();toast('Código actualizado');};
    const copyBtn=el.querySelector('[data-kc-copy]');if(copyBtn)copyBtn.onclick=async function(){if(!codeArea)return;codeArea.value=A.exportCode();try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(codeArea.value);else{codeArea.focus();codeArea.select();document.execCommand('copy');}toast('Código copiado');}catch(e){toast('Selecciona el código y cópialo manualmente');}};
    const importBtn=el.querySelector('[data-kc-import]');if(importBtn)importBtn.onclick=function(){if(!codeArea)return;const out=A.importCode(codeArea.value.trim());if(out.ok)toast(out.warnings&&out.warnings.length?'Importado con assets no disponibles':'Personaje importado');else toast(out.error==='CHARACTER_CODE_CHECKSUM'?'El código está dañado':'Código no válido');};
  }

  function render(){
    const A=api();if(!A)return null;
    const el=ensure(),state=A.getState(),tabs=['appearance','clothing','equipment','cosmetics'];
    el.innerHTML='<div class="kc-shell" role="dialog" aria-modal="true" aria-label="Personalizar personaje"><div class="kc-head"><div><div class="kc-title">PERSONAJE</div><div class="kc-sub">Modular · reversible · listo para online</div></div><div class="kc-spacer"></div><button class="kc-icon-btn" data-kc-undo aria-label="Deshacer" '+(A.canUndo&&A.canUndo()?'':'disabled')+'>↶</button><button class="kc-icon-btn" data-kc-redo aria-label="Rehacer" '+(A.canRedo&&A.canRedo()?'':'disabled')+'>↷</button><button class="kc-tools-btn '+(toolsOpen?'active':'')+'">GUARDAR</button><button class="kc-close" aria-label="Cerrar">×</button></div><div class="kc-preview">'+previewHtml()+'</div><div class="kc-main"><div class="kc-tabs">'+tabs.map(function(t){return '<button class="kc-tab '+(!toolsOpen&&activeTab===t?'active':'')+'" data-kc-tab="'+t+'">'+TAB_LABELS[t]+'</button>';}).join('')+'</div><div class="kc-content">'+(toolsOpen?toolsHtml(A):editorHtml(state,A))+'</div></div><div class="kc-foot"><button class="kc-reset">RESTABLECER</button><div class="kc-note">Los cambios son visuales. Equipo, stats e inventario conservan sus propios owners.</div><button class="kc-random">🎲 TODO</button><button class="kc-done">LISTO</button></div></div>';
    bind(el,A);
    try{root.dispatchEvent(new CustomEvent('kelo:character-customizer-rendered',{detail:{tab:activeTab,slot:activeSlot,tools:toolsOpen}}));}catch(e){}
    return el;
  }
  function scheduleRender(){if(!open||renderQueued)return;renderQueued=true;requestAnimationFrame(function(){renderQueued=false;if(open)render();});}
  function openCustomizer(){
    const A=api();if(!A){toast('Personalizador todavía cargando');return false;}
    closeOtherPanels();
    if(!claim()){toast('No se pudo reclamar el control de la interfaz');return false;}
    try{
      A.syncGameplayEquipment();
      const el=render();if(!el)throw new Error('CUSTOMIZER_RENDER_FAILED');
      el.style.display='flex';open=true;audit.openCount+=1;
      try{root.dispatchEvent(new CustomEvent('kelo:character-customizer-opened',{detail:{version:VERSION}}));}catch(e){}
      const P=previewApi();if(P){P.render();}
      return true;
    }catch(error){audit.lastError=String(error&&error.message||error);release();open=false;toast('No se pudo abrir el personalizador');return false;}
  }
  function close(){
    const el=document.getElementById(ROOT_ID);if(el)el.style.display='none';open=false;release();
    try{root.dispatchEvent(new CustomEvent('kelo:character-customizer-closed',{detail:{version:VERSION}}));}catch(e){}
  }
  function boot(){
    if(!api()){setTimeout(boot,50);return;}
    ensure();
    root.addEventListener('kelo:character-customization-changed',scheduleRender);
    root.addEventListener('kelo:character-content-pack-ready',scheduleRender);
    audit.ready=true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  root.KeloCharacterCustomizer=Object.freeze({version:VERSION,open:openCustomizer,close:close,render:render,isOpen:function(){return open;},lockedSlots:function(){return Object.freeze(Array.from(lockedSlots));}});
})(typeof globalThis!=='undefined'?globalThis:window);
