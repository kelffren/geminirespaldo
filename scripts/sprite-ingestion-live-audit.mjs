/* KELO-INDEX
 * area: QA / UNIVERSAL SPRITE INGESTION / BROWSER
 * owner: Playwright visual and runtime acceptance audit
 * keys: SPRITE PLAYWRIGHT BEFORE AFTER ANIMATION RUNTIME SCREENSHOT CORPUS DIAGNOSTICS
 * purpose: run the complete adversarial lab, verify real animation and capture durable evidence
 * online: local static server or deployed GitHub Pages; no auth/persistence
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const base = (process.env.AUDIT_URL || 'http://127.0.0.1:4173/').replace(/\/+$/, '');
const url = `${base}/sprite-ingestion-lab.html`;
const outputDirectory = path.resolve(process.env.SPRITE_AUDIT_OUTPUT || 'artifacts/sprite-ingestion');
fs.mkdirSync(outputDirectory, {recursive: true});
const executablePath = process.env.CHROME_BIN || undefined;
const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});

async function canvasData(page, selector) {
  return page.locator(selector).evaluate(canvas => canvas.toDataURL());
}

async function waitForCanvasChange(page, selector, baseline, timeout = 2200) {
  await page.waitForFunction(({selector, baseline}) => {
    const canvas = document.querySelector(selector);
    return !!canvas && typeof canvas.toDataURL === 'function' && canvas.toDataURL() !== baseline;
  }, {selector, baseline}, {timeout, polling: 50});
  return canvasData(page, selector);
}

async function selectionDiagnostics(page) {
  return page.evaluate(() => {
    try {
      return globalThis.__KELO_SPRITE_INGESTION_DIAGNOSTICS__?.() || null;
    } catch (error) {
      return {diagnosticError:String(error?.stack || error)};
    }
  });
}

try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1050}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 45_000});
  await page.waitForFunction(() => globalThis.__KELO_SPRITE_INGESTION_LAB__?.ready, null, {timeout: 240_000});
  const report = await page.evaluate(() => globalThis.__KELO_SPRITE_INGESTION_LAB__);
  if (!report.pass) {
    const failures = report.results?.filter(result => !result.statusMatches || (result.expectedStatus === 'VALIDATED' && (result.counts.missedFrames || result.counts.falseFrames))) || [];
    throw new Error(`SPRITE_ADVERSARIAL_CORPUS_FAILED:${JSON.stringify(failures)}`);
  }
  if (report.summary.completed < 20) throw new Error(`SPRITE_CORPUS_TOO_SMALL:${report.summary.completed}`);
  if (!report.results.some(result => result.tier === 'GOOD') || !report.results.some(result => result.tier === 'IRREGULAR') || !report.results.some(result => result.tier === 'EXTREME')) throw new Error('SPRITE_CORPUS_TIERS_MISSING');

  const halo = page.locator('.case').filter({hasText: 'White background halos'});
  await halo.click();
  await page.waitForTimeout(80);
  const first = await canvasData(page, '#after canvas');
  const runtimeFirst = await canvasData(page, '#game-canvas');
  let second;
  let runtimeSecond;
  try {
    second = await waitForCanvasChange(page, '#after canvas', first);
  } catch {
    throw new Error(`SPRITE_COMPILED_PREVIEW_NOT_ANIMATING:${JSON.stringify(await selectionDiagnostics(page))}`);
  }
  try {
    runtimeSecond = await waitForCanvasChange(page, '#game-canvas', runtimeFirst);
  } catch {
    throw new Error(`SPRITE_GAME_RUNTIME_NOT_ANIMATING:${JSON.stringify(await selectionDiagnostics(page))}`);
  }
  const directionButtons = page.locator('#directions button');
  if (await directionButtons.count() !== 4) throw new Error(`SPRITE_4D_PREVIEW_DIRECTIONS_MISSING:${JSON.stringify(await selectionDiagnostics(page))}`);
  await directionButtons.nth(1).click();
  let directionFrame;
  try {
    directionFrame = await waitForCanvasChange(page, '#after canvas', second);
  } catch {
    throw new Error(`SPRITE_DIRECTION_SWITCH_NO_VISUAL_CHANGE:${JSON.stringify(await selectionDiagnostics(page))}`);
  }

  await page.screenshot({path: path.join(outputDirectory, 'adversarial-lab-before-after-runtime.png'), fullPage: true});
  await page.locator('#before').screenshot({path: path.join(outputDirectory, 'before-irregular-halo.png')});
  await page.locator('#after').screenshot({path: path.join(outputDirectory, 'after-normalized-animation.png')});
  await page.locator('#game-canvas').screenshot({path: path.join(outputDirectory, 'runtime-kelo-avatar.png')});
  if (pageErrors.length) throw new Error(`SPRITE_LAB_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({ok: true, url, report, selection: await selectionDiagnostics(page), visual: {animationChanged: first !== second, runtimeChanged: runtimeFirst !== runtimeSecond, directionChanged: directionFrame !== second}, screenshots: fs.readdirSync(outputDirectory).sort()}, null, 2));
} finally {
  await browser.close();
}
