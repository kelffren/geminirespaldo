import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [], failedRequests = [], httpErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

let loaded = false;
for (let attempt = 1; attempt <= 24; attempt++) {
  await page.goto(`${base}?nobility-audit=${Date.now()}-${attempt}`, { waitUntil: 'networkidle', timeout: 45000 });
  loaded = await page.evaluate(() => window.KELO_NOBILITY_AUDIT?.ready === true && ['nobility-v1.1','nobility-v1.2'].includes(window.KeloNobility?.version));
  if (loaded) break;
  await page.waitForTimeout(5000);
}
if (!loaded) throw new Error('LIVE never reached supported nobility contract');

consoleErrors.length = 0; failedRequests.length = 0; httpErrors.length = 0;
await page.goto(`${base}?nobility-audit=final-${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(() => {
  const api = window.KeloNobility, audit = window.KELO_NOBILITY_AUDIT;
  if (!api || !audit || typeof STATE === 'undefined') return { ok: false, reason: 'missing runtime contract' };

  const original = JSON.parse(JSON.stringify({ gold: STATE.gold, kc: STATE.kc, nobility: STATE.nobility || null }));
  STATE.gold = 6000000000;
  STATE.kc = 5000;
  STATE.nobility = { donation: 0, donatedToday: 0, donationDay: new Date().toISOString().slice(0, 10), history: [] };

  const snap = () => ({ donation: api.getDonation(), position: api.getPosition(), rank: api.getRank() });
  const start = snap();
  const knightDonation = api.donateGold(30000000); const knight = snap();
  const baronDonation = api.donateKC(1400); const baron = snap();
  const toEarl = api.amountToNextRank(); if (toEarl.amount > 0) api.donateGold(toEarl.amount); const earl = snap();
  const toTop50 = api.amountToNextRank(); if (toTop50.amount > 0) api.donateGold(toTop50.amount); const duke = snap();
  const toTop15 = api.amountToNextRank(); if (toTop15.amount > 0) api.donateGold(toTop15.amount); const prince = snap();
  const toTop3 = api.amountToNextRank(); if (toTop3.amount > 0) api.donateGold(toTop3.amount); const king = snap();

  STATE.gold = original.gold;
  STATE.kc = original.kc;
  STATE.nobility = original.nobility;
  if (typeof saveState === 'function') saveState();
  api.open();

  return { ok: true, audit, apiVersion: api.version, start, knightDonation, knight, baronDonation, baron, earl, duke, prince, king,
    panelVisible: getComputedStyle(document.getElementById('kelo-nobility')).display !== 'none',
    menuButton: !!document.getElementById('kelo-nobility-menu-btn'), title: document.title };
});

await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/live-nobility.png', fullPage: false });
const report = { result, consoleErrors, failedRequests, httpErrors };
fs.writeFileSync('artifacts/nobility-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (!result.ok) throw new Error(result.reason || 'Nobility runtime missing');
if (result.audit?.version !== 'nobility-v1.1' || !result.audit?.ready || !result.audit?.menuButton) throw new Error('Nobility audit contract invalid');
if (!['nobility-v1.1','nobility-v1.2'].includes(result.apiVersion)) throw new Error(`Unsupported nobility wrapper ${result.apiVersion}`);
if (result.audit?.kcToDonation !== 50000) throw new Error('KC conversion mismatch');
if (JSON.stringify(result.audit?.fixedRanks) !== JSON.stringify([30000000,100000000,200000000])) throw new Error('Fixed rank thresholds mismatch');
if (JSON.stringify(result.audit?.rankedTiers) !== JSON.stringify([50,15,3])) throw new Error('Ranking thresholds mismatch');
if (!result.panelVisible || !result.menuButton) throw new Error('Nobility UI did not open on mobile');
if (!result.knightDonation?.ok || result.knight.rank?.id !== 'knight' || result.knight.rank?.power !== 1) throw new Error(`Knight progression failed: ${JSON.stringify(result.knight)}`);
if (!result.baronDonation?.ok || result.baron.rank?.id !== 'baron' || result.baron.rank?.power !== 3) throw new Error(`Baron progression failed: ${JSON.stringify(result.baron)}`);
if (result.earl.rank?.id !== 'earl' || result.earl.rank?.power !== 5 || result.earl.donation !== 200000000) throw new Error(`Earl progression failed: ${JSON.stringify(result.earl)}`);
if (result.duke.position > 50 || result.duke.rank?.id !== 'duke' || result.duke.rank?.power !== 7) throw new Error(`Top 50 progression failed: ${JSON.stringify(result.duke)}`);
if (result.prince.position > 15 || result.prince.rank?.id !== 'prince' || result.prince.rank?.power !== 9) throw new Error(`Top 15 progression failed: ${JSON.stringify(result.prince)}`);
if (result.king.position > 3 || result.king.rank?.id !== 'king' || result.king.rank?.power !== 12) throw new Error(`Top 3 progression failed: ${JSON.stringify(result.king)}`);
if (consoleErrors.length) throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if (failedRequests.length) throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if (httpErrors.length) throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
