/* KELO-INDEX
 * area: UI / PROFILE LAUNCHER
 * owner: Kelo Profile Launcher
 * keys: PROFILE CHARACTER CUSTOMIZER LAZY LOAD FIRST USE PERFORMANCE APPEARANCE
 * purpose: conserva el cierre del perfil legacy y carga Character Customization solo cuando el jugador pide Apariencia
 * public-api: KELO_PROFILE_LAUNCHER.openCustomizer/ensureCustomizer/isLoaded
 * consumes: KeloCharacterCustomizer, KeloEvents, CharacterCustomization modules
 * state-owned: promesa efímera de carga + facade temporal de KeloCharacterCustomizer antes del primer uso
 * extension-points: lista de módulos del Character Customizer existente
 * reuse: patrón launcher mínimo -> feature pesada bajo primera acción, igual que Studio
 * legacy: conserva botón de cierre del inspect-sheet sin cargar combat/effects/melee desde Profile
 * do-not: NO cargar combat/effects/melee aquí, NO crear otro owner de personaje, NO poseer gameplay
 */
(function () {
  'use strict';
  const CLOSE_ID = 'kelo-profile-close';
  const CUSTOMIZER_STYLE_ID = 'kelo-character-customizer-responsive-link';
  const CUSTOMIZER_STYLE = 'src/ui/character-customizer-responsive.css?v=1';
  const CUSTOMIZATION_SCRIPTS = Object.freeze([
    'src/characters/character-slot-schema.js?v=2',
    'src/characters/character-customization.js?v=6',
    'src/characters/character-visual-presets.js?v=3',
    'src/characters/character-content-packs.js?v=2',
    'src/characters/character-visual-stack.js?v=3',
    'src/characters/character-demo-kit.js?v=3',
    'src/ui/character-customizer-ui.js?v=3',
    'src/ui/character-customizer-preview.js?v=3'
  ]);
  let customizationPromise = null;
  let loadedAt = 0;
  let realCustomizer = null;

  function emit(name, payload) {
    try {
      if (window.KeloEvents && typeof window.KeloEvents.emit === 'function') window.KeloEvents.emit(name, payload);
    } catch (e) {}
  }

  function closeProfilePanel() {
    const sheet = document.getElementById('inspect-sheet');
    if (typeof window.closeInspect === 'function') window.closeInspect();
    else if (sheet) sheet.style.display = 'none';
  }

  function hideLegacyClose(sheet) {
    const legacy = sheet.querySelector('#inspect-body [onclick="closeInspect()"]');
    if (legacy) legacy.style.display = 'none';
  }

  function ensureCloseButton() {
    const sheet = document.getElementById('inspect-sheet');
    if (!sheet) return null;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    hideLegacyClose(sheet);
    let button = document.getElementById(CLOSE_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = CLOSE_ID;
      button.type = 'button';
      button.textContent = '×';
      button.setAttribute('aria-label', 'Cerrar personaje');
      button.style.cssText = [
        'position:absolute','top:8px','right:8px','width:44px','height:44px','display:grid','place-items:center','z-index:5',
        'border:1px solid rgba(231,197,106,.65)','border-radius:10px','background:rgba(76,22,22,.96)','color:#f5e7bf',
        'font-size:28px','font-weight:800','line-height:1','cursor:pointer','pointer-events:auto','touch-action:manipulation',
        'box-shadow:0 6px 18px rgba(0,0,0,.35)'
      ].join(';');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeProfilePanel();
      });
      sheet.appendChild(button);
    }
    return button;
  }

  function wrapInspectPlayer() {
    const original = window.inspectPlayer;
    if (typeof original !== 'function' || original.__keloProfileCloseWrapped) return;
    function wrappedInspectPlayer() {
      const result = original.apply(this, arguments);
      ensureCloseButton();
      return result;
    }
    wrappedInspectPlayer.__keloProfileCloseWrapped = true;
    window.inspectPlayer = wrappedInspectPlayer;
  }

  function ensureCustomizerStyle() {
    const existing = document.getElementById(CUSTOMIZER_STYLE_ID);
    if (existing) return existing;
    const link = document.createElement('link');
    link.id = CUSTOMIZER_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = CUSTOMIZER_STYLE;
    link.dataset.keloCharacterCustomizer = 'responsive-lazy';
    document.head.appendChild(link);
    return link;
  }

  function scriptExists(src) {
    const base = src.split('?')[0];
    return Array.from(document.scripts).some(function (script) {
      return (script.getAttribute('src') || '').split('?')[0] === base;
    });
  }

  function loadScript(src) {
    if (scriptExists(src)) return Promise.resolve(src);
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.keloRuntimeBootstrap = 'character-lazy';
      script.onload = function () { resolve(src); };
      script.onerror = function () { reject(new Error('CHARACTER_MODULE_FAILED:' + src.split('?')[0])); };
      document.body.appendChild(script);
    });
  }

  // KELO-INDEX UI/PROFILE lazy sequential load preserva orden legacy sin pagar requests, parse ni init antes del primer uso.
  async function ensureCustomizer() {
    if (realCustomizer && typeof realCustomizer.open === 'function') return realCustomizer;
    if (customizationPromise) return customizationPromise;
    customizationPromise = (async function () {
      ensureCustomizerStyle();
      emit('FEATURE_LOAD_STARTED', { feature:'character-customizer' });
      for (const src of CUSTOMIZATION_SCRIPTS) await loadScript(src);
      const api = realCustomizer || window.KeloCharacterCustomizer;
      if (!api || api === lazyFacade || typeof api.open !== 'function') throw new Error('CHARACTER_CUSTOMIZER_NOT_READY');
      loadedAt = performance.now();
      emit('FEATURE_LOADED', { feature:'character-customizer' });
      return api;
    })().catch(function (error) {
      customizationPromise = null;
      console.error('[Kelo profile launcher]', error);
      throw error;
    });
    return customizationPromise;
  }

  async function openCustomizer() {
    try {
      const api = await ensureCustomizer();
      const opened = api.open();
      if (opened !== false) emit('PANEL_OPEN', { panel:'character-customizer' });
      return opened !== false;
    } catch (error) {
      if (typeof window.showToast === 'function') window.showToast('Personalizador todavía no disponible');
      return false;
    }
  }

  // Adapter temporal: Luxe ya consume KeloCharacterCustomizer.open; esta facade mantiene ese contrato sin cargar el feature pesado al boot.
  const lazyFacade = Object.freeze({
    version:'character-customizer-lazy-facade-v1',
    open:openCustomizer,
    close:function () { return false; },
    render:function () { return false; },
    isOpen:function () { return false; }
  });

  function installLazyFacade() {
    if (window.KeloCharacterCustomizer && window.KeloCharacterCustomizer !== lazyFacade) {
      realCustomizer = window.KeloCharacterCustomizer;
      return;
    }
    try {
      Object.defineProperty(window, 'KeloCharacterCustomizer', {
        configurable:true,
        enumerable:true,
        get:function () { return realCustomizer || lazyFacade; },
        set:function (value) {
          if (!value || value === lazyFacade) return;
          realCustomizer = value;
          Object.defineProperty(window, 'KeloCharacterCustomizer', {
            configurable:true,
            enumerable:true,
            writable:true,
            value:value
          });
        }
      });
    } catch (error) {
      window.KeloCharacterCustomizer = lazyFacade;
    }
  }

  function boot() {
    ensureCloseButton();
    wrapInspectPlayer();
    installLazyFacade();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.KELO_PROFILE_LAUNCHER = Object.freeze({
    version:'profile-lazy-launcher-v2.1.0',
    openCustomizer:openCustomizer,
    ensureCustomizer:ensureCustomizer,
    get isLoaded(){ return !!(realCustomizer && typeof realCustomizer.open === 'function'); },
    get isLoading(){ return !!customizationPromise && !loadedAt; },
    scripts:CUSTOMIZATION_SCRIPTS.slice()
  });
  window.KELO_PROFILE_CLOSE_AUDIT = Object.freeze({
    version:'profile-close-v2.1.0',
    closeButtonId:CLOSE_ID,
    minTouchTargetPx:44,
    tapClose:true,
    legacyCloseHidden:true,
    runtimeFoundationBootstrap:false,
    characterCustomizationBootstrap:false,
    characterCustomizationLazy:true,
    characterCustomizerResponsiveStyleLazy:true,
    customizationStyle:CUSTOMIZER_STYLE,
    customizationScripts:CUSTOMIZATION_SCRIPTS.slice()
  });
})();
