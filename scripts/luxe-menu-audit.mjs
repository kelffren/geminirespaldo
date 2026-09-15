/* KELO-INDEX
 * area: TEST / UI
 * owner: Premium main menu + player HUD contract audit
 * keys: MENU LUXE HUD PVP HP MANA GUIDE INPUT LOCK FOUNDATION COMMERCE MOUNTS QUICK ACTIONS COLLAPSIBLE
 * purpose: prueba estáticamente que Luxe reutiliza owners reales, oculta el HUD en social y agrupa el rail lateral real detrás de un launcher retráctil sin duplicar handlers
 * online: N/A; valida fronteras UI/owner, no autoridad gameplay
 */
import fs from 'node:fs';
const read=(path)=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const luxe=read('src/ui/luxe-shell.js'),playerHud=read('src/ui/luxe-player-hud.js'),index=read('index.html'),character=read('src/ui/character-customizer-ui.js'),selfUi=read('src/ui/self-interaction-ui.js'),backpack=read('src/ui/backpack-ui.js'),market=read('src/ui/market-ui.js'),commerce=read('src/ui/commerce-ui.js'),house=read('src/ui/house-instance-ui.js'),studio=read('src/ui/studio-launcher.js'),engineC=read('engine-c.js'),engineQ=read('engine-q.js');
assert(luxe.includes('KELO-INDEX'),'Luxe shell must carry KELO-INDEX');
assert(luxe.includes("luxe-shell-v4.0.4-mount-menu"),'Premium Luxe version missing');
assert(luxe.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),'Premium menu must use a two-column grid');
assert(luxe.includes("env(safe-area-inset-top)")&&luxe.includes("env(safe-area-inset-bottom)"),'Safe-area support missing');
assert(luxe.includes("KeloInputLocks")&&luxe.includes("luxe-main-menu")&&luxe.includes("luxe-chat"),'Token input-lock routes missing');
assert(!luxe.includes('KELO_MODAL_INPUT_LOCK='),'Luxe shell must not write legacy modal lock directly');
assert(!luxe.includes('setInterval('),'Luxe shell must not poll with setInterval');
assert(!studio.includes('setInterval(')&&!studio.includes('setTimeout(boot'),'Creators launcher must not poll/retry for the Luxe menu');
for(const id of ['bag','abilities','appearance','mounts','profile','market','chat','properties','nobility','titles','emotes'])assert(luxe.includes("id:'"+id+"'"),'Missing real menu route: '+id);
assert(luxe.includes("KeloCharacterCustomizer?.open"),'Appearance owner route missing');
assert(luxe.includes("KeloMountPanel?.open"),'Mount owner route missing');
assert(luxe.includes("KeloNobility?.open"),'Nobility owner route missing');
assert(luxe.includes("KeloTitles?.openBook"),'Titles owner route missing');
assert(luxe.includes("KeloSelfInteractionUI?.openEmotes"),'Emotes owner route missing');
assert(luxe.includes("KeloBackpackUI?.open"),'Backpack owner route missing');
assert(luxe.includes("KeloMarketUI?.open"),'Market owner route missing');
assert(market.includes('KeloCommerceUI?.enterMarket'),'Market must delegate to Commerce when available');
assert(commerce.includes('authorityOnly:true')&&commerce.includes('marketInstanceEntry:true'),'Commerce authority boundary missing');
assert(luxe.includes("KELO_HOUSE_UI?.show"),'Properties owner route missing');
assert(luxe.includes("KeloAbilities?.openStonePanel"),'Abilities owner route missing');
assert(luxe.includes("KeloMissionsUI")&&luxe.includes("optional:true"),'Missions must remain owner-gated');
assert(luxe.includes("KeloSettingsUI")&&luxe.includes("optional:true"),'Settings must remain owner-gated');
assert(engineC.includes("tool === 'missions'")&&engineC.includes('acceso social preparado'),'Missions placeholder contract drifted');
assert(engineC.includes("tool === 'settings'")&&engineC.includes('Zoom HD por ahora'),'Settings placeholder contract drifted');
assert(engineQ.includes('legacy: mission prototype'),'Legacy Maestro trial classification missing');
assert(character.includes('window.KeloCharacterCustomizer=')||character.includes('root.KeloCharacterCustomizer='),'Character Creator owner missing');
assert(selfUi.includes('openEmotes')&&selfUi.includes('window.KeloSelfInteractionUI'),'Emote UI owner missing');
assert(backpack.includes('window.KeloBackpackUI=Object.freeze'),'Backpack UI owner missing');
assert(market.includes('window.KeloMarketUI=Object.freeze'),'Market UI owner missing');
assert(house.includes('window.KELO_HOUSE_UI=Object.freeze'),'Property UI owner missing');
assert(studio.includes("document.querySelector('#lx-menu-panel .lx-menu-grid')"),'Creators launcher must reuse Luxe grid');
assert(playerHud.includes('KELO-INDEX')&&playerHud.includes('owner: Kelo Luxe Shell presentation'),'Combat HUD owner missing');
for(const id of ['kw-player-hud-wrap','kw-hud-hp-row','kw-hud-hp-bar','kw-hud-hp-text','kw-hud-mana-row','kw-hud-mana-bar','kw-hud-mana-text','kw-player-guide','kw-quick-actions-toggle','kw-quick-actions-options'])assert(playerHud.includes(id),'Combat HUD/quick rail missing required element: '+id);
for(const removed of ['kw-hud-avatar','kw-hud-name','kw-hud-id','kw-hud-clan','kw-hud-nobility','kw-hud-title','kw-hud-gold'])assert(!playerHud.includes(removed),'Permanent profile metadata returned: '+removed);
assert(playerHud.includes('body:not(.social-mode) #kw-player-hud-wrap{display:block}'),'Combat HUD must reveal only outside social mode');
assert(playerHud.includes('#kw-player-hud-wrap')&&playerHud.includes('display:none'),'Combat HUD must hide by default');
assert(playerHud.includes("finite(p?.hp)")&&playerHud.includes("finite(p?.maxHp)"),'Combat HUD must consume real HP');
assert(playerHud.includes("p?.mana??state?.playerProfile?.mana")&&playerHud.includes("'— / —'"),'Mana unavailable contract missing');
assert(playerHud.includes("root.KeloPvPWorld?.state")&&playerHud.includes('KELO_COMBAT_ENABLED'),'PvP owner compatibility read missing');
assert(playerHud.includes('env(safe-area-inset-top,0px)')&&playerHud.includes('env(safe-area-inset-right,0px)'),'iOS quick-actions safe area support missing');
assert(playerHud.includes('[shop,menu,pvp,guide,fullscreen]')&&playerHud.includes('quickOptions.appendChild(node)'),'Right rail must reuse the five existing controls instead of duplicating them');
assert(playerHud.includes("shop.textContent='Boutique'")&&playerHud.includes("guide.href='guide.html'"),'Boutique/Guide rail reuse contract missing');
assert(playerHud.includes("quickToggle.setAttribute('aria-expanded','false')")&&playerHud.includes("quickToggle.setAttribute('aria-controls','kw-quick-actions-options')"),'Quick-actions toggle accessibility contract missing');
assert(playerHud.includes("quickOptions.setAttribute('aria-hidden','true')")&&playerHud.includes("pointer-events:none!important")&&playerHud.includes(".kw-quick-actions-open .kw-quick-actions-options"),'Collapsed quick-actions pointer isolation missing');
assert(playerHud.includes('opacity .21s ease')&&playerHud.includes('translateY(-6px) scale(.97)'),'Quick-actions lightweight transition missing');
assert(playerHud.includes("const autoCloseActions=new Set([shop,menu,pvp,guide].filter(Boolean))"),'Owner-backed quick actions must auto-close without replacing their handlers');
assert(!playerHud.includes('shop.onclick=')&&!playerHud.includes('menu.onclick=')&&!playerHud.includes('pvp.onclick=')&&!playerHud.includes('fullscreen.onclick='),'Player HUD must not replace existing action handlers');
assert(playerHud.includes("rail:'collapsible-five'")&&playerHud.includes("version:'luxe-player-hud-v1.2.0'"),'Collapsible rail audit metadata missing');
assert(!playerHud.includes('grid-template-columns:repeat(2,44px)'),'Deprecated 2x2 rail returned');
assert(!playerHud.includes('setInterval('),'Combat HUD must not poll');
assert((playerHud.match(/requestAnimationFrame\(/g)||[]).length===1,'Combat HUD may use one initial RAF only');
assert(!/STATE\s*\.\s*gold\s*[+\-*/]?=/.test(playerHud),'Combat HUD must not mutate gold');
assert(!/\.hp\s*[+\-*/]?=/.test(playerHud),'Combat HUD must not mutate HP');
assert(index.includes('src/ui/luxe-player-hud.js?v=3'),'Combat HUD runtime include missing');
assert(!index.includes('id="telemetry-bar"'),'Legacy telemetry returned');
assert(!index.includes('id="kelo-guide-link"'),'Legacy guide returned');
assert(index.includes('<div id="ui-layer"><div class="action-bar"'),'UI layer owner surface drifted');
console.log(JSON.stringify({status:'PASS',owner:'Kelo Luxe Shell presentation',layout:'pvp-only-combat-v1',socialHudHidden:true,pvpResources:['hp','mana'],rightRail:{launcher:'collapsible',default:'closed',actions:['Boutique','Menu','PvP','Guía','Pantalla completa']},noProfileMetadataInPersistentHud:true,noPolling:true,tokenInputLocks:true},null,2));
