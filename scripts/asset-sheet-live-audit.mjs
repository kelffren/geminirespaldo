/* KELO-INDEX
 * area: QA / CREATOR ASSET BRIDGE
 * owner: Asset Sheet Compiler browser proof
 * owns: mobile browser regression against the real Arboleskelo1 atlas
 * does-not-own: production UI, asset semantics or publication
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const base = String(process.env.AUDIT_URL || 'http://127.0.0.1:8000/');
const executablePath = process.env.CHROME_BIN || undefined;
const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:390,height:844}, deviceScaleFactor:1, acceptDownloads:true});
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.goto(new URL('CHATGPT_ASSET_UPLOAD_BRIDGE.md', base).href, {waitUntil:'domcontentloaded'});
await page.evaluate(async rootUrl => {
  document.body.replaceChildren();
  window.__assetSheetPreview = {atlases:[], templates:[], opened:null};
  window.KELO_ATLAS_CONTRACT = {register:(key, atlas) => window.__assetSheetPreview.atlases.push({key, atlas})};
  window.KELO_PROPERTY_CATALOG = {registerTemplate:template => { window.__assetSheetPreview.templates.push(template); return template; }};
  const module = await import(new URL('src/creators/ui/asset-sheet-workspace.mjs', rootUrl).href);
  await module.openAssetSheetWorkspace({root:window, openWorkspace:async(id, context) => { window.__assetSheetPreview.opened = {id, context}; return {id}; }});
}, base);

const source = path.resolve('assets/Arboleskelo1.PNG');
assert.ok(fs.existsSync(source), 'real Arboleskelo1.PNG fixture missing');
await page.setInputFiles('input[accept="image/png,image/webp,image/jpeg"]', source);
await page.getByRole('button', {name:'ANALYZE SHEET'}).click();
await page.waitForSelector('.kas-row', {timeout:30000});
const ui = await page.evaluate(() => ({
  status:document.querySelector('.kas-status')?.textContent || '',
  assets:document.querySelectorAll('.kas-row').length,
  boxes:document.querySelectorAll('.kas-box').length,
  families:[...document.querySelectorAll('.kas-row select:first-of-type')].map(select => select.value),
  mobileGrid:getComputedStyle(document.querySelector('.kas-grid')).gridTemplateColumns
}));
assert.equal(ui.assets, 18, `real atlas assets=${ui.assets}`);
assert.equal(ui.boxes, ui.assets, 'preview box parity');
assert.equal(ui.families.filter(value => value === 'tree').length, 5, 'five real tree candidates');
assert.ok(ui.mobileGrid.split(' ').length <= 1 || page.viewportSize().width > 820, `mobile layout=${ui.mobileGrid}`);

const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', {name:'EXPORT GALLERIES'}).click();
const download = await downloadPromise;
const artifactDir = path.resolve('artifacts/asset-sheet-compiler');
fs.mkdirSync(artifactDir, {recursive:true});
const manifestPath = path.join(artifactDir, 'arboleskelo1-manifest.json');
await download.saveAs(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.kind, 'kelo-asset-sheet-manifest');
assert.equal(manifest.atlas.kind, 'prop-atlas-irregular');
assert.equal(manifest.assets.length, ui.assets);
assert.equal(manifest.galleries.length, 4, `galleries=${manifest.galleries.length}`);
const rowShape = Array.from({length:3}, (_, rowIndex) => manifest.assets.filter(asset => asset.rowIndex === rowIndex).length);
assert.deepEqual(rowShape, [5, 6, 7], `row shape=${JSON.stringify(rowShape)}`);
assert.equal(manifest.assets.at(-1)?.sourceComponentIds?.length, 13, 'loose petals stay one asset');
assert.ok(manifest.assets.every(asset => asset.anchor?.kind === 'ground-pivot'), 'world-asset pivot reuse');
assert.ok(manifest.assets.every(asset => asset.collider?.authority === 'review-required'), 'collision remains review-only');

await page.screenshot({path:path.join(artifactDir, 'asset-sheet-mobile.png'), fullPage:true});
await page.getByRole('button', {name:'OPEN IN WORLD'}).click();
await page.waitForSelector('#kelo-asset-sheet-studio', {state:'detached'});
const worldPreview = await page.evaluate(() => ({atlases:window.__assetSheetPreview.atlases.length, templates:window.__assetSheetPreview.templates.length, workspace:window.__assetSheetPreview.opened?.id, draftAssets:window.__assetSheetPreview.opened?.context?.creatorAssetDraft?.assetCount}));
assert.equal(worldPreview.atlases, 1, 'existing atlas owner registration');
assert.equal(worldPreview.templates, ui.assets, 'existing catalog owner registration');
assert.equal(worldPreview.workspace, 'world', 'existing World workspace route');
assert.equal(worldPreview.draftAssets, ui.assets, 'World draft handoff');
await browser.close();
assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({status:'ASSET_SHEET_LIVE_AUDIT_OK', viewport:'390x844', assets:ui.assets, trees:ui.families.filter(value => value === 'tree').length, rowShape, galleries:manifest.galleries.length, loosePetals:manifest.assets.at(-1)?.sourceComponentIds?.length, worldPreview, screenshot:'artifacts/asset-sheet-compiler/asset-sheet-mobile.png'}));
