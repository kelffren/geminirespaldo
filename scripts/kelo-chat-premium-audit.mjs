import fs from 'node:fs';
import process from 'node:process';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const index = read('index.html');
const chat = read('src/ui/kelo-chat-drawer.js');
const bridge = read('src/ui/kelo-chat-integration-bridge.js');
const shell = read('src/ui/luxe-shell.js');

const failures = [];
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: !!pass, detail });
  if (!pass) failures.push(name + (detail ? ` — ${detail}` : ''));
}

const shellPos = index.indexOf('src/ui/luxe-shell.js');
const chatPos = index.indexOf('src/ui/kelo-chat-drawer.js');
const bridgePos = index.indexOf('src/ui/kelo-chat-integration-bridge.js');
const chatLoads = (index.match(/src\/ui\/kelo-chat-drawer\.js/g) || []).length;
const bridgeLoads = (index.match(/src\/ui\/kelo-chat-integration-bridge\.js/g) || []).length;

check('chat script is booted exactly once', chatLoads === 1, `found ${chatLoads}`);
check('integration bridge is booted exactly once', bridgeLoads === 1, `found ${bridgeLoads}`);
check('chat enhancer boots after luxe-shell', shellPos >= 0 && chatPos > shellPos);
check('integration bridge boots after premium chat', bridgePos > chatPos);
check('real chat drawer is reused', chat.includes("getElementById(SHEET_ID)") && chat.includes("SHEET_ID = 'lx-chat-drawer'"));
check('real log is reused', chat.includes("getElementById('lx-log')"));
check('real form is reused', chat.includes("getElementById('lx-form')"));
check('real input is reused', chat.includes("getElementById('lx-in')"));
check('existing send path is preserved', chat.includes('form.requestSubmit()') || chat.includes("dispatchEvent(new Event('submit'"));
check('enhancer owns no network transport', !/(new\s+WebSocket|XMLHttpRequest|\bfetch\s*\(|supabase\.)/.test(chat));
check('bridge owns no network transport', !/(new\s+WebSocket|XMLHttpRequest|\bfetch\s*\(|supabase\.)/.test(bridge));
check('sheet is anchored from bottom', /bottom\s*:\s*0!important/.test(chat));
check('sheet height is capped at half viewport', chat.includes('height:min(50dvh,480px)') && chat.includes('max-height:50dvh'));
check('premium top corners exist', chat.includes('border-radius:28px 28px 0 0'));
check('premium gold boundary exists', chat.includes('rgba(244,200,95,.58)'));
check('premium translucent dark material exists', chat.includes('backdrop-filter:blur(20px)') && chat.includes('--kc-panel'));
check('gold drag handle exists', chat.includes('kc-drag-handle') && chat.includes('linear-gradient(90deg,#e9b943,#ffdf7d,#e9b943)'));
check('collapsed latest-message preview exists', chat.includes('kc-latest-preview'));
check('collapsed preview reads only last message', chat.includes('log.lastElementChild'));
check('full log is hidden while collapsed', chat.includes(':not(.open) .lx-log'));
check('preview hides when expanded', chat.includes('.open #${PREVIEW_ID}{display:none!important}'));
check('drag up/down is implemented', chat.includes("addEventListener('pointerdown'") && chat.includes("addEventListener('pointermove'") && chat.includes("addEventListener('pointerup'"));
check('minimum drag threshold is explicit', chat.includes('dy <= -44') && chat.includes('dy >= 44'));
check('custom KELO keyboard exists', chat.includes("aria-label', 'Teclado KELO'") && chat.includes('kc-key-row'));
check('ABC layout exists', chat.includes("['q','w','e','r','t','y','u','i','o','p']"));
check('numeric layout exists', chat.includes("['1','2','3','4','5','6','7','8','9','0']"));
check('emoji layout exists', chat.includes("['😀','😂','😍','😎','🥳'"));
check('send key uses existing form', chat.includes("label === '➤'") && chat.includes('sendExistingForm(form)'));
check('native iPhone keyboard is suppressed by default', chat.includes("input.setAttribute('inputmode', 'none')") && chat.includes('input.readOnly = true'));
check('native keyboard fallback remains available', chat.includes('setNativeMode') && chat.includes("input.setAttribute('inputmode', 'text')"));
check('safe-area is respected', chat.includes('safe-area-inset-left') && chat.includes('safe-area-inset-right') && chat.includes('safe-area-inset-bottom'));
check('collapsed invisible area cannot steal world touch', chat.includes('pointer-events:none!important') && chat.includes('pointer-events:auto!important'));
check('incoming real messages refresh preview', chat.includes('new MutationObserver') && chat.includes("logObserver.observe(log, { childList: true })"));
check('unread badge resets on open', chat.includes('unread = 0') && chat.includes('updateBadge()'));
check('shell still owns keloSay transport', shell.includes('window.keloSay') && shell.includes('appendChat'));
check('bridge binds to real drawer state', bridge.includes("getElementById('lx-chat-drawer')") && bridge.includes("attributeFilter:['class']"));
check('bridge synchronizes existing menu open into premium state', bridge.includes("KeloChatUI.open") && bridge.includes("classList.contains('open')"));
check('bridge synchronizes close into premium state', bridge.includes('KeloChatUI.close'));
check('bridge acquires and releases game input lock', bridge.includes("api.acquire('kelo-chat-premium'") && bridge.includes('api.release(token)'));
check('bridge waits for premium chat ready event', bridge.includes("'kelo:chat-ui-ready'"));

console.log('\nKELO CHAT PREMIUM REFERENCE JUDGE');
console.log('Reference contract: Waze-style bottom sheet + one-message preview + KELO keyboard + Luxe state integration');
for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
console.log(`\nScore: ${checks.filter(c => c.pass).length}/${checks.length}`);

if (failures.length) {
  console.error('\nREFERENCE JUDGE FAILED:');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

console.log('\nREFERENCE JUDGE PASSED — implementation satisfies the structural/interaction contract.');
