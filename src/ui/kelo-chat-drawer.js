/* KELO-INDEX
  area: UI / SOCIAL CHAT
  owner: KeloChatUI
  keys: CHAT WAZE BOTTOM SHEET PREMIUM KEYBOARD MOBILE LATEST MESSAGE
  purpose: presenta el chat real existente como una bandeja premium retraible sin duplicar transporte ni handlers
  authority: reutiliza #lx-chat-drawer, #lx-log, #lx-form, #lx-in y window.keloSay de luxe-shell
*/
(function (root) {
  'use strict';

  if (root.__KELO_CHAT_DRAWER_PREMIUM_V5__) return;
  root.__KELO_CHAT_DRAWER_PREMIUM_V5__ = true;

  var STYLE_ID = 'kelo-chat-premium-style-v5';
  var SHEET_ID = 'lx-chat-drawer';
  var TAB_ID = 'lx-chat-tab';
  var PREVIEW_ID = 'kc-latest-preview';
  var KEYBOARD_ID = 'kc-keyboard';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#kelo-luxe #${SHEET_ID}.kc-premium,
#${SHEET_ID}.kc-premium{
  --kc-gold:#f4c85f;
  --kc-gold-soft:rgba(244,200,95,.48);
  --kc-ink:#07110f;
  --kc-panel:rgba(9,23,20,.965);
  --kc-panel-2:rgba(14,31,27,.965);
  --kc-peek:154px;
  position:fixed!important;
  z-index:62!important;
  left:max(8px,env(safe-area-inset-left,0px))!important;
  right:max(8px,env(safe-area-inset-right,0px))!important;
  bottom:0!important;
  top:auto!important;
  width:auto!important;
  height:min(50dvh,480px)!important;
  max-height:50dvh!important;
  min-height:260px!important;
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
  border:1px solid rgba(244,200,95,.58)!important;
  border-bottom:0!important;
  border-radius:28px 28px 0 0!important;
  background:
    radial-gradient(110% 85% at 50% 0%,rgba(75,94,50,.20),transparent 58%),
    linear-gradient(180deg,var(--kc-panel-2),var(--kc-panel))!important;
  box-shadow:0 -16px 44px rgba(0,0,0,.48),0 -1px 0 rgba(255,226,143,.18) inset!important;
  -webkit-backdrop-filter:blur(20px) saturate(1.18)!important;
  backdrop-filter:blur(20px) saturate(1.18)!important;
  transform:translate3d(0,calc(100% - var(--kc-peek)),0)!important;
  transition:transform 240ms cubic-bezier(.22,.82,.28,1),box-shadow 240ms ease!important;
  pointer-events:none!important;
  isolation:isolate;
}
#${SHEET_ID}.kc-premium.open{
  transform:translate3d(0,0,0)!important;
  box-shadow:0 -22px 58px rgba(0,0,0,.58),0 -1px 0 rgba(255,226,143,.20) inset!important;
  pointer-events:auto!important;
}
#${SHEET_ID}.kc-premium.kc-dragging{transition:none!important}
#${SHEET_ID}.kc-premium .lx-chat-head{display:none!important}

#${TAB_ID}.kc-chat-tab{
  position:relative!important;
  flex:0 0 62px!important;
  width:100%!important;
  min-height:62px!important;
  margin:0!important;
  padding:19px 18px 7px!important;
  border:0!important;
  border-radius:27px 27px 0 0!important;
  background:transparent!important;
  color:#f8edcb!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
  font:800 18px/1 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif!important;
  letter-spacing:.01em!important;
  pointer-events:auto!important;
  touch-action:none!important;
  -webkit-tap-highlight-color:transparent!important;
  cursor:pointer!important;
}
#${TAB_ID} .kc-drag-handle{
  position:absolute;
  top:8px;
  left:50%;
  width:54px;
  height:5px;
  transform:translateX(-50%);
  border-radius:999px;
  background:linear-gradient(90deg,#e9b943,#ffdf7d,#e9b943);
  box-shadow:0 0 14px rgba(244,200,95,.22);
  opacity:.96;
}
#${TAB_ID} .kc-tab-left{display:flex;align-items:center;gap:11px;min-width:0}
#${TAB_ID} .kc-chat-icon{
  width:35px;height:35px;display:grid;place-items:center;flex:0 0 35px;
  border:1px solid rgba(244,200,95,.58);border-radius:11px;
  background:rgba(4,12,11,.42);color:var(--kc-gold);
  box-shadow:0 4px 14px rgba(0,0,0,.18) inset;
}
#${TAB_ID} .kc-chat-icon svg{width:22px;height:22px;display:block}
#${TAB_ID} .kc-chat-title{color:#f8d778;text-shadow:0 1px 10px rgba(244,200,95,.12)}
#${TAB_ID} .kc-tab-right{display:flex;align-items:center;gap:12px;flex:0 0 auto}
#${TAB_ID} .kc-unread{
  min-width:42px;height:25px;padding:0 10px;border-radius:999px;
  display:grid;place-items:center;border:1px solid rgba(244,200,95,.45);
  color:#fff7df;background:rgba(0,0,0,.22);font-size:13px;font-weight:800;
}
#${TAB_ID} .kc-unread[hidden]{display:none!important}
#${TAB_ID} .kc-chevron{font-size:25px;line-height:1;color:#f8d778;transform:translateY(-1px)}

#${PREVIEW_ID}.kc-latest-preview{
  flex:0 0 92px!important;
  min-height:92px!important;
  margin:0 12px 0!important;
  padding:10px 13px!important;
  border:1px solid rgba(244,200,95,.38)!important;
  border-radius:21px!important;
  background:linear-gradient(180deg,rgba(10,24,22,.88),rgba(7,17,16,.94))!important;
  color:#f8f3e7!important;
  display:flex!important;
  align-items:center!important;
  gap:12px!important;
  text-align:left!important;
  box-shadow:0 8px 24px rgba(0,0,0,.18) inset,0 8px 20px rgba(0,0,0,.10)!important;
  pointer-events:auto!important;
  touch-action:none!important;
  -webkit-tap-highlight-color:transparent!important;
  overflow:hidden!important;
}
#${SHEET_ID}.kc-premium.open #${PREVIEW_ID}{display:none!important}
.kc-preview-avatar{
  position:relative;flex:0 0 52px;width:52px;height:52px;border-radius:50%;
  display:grid;place-items:center;border:2px solid rgba(244,200,95,.78);
  background:radial-gradient(circle at 35% 30%,#35483f,#14201d 62%,#09100f);
  color:#ffe39a;font:900 17px/1 -apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;
  box-shadow:0 0 0 3px rgba(0,0,0,.22),0 7px 18px rgba(0,0,0,.25);
}
.kc-preview-online{
  position:absolute;right:-1px;bottom:2px;width:13px;height:13px;border-radius:50%;
  background:#56df7a;border:2px solid #10201b;box-shadow:0 0 9px rgba(86,223,122,.35);
}
.kc-preview-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}
.kc-preview-meta{display:flex;align-items:center;gap:10px;min-width:0}
.kc-preview-user{
  min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font:800 15px/1.15 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:#fffaf0;
}
.kc-preview-time{flex:0 0 auto;font:600 12px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:rgba(238,239,232,.58)}
.kc-preview-text{
  display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font:500 14px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:rgba(244,244,238,.78);
}

#${SHEET_ID}.kc-premium:not(.open) .lx-log,
#${SHEET_ID}.kc-premium:not(.open) .lx-chat-form,
#${SHEET_ID}.kc-premium:not(.open) .kc-keyboard{display:none!important;pointer-events:none!important}
#${SHEET_ID}.kc-premium.open .lx-log{
  display:flex!important;flex:1 1 auto!important;min-height:0!important;
  overflow-y:auto!important;overscroll-behavior:contain!important;
  flex-direction:column!important;gap:7px!important;
  padding:7px 14px 10px!important;background:transparent!important;
  scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important;
}
#${SHEET_ID}.kc-premium.open .lx-log::-webkit-scrollbar{display:none!important}
#${SHEET_ID}.kc-premium.open .lx-log>div{
  width:fit-content;max-width:88%;padding:8px 11px!important;border-radius:14px 14px 14px 5px!important;
  background:rgba(255,255,255,.065)!important;border:1px solid rgba(244,200,95,.14)!important;
  color:rgba(255,250,237,.90)!important;font:550 13px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif!important;
  box-shadow:0 5px 14px rgba(0,0,0,.10)!important;
}
#${SHEET_ID}.kc-premium.open .lx-chat-form{
  display:flex!important;flex:0 0 auto!important;gap:8px!important;
  padding:9px 12px 10px!important;border-top:1px solid rgba(244,200,95,.14)!important;background:rgba(5,14,12,.52)!important;
}
#${SHEET_ID}.kc-premium .lx-chat-form input{
  min-width:0!important;flex:1!important;height:42px!important;padding:0 13px!important;
  border:1px solid rgba(244,200,95,.28)!important;border-radius:14px!important;outline:0!important;
  background:rgba(0,0,0,.26)!important;color:#fff9e8!important;font-size:16px!important;
  user-select:text!important;-webkit-user-select:text!important;
}
#${SHEET_ID}.kc-premium .lx-chat-form input::placeholder{color:rgba(255,249,232,.42)!important}
#${SHEET_ID}.kc-premium .lx-chat-form button{
  min-width:44px!important;height:42px!important;border-radius:14px!important;
  border:1px solid rgba(244,200,95,.56)!important;background:linear-gradient(180deg,#d9ad47,#a77a22)!important;
  color:#171109!important;font-weight:900!important;box-shadow:0 4px 12px rgba(0,0,0,.20)!important;
}
.kc-native-toggle{
  flex:0 0 44px!important;min-width:44px!important;height:42px!important;border-radius:14px!important;
  border:1px solid rgba(244,200,95,.22)!important;background:rgba(255,255,255,.055)!important;color:#f8d778!important;
  font-size:17px!important;
}

#${KEYBOARD_ID}.kc-keyboard{
  flex:0 0 auto!important;padding:7px 6px calc(8px + env(safe-area-inset-bottom,0px))!important;
  border-top:1px solid rgba(244,200,95,.17)!important;background:rgba(3,10,9,.84)!important;
  -webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;
  display:none!important;pointer-events:auto!important;
}
#${SHEET_ID}.kc-premium.open.kc-keyboard-open #${KEYBOARD_ID}{display:block!important}
.kc-key-row{display:flex;justify-content:center;gap:4px;margin:4px 0}
.kc-key{
  height:34px;min-width:29px;flex:1 1 0;padding:0 5px;border-radius:8px;
  border:1px solid rgba(244,200,95,.16);background:linear-gradient(180deg,#1a2824,#101a17);
  color:#fff4d2;font:750 13px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;
  box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 3px 7px rgba(0,0,0,.20);
  touch-action:manipulation;-webkit-tap-highlight-color:transparent;
}
.kc-key:active{transform:translateY(1px);background:#25352f}
.kc-key.kc-wide{flex:1.45 1 0}.kc-key.kc-space{flex:4.4 1 0}.kc-key.kc-send{flex:1.55 1 0;background:linear-gradient(180deg,#e1b64d,#ac7d25);color:#160f07;border-color:#f2ce70;font-weight:950}
.kc-key.kc-active{border-color:rgba(255,219,121,.72);background:#2c382e;color:#ffe399}

@media (max-height:560px) and (orientation:landscape){
  #${SHEET_ID}.kc-premium{--kc-peek:112px!important;min-height:190px!important;height:50dvh!important;border-radius:22px 22px 0 0!important}
  #${TAB_ID}.kc-chat-tab{flex-basis:48px!important;min-height:48px!important;padding-top:16px!important}
  #${PREVIEW_ID}.kc-latest-preview{flex-basis:64px!important;min-height:64px!important;margin:0 9px!important;padding:6px 10px!important;border-radius:16px!important}
  .kc-preview-avatar{width:40px;height:40px;flex-basis:40px;font-size:13px}
  .kc-preview-online{width:11px;height:11px}
  .kc-preview-text{font-size:12px}.kc-preview-user{font-size:13px}
  .kc-key{height:29px;font-size:11px}.kc-key-row{margin:2px 0}
  #${KEYBOARD_ID}.kc-keyboard{padding-top:3px!important;padding-bottom:calc(4px + env(safe-area-inset-bottom,0px))!important}
}
@media (prefers-reduced-motion:reduce){#${SHEET_ID}.kc-premium{transition:none!important}}
`;
    document.head.appendChild(style);
  }

  function formatTime(date) {
    var d = date || new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function initials(name) {
    var clean = String(name || 'KW').trim();
    if (!clean) return 'KW';
    var bits = clean.split(/\s+|_/).filter(Boolean);
    return ((bits[0] || 'K').charAt(0) + (bits[1] ? bits[1].charAt(0) : '')).toUpperCase().slice(0, 2);
  }

  function parseLine(raw) {
    var text = String(raw || '').trim();
    var split = text.indexOf(':');
    if (split > 0) {
      return { who: text.slice(0, split).trim() || 'Kelo World', text: text.slice(split + 1).trim() || '…' };
    }
    return { who: 'Kelo World', text: text || 'Sin mensajes todavía' };
  }

  function makeSvgIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 5.5h13a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H11l-4.9 3.2.9-3.2H5.5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/></svg>';
  }

  function createTab() {
    var old = document.getElementById(TAB_ID);
    if (old) old.remove();
    var tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.type = 'button';
    tab.className = 'kc-chat-tab';
    tab.setAttribute('aria-controls', SHEET_ID);
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-label', 'Abrir chat');
    tab.innerHTML = '<span class="kc-drag-handle" aria-hidden="true"></span>' +
      '<span class="kc-tab-left"><span class="kc-chat-icon">' + makeSvgIcon() + '</span><span class="kc-chat-title">Chat</span></span>' +
      '<span class="kc-tab-right"><span class="kc-unread" hidden>0</span><span class="kc-chevron" aria-hidden="true">⌃</span></span>';
    return tab;
  }

  function createPreview() {
    var old = document.getElementById(PREVIEW_ID);
    if (old) old.remove();
    var preview = document.createElement('button');
    preview.id = PREVIEW_ID;
    preview.type = 'button';
    preview.className = 'kc-latest-preview';
    preview.setAttribute('aria-label', 'Último mensaje. Toca o desliza hacia arriba para abrir el chat');
    preview.innerHTML = '<span class="kc-preview-avatar" aria-hidden="true"><span class="kc-preview-initials">KW</span><span class="kc-preview-online"></span></span>' +
      '<span class="kc-preview-copy"><span class="kc-preview-meta"><strong class="kc-preview-user">Kelo World</strong><time class="kc-preview-time"></time></span><span class="kc-preview-text">Sin mensajes todavía</span></span>';
    return preview;
  }

  var letters = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l','ñ'],
    ['⇧','z','x','c','v','b','n','m','⌫'],
    ['123','🙂','espacio','➤']
  ];
  var numbers = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['-','/',';',':','(',')','$','&','@','"'],
    ['#+=','.',',','?','!','\'','⌫'],
    ['ABC','🙂','espacio','➤']
  ];
  var emojis = [
    ['😀','😂','😍','😎','🥳','😡','😭','🔥','⚔️','🛡️'],
    ['👍','👎','👏','🙏','💎','👑','❤️','💀','✨','🎮'],
    ['ABC','GG','Vamos','Ayuda','Trade','⌫'],
    ['123','espacio','➤']
  ];

  function createKeyboard() {
    var old = document.getElementById(KEYBOARD_ID);
    if (old) old.remove();
    var keyboard = document.createElement('div');
    keyboard.id = KEYBOARD_ID;
    keyboard.className = 'kc-keyboard';
    keyboard.setAttribute('role', 'group');
    keyboard.setAttribute('aria-label', 'Teclado KELO');
    return keyboard;
  }

  function makeKey(label, mode, shifted) {
    var key = document.createElement('button');
    key.type = 'button';
    key.className = 'kc-key';
    key.dataset.key = label;
    var visible = label;
    if (mode === 'abc' && shifted && /^[a-zñ]$/.test(label)) visible = label.toUpperCase();
    key.textContent = visible;
    if (label === 'espacio') key.classList.add('kc-space');
    if (label === '➤') key.classList.add('kc-send');
    if (label === '⇧' || label === '⌫' || label === '123' || label === 'ABC' || label === '#+=' || label === '🙂') key.classList.add('kc-wide');
    if (label === '⇧' && shifted) key.classList.add('kc-active');
    return key;
  }

  function maxChars(input) {
    var n = Number(input && input.maxLength);
    return Number.isFinite(n) && n > 0 ? n : 280;
  }

  function setValue(input, value) {
    if (!input) return;
    input.value = String(value || '').slice(0, maxChars(input));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertText(input, value) {
    var start = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
    var end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
    var next = input.value.slice(0, start) + value + input.value.slice(end);
    setValue(input, next);
    var cursor = Math.min(start + value.length, input.value.length);
    try { input.setSelectionRange(cursor, cursor); } catch (_) {}
  }

  function backspace(input) {
    var start = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
    var end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
    if (start !== end) {
      setValue(input, input.value.slice(0, start) + input.value.slice(end));
      try { input.setSelectionRange(start, start); } catch (_) {}
      return;
    }
    if (start <= 0) return;
    var left = Array.from(input.value.slice(0, start));
    left.pop();
    var prefix = left.join('');
    setValue(input, prefix + input.value.slice(start));
    try { input.setSelectionRange(prefix.length, prefix.length); } catch (_) {}
  }

  function sendExistingForm(form) {
    if (!form) return;
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function mount() {
    var drawer = document.getElementById(SHEET_ID);
    var log = document.getElementById('lx-log');
    var form = document.getElementById('lx-form');
    var input = document.getElementById('lx-in');
    if (!drawer || !log || !form || !input) return false;
    if (drawer.dataset.keloPremiumChat === 'v5') return true;

    injectStyle();
    drawer.dataset.keloPremiumChat = 'v5';
    drawer.classList.add('kc-premium');
    drawer.classList.remove('open', 'kc-keyboard-open', 'kc-dragging');
    drawer.setAttribute('role', 'region');
    drawer.setAttribute('aria-label', 'Chat de KELO WORLD');
    drawer.setAttribute('aria-expanded', 'false');

    var tab = createTab();
    var preview = createPreview();
    var keyboard = createKeyboard();
    drawer.insertBefore(tab, drawer.firstChild);
    tab.insertAdjacentElement('afterend', preview);
    drawer.appendChild(keyboard);

    var nativeToggle = form.querySelector('.kc-native-toggle');
    if (!nativeToggle) {
      nativeToggle = document.createElement('button');
      nativeToggle.type = 'button';
      nativeToggle.className = 'kc-native-toggle';
      nativeToggle.setAttribute('aria-label', 'Cambiar entre teclado KELO y teclado del teléfono');
      nativeToggle.textContent = '⌨︎';
      form.insertBefore(nativeToggle, form.lastElementChild);
    }

    var mode = 'abc';
    var shifted = false;
    var open = false;
    var keyboardOpen = false;
    var nativeMode = false;
    var unread = 0;
    var dragMoved = false;
    var previewStamp = '';

    function updateBadge() {
      var badge = tab.querySelector('.kc-unread');
      if (!badge) return;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = unread <= 0;
    }

    function updatePreview(countUnread) {
      var latest = log.lastElementChild;
      var parsed = latest ? parseLine(latest.textContent) : { who: 'Kelo World', text: 'Sin mensajes todavía' };
      var stamp = parsed.who + '\n' + parsed.text;
      preview.querySelector('.kc-preview-user').textContent = parsed.who;
      preview.querySelector('.kc-preview-text').textContent = parsed.text;
      preview.querySelector('.kc-preview-initials').textContent = initials(parsed.who);
      preview.querySelector('.kc-preview-time').textContent = latest ? formatTime(new Date()) : '';
      preview.setAttribute('aria-label', latest ? ('Último mensaje de ' + parsed.who + ': ' + parsed.text + '. Toca para abrir el chat') : 'Chat sin mensajes. Toca para abrir');
      if (countUnread && !open && stamp !== previewStamp) {
        unread += 1;
        updateBadge();
      }
      previewStamp = stamp;
    }

    function scrollLatest() {
      if (!log) return;
      requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; });
    }

    function setOpen(next) {
      open = !!next;
      drawer.classList.toggle('open', open);
      drawer.setAttribute('aria-expanded', String(open));
      tab.setAttribute('aria-expanded', String(open));
      tab.setAttribute('aria-label', open ? 'Cerrar chat' : 'Abrir chat');
      var chevron = tab.querySelector('.kc-chevron');
      if (chevron) chevron.textContent = open ? '⌄' : '⌃';
      drawer.style.removeProperty('transform');
      if (open) {
        unread = 0;
        updateBadge();
        updatePreview(false);
        scrollLatest();
      } else {
        setKeyboard(false);
        updatePreview(false);
      }
    }

    function setKeyboard(next) {
      keyboardOpen = !!next && open && !nativeMode;
      drawer.classList.toggle('kc-keyboard-open', keyboardOpen);
      if (keyboardOpen) renderKeyboard();
      setTimeout(scrollLatest, 30);
    }

    function setNativeMode(next) {
      nativeMode = !!next;
      if (nativeMode) {
        input.readOnly = false;
        input.setAttribute('inputmode', 'text');
        drawer.classList.remove('kc-keyboard-open');
        keyboardOpen = false;
        nativeToggle.classList.add('kc-active');
        nativeToggle.setAttribute('aria-pressed', 'true');
        setTimeout(function () { try { input.focus(); } catch (_) {} }, 0);
      } else {
        input.readOnly = true;
        input.setAttribute('inputmode', 'none');
        nativeToggle.classList.remove('kc-active');
        nativeToggle.setAttribute('aria-pressed', 'false');
        setKeyboard(true);
        try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (__){ } }
      }
    }

    function layout() {
      return mode === 'num' ? numbers : mode === 'emoji' ? emojis : letters;
    }

    function renderKeyboard() {
      keyboard.textContent = '';
      layout().forEach(function (row) {
        var line = document.createElement('div');
        line.className = 'kc-key-row';
        row.forEach(function (label) { line.appendChild(makeKey(label, mode, shifted)); });
        keyboard.appendChild(line);
      });
    }

    function onKey(label) {
      if (label === '⇧') { shifted = !shifted; renderKeyboard(); return; }
      if (label === '123') { mode = 'num'; shifted = false; renderKeyboard(); return; }
      if (label === 'ABC') { mode = 'abc'; shifted = false; renderKeyboard(); return; }
      if (label === '#+=') { mode = 'num'; renderKeyboard(); return; }
      if (label === '🙂') { mode = 'emoji'; shifted = false; renderKeyboard(); return; }
      if (label === '⌫') { backspace(input); return; }
      if (label === 'espacio') { insertText(input, ' '); return; }
      if (label === '➤') {
        if (String(input.value || '').trim()) sendExistingForm(form);
        return;
      }
      var value = label;
      if (mode === 'abc' && shifted && /^[a-zñ]$/.test(value)) {
        value = value.toUpperCase();
        shifted = false;
        renderKeyboard();
      }
      if (value === 'GG' || value === 'Vamos' || value === 'Ayuda' || value === 'Trade') value += ' ';
      insertText(input, value);
    }

    function bindDragSurface(surface, tapAction) {
      var startY = 0;
      var startOpen = false;
      var activePointer = null;
      surface.addEventListener('pointerdown', function (event) {
        if (event.button != null && event.button !== 0) return;
        startY = event.clientY;
        startOpen = open;
        activePointer = event.pointerId;
        dragMoved = false;
        drawer.classList.add('kc-dragging');
        try { surface.setPointerCapture(event.pointerId); } catch (_) {}
      });
      surface.addEventListener('pointermove', function (event) {
        if (activePointer !== event.pointerId) return;
        var dy = event.clientY - startY;
        if (Math.abs(dy) > 7) dragMoved = true;
        if (startOpen) {
          drawer.style.setProperty('transform', 'translate3d(0,' + Math.max(0, dy) + 'px,0)', 'important');
        } else {
          drawer.style.setProperty('transform', 'translate3d(0,calc(100% - var(--kc-peek) + ' + Math.min(0, dy) + 'px),0)', 'important');
        }
        if (dragMoved) event.preventDefault();
      }, { passive: false });
      function finish(event) {
        if (activePointer !== event.pointerId) return;
        var dy = event.clientY - startY;
        activePointer = null;
        drawer.classList.remove('kc-dragging');
        drawer.style.removeProperty('transform');
        if (dy <= -44) setOpen(true);
        else if (dy >= 44) setOpen(false);
        else if (!dragMoved) tapAction();
        dragMoved = false;
      }
      surface.addEventListener('pointerup', finish);
      surface.addEventListener('pointercancel', function (event) {
        if (activePointer !== event.pointerId) return;
        activePointer = null;
        drawer.classList.remove('kc-dragging');
        drawer.style.removeProperty('transform');
        dragMoved = false;
      });
    }

    bindDragSurface(tab, function () { setOpen(!open); });
    bindDragSurface(preview, function () { setOpen(true); });

    nativeToggle.setAttribute('aria-pressed', 'false');
    nativeToggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      setNativeMode(!nativeMode);
    });

    input.setAttribute('enterkeyhint', 'send');
    input.setAttribute('inputmode', 'none');
    input.readOnly = true;
    input.addEventListener('pointerdown', function () {
      if (!open) setOpen(true);
      if (!nativeMode) setKeyboard(true);
    });
    input.addEventListener('focus', function () {
      if (!nativeMode) setKeyboard(true);
    });

    keyboard.addEventListener('pointerdown', function (event) { event.preventDefault(); });
    keyboard.addEventListener('click', function (event) {
      var key = event.target.closest('.kc-key');
      if (!key) return;
      event.preventDefault();
      onKey(key.dataset.key || key.textContent || '');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) setOpen(false);
    });

    var logObserver = new MutationObserver(function (mutations) {
      var added = mutations.some(function (mutation) { return mutation.type === 'childList' && mutation.addedNodes.length > 0; });
      if (!added) return;
      updatePreview(true);
      if (open) scrollLatest();
    });
    logObserver.observe(log, { childList: true });

    root.addEventListener('orientationchange', function () {
      drawer.style.removeProperty('transform');
      if (open) setTimeout(scrollLatest, 120);
    });
    root.addEventListener('resize', function () {
      drawer.style.removeProperty('transform');
    }, { passive: true });
    root.addEventListener('pagehide', function () { logObserver.disconnect(); }, { once: true });

    updatePreview(false);
    updateBadge();
    renderKeyboard();
    setOpen(false);

    root.KeloChatUI = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!open); },
      showKeyboard: function () { if (!open) setOpen(true); setNativeMode(false); },
      hideKeyboard: function () { setKeyboard(false); },
      useNativeKeyboard: function () { if (!open) setOpen(true); setNativeMode(true); },
      refreshPreview: function () { updatePreview(false); },
      isOpen: function () { return open; }
    };

    root.dispatchEvent(new CustomEvent('kelo:chat-ui-ready', { detail: { version: 'premium-v5', maxHeight: '50dvh', latestPreview: true } }));
    return true;
  }

  function boot() {
    if (mount()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (mount() || tries >= 80) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
