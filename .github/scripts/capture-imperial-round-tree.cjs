const { chromium } = require('playwright');
const fs = require('fs');

async function enterAsGuest(page) {
  const guest = page.getByText('Jugar como invitado', { exact: true });
  if (await guest.count()) {
    try { await guest.click({ timeout: 8000 }); } catch (_) {}
  }
  await page.waitForTimeout(1200);
}

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 844, height: 520 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failed = [];
  const treeResponses = [];
  page.on('requestfailed', req => failed.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));
  page.on('response', res => {
    if (res.url().includes('arbol-redondo.png')) treeResponses.push({ url: res.url(), status: res.status() });
  });

  const liveUrl = `${process.env.AUDIT_URL}?tree-visual-audit=${Date.now()}`;
  const response = await page.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!response?.ok()) throw new Error(`LIVE page HTTP ${response?.status()}`);
  await enterAsGuest(page);

  await page.waitForFunction(() => window.KELO_PROPERTY_CATALOG?.get?.('imperial:arbol-redondo'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.KELO_PROP_CONTRACT?.props?.some?.(p => p.id === 'plaza-round-tree-imperial'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.KELO_GENERIC_PROPS?.isAssetReady?.('plazaRoundTree') === true, null, { timeout: 30000 });

  const compileAudit = await page.evaluate(async () => {
    const template = window.KELO_PROPERTY_CATALOG.get('imperial:arbol-redondo');
    const compilerModule = await import(`./src/studio/compiler/world-compiler.mjs?tree=${Date.now()}`);
    const previewModule = await import(`./src/studio/render/studio-asset-preview-service.mjs?tree=${Date.now()}`);
    const prefab = {
      id: template.id,
      version: 1,
      label: template.label,
      category: template.category,
      bounds: { w: template.width, h: template.height },
      components: {
        visual: { source: 'property-catalog', parts: template.parts || [] },
        ...(template.collision ? { collider: { rect: template.collision, blocksMovement: true } } : {})
      },
      dependencies: [...new Set((template.parts || []).map(p => p.assetKey).filter(Boolean))]
    };
    const compiler = compilerModule.createWorldCompiler({ resolvePrefab: id => id === template.id ? prefab : { id } });
    const compiled = compiler.compile({
      worldId: 'audit:imperial-round-tree',
      settings: { chunkSize: 512 },
      dependencies: [], terrain: {}, navigation: { collisions: {} }, gameRules: {}, revision: { id: 'tree-visual-audit' },
      entities: [{ id: 'round-tree-compiled-1', prefabId: template.id, transform: { x: 1260, y: 1540, scale: 2 }, bounds: { w: template.width, h: template.height }, components: {} }]
    });
    const entity = compiled.chunks.flatMap(c => c.staticEntities).find(e => e.id === 'round-tree-compiled-1');
    const part = entity?.components?.visual?.parts?.[0];
    if (!entity || part?.assetKey !== 'imperialRoundTree' || !compiled.dependencies.includes('imperial:arbol-redondo')) {
      throw new Error('Tree compiler audit failed');
    }

    const overlay = document.createElement('section');
    overlay.id = 'tree-compiler-audit';
    overlay.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:520px;max-width:92vw;background:#081112;color:#eef6ef;border:1px solid rgba(235,198,91,.55);border-radius:22px;padding:20px;font-family:Arial,sans-serif;box-shadow:0 28px 90px #000;box-sizing:border-box';
    const heading = document.createElement('div');
    heading.innerHTML = '<div style="font:700 12px Georgia,serif;letter-spacing:.16em;color:#f0d77d">KELO WORLD · COMPILER REAL</div><div style="font-size:25px;font-weight:800;margin-top:6px">Árbol Redondo Imperial</div><div style="font-size:11px;color:#8ca59c;margin-top:4px">imperial:arbol-redondo → static entity</div>';
    const previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'margin:16px auto 12px;width:320px;height:320px;display:flex;align-items:center;justify-content:center;border-radius:16px;overflow:hidden;background:#101b1d;background-image:linear-gradient(45deg,#17282a 25%,transparent 25%),linear-gradient(-45deg,#17282a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#17282a 75%),linear-gradient(-45deg,transparent 75%,#17282a 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0;border:1px solid rgba(255,255,255,.08)';
    const canvas = document.createElement('canvas');
    previewWrap.appendChild(canvas);
    const meta = document.createElement('div');
    meta.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px"><div style="background:#102021;padding:9px;border-radius:9px"><b style="color:#f0d77d">SOURCE</b><br>1254 × 1254 PNG</div><div style="background:#102021;padding:9px;border-radius:9px"><b style="color:#f0d77d">CATALOG</b><br>${template.width} × ${template.height}</div><div style="background:#102021;padding:9px;border-radius:9px"><b style="color:#7fe0a8">COMPILED ✓</b><br>${entity.bounds.w} × ${entity.bounds.h}</div><div style="background:#102021;padding:9px;border-radius:9px"><b style="color:#7fe0a8">ASSET ✓</b><br>${part.assetKey}</div></div>`;
    overlay.append(heading, previewWrap, meta);
    document.documentElement.appendChild(overlay);
    const preview = previewModule.createStudioAssetPreviewService({ assetCatalog: window.KELO_PROPERTY_CATALOG, atlasContract: window.KELO_ATLAS_CONTRACT, devicePixelRatio: 1 });
    await preview.renderThumbnail(canvas, template, { cssSize: 300, padding: 8 });
    window.__TREE_PREVIEW = preview;
    return { templateId: template.id, compiledBounds: entity.bounds, assetKey: part.assetKey, dependencies: compiled.dependencies };
  });

  await page.locator('#tree-compiler-audit').screenshot({ path: 'artifacts/compiled-arbol-redondo.png' });
  await page.evaluate(() => {
    document.getElementById('tree-compiler-audit')?.remove();
    window.__TREE_PREVIEW?.close?.();
    delete window.__TREE_PREVIEW;
  });

  await page.setViewportSize({ width: 844, height: 430 });
  await page.waitForFunction(() => typeof localPlayer !== 'undefined' && typeof camera !== 'undefined', null, { timeout: 30000 });
  await page.evaluate(() => {
    localPlayer.x = 1450; localPlayer.y = 1715; localPlayer.vx = 0; localPlayer.vy = 0;
    camera.x = 1360; camera.y = 1640; camera.targetX = 1360; camera.targetY = 1640; camera.lookOffsetX = 0; camera.lookOffsetY = 0;
    if (typeof input !== 'undefined') { input.normX = 0; input.normY = 0; input.touchActive = false; }
  });
  await page.waitForTimeout(1400);

  const liveAudit = await page.evaluate(() => {
    const prop = window.KELO_PROP_CONTRACT?.props?.find?.(p => p.id === 'plaza-round-tree-imperial');
    return {
      prop: prop ? { id: prop.id, asset: prop.asset, position: prop.position, size: prop.size, collider: prop.collider } : null,
      assetReady: window.KELO_GENERIC_PROPS?.isAssetReady?.('plazaRoundTree') === true,
      failed: window.KELO_GENERIC_PROP_AUDIT?.failed === true
    };
  });
  if (!liveAudit.prop || !liveAudit.assetReady || liveAudit.failed) throw new Error(`LIVE audit failed: ${JSON.stringify(liveAudit)}`);

  await page.screenshot({ path: 'artifacts/game-arbol-redondo.png', fullPage: false });
  fs.writeFileSync('artifacts/audit.json', JSON.stringify({ liveUrl, compileAudit, liveAudit, treeResponses, failedRequests: failed }, null, 2));
  console.log(JSON.stringify({ compileAudit, liveAudit, treeResponses, failedCount: failed.length }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

// Trigger marker: 2026-09-13 visual audit
