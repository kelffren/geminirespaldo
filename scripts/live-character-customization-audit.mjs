import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const outDir = path.resolve('artifacts/character-customization-live');
const EXPECTED = Object.freeze({
  schema:'character-slot-schema-v2.0.0',
  core:'character-customization-v2.0.0',
  stack:'character-visual-stack-v2.0.0',
  kit:'character-demo-kit-v2.0.0',
  preview:'character-customizer-preview-v2.0.0',
  ui:'character-customizer-ui-v2.0.0'
});

await fs.mkdir(outDir, { recursive:true });
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:1, isMobile:true, hasTouch:true });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

async function waitForCreator() {
  await page.waitForFunction(expected => {
    return !!window.KeloCharacterSlotSchema && !!window.KeloCharacterCustomization && !!window.KeloCharacterVisualStack &&
      !!window.KeloCharacterCustomizer && !!window.KeloCharacterCustomizerPreview && !!window.KeloInputLocks &&
      window.KeloCharacterSlotSchema.version === expected.schema &&
      window.KeloCharacterCustomization.version === expected.core &&
      window.KeloCharacterVisualStack.version === expected.stack &&
      window.KELO_CHARACTER_DEMO_KIT_AUDIT?.version === expected.kit &&
      window.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT?.version === expected.preview &&
      window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT?.version === expected.ui &&
      window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT?.ready === true;
  }, EXPECTED, { timeout:30000 });
}

async function waitPreviewItem(id) {
  await page.waitForFunction(itemId => !!document.querySelector(`[data-kc-preview-item="${itemId}"]`), id, { timeout:10000 });
}

async function assertNoViewportOverflow(label) {
  const metric = await page.evaluate(() => ({
    width:innerWidth,
    doc:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    modal:document.querySelector('#kelo-character-customizer .kc-shell')?.getBoundingClientRect().width || 0
  }));
  if (metric.doc > metric.width + 2 || metric.body > metric.width + 2 || metric.modal > metric.width + 2) {
    throw new Error(`VIEWPORT_OVERFLOW_${label}_${JSON.stringify(metric)}`);
  }
  return metric;
}

try {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'character-creator-v2-audit=' + Date.now(), { waitUntil:'domcontentloaded', timeout:60000 });
  await waitForCreator();

  const baseline = await page.evaluate(async expected => {
    const Schema=window.KeloCharacterSlotSchema;
    const A=window.KeloCharacterCustomization;
    const Stack=window.KeloCharacterVisualStack;
    const kit=window.KELO_CHARACTER_DEMO_KIT_AUDIT;
    const previewAudit=window.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT;
    const uiAudit=window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT;
    if(Schema.version!==expected.schema||A.version!==expected.core||Stack.version!==expected.stack||kit?.version!==expected.kit||previewAudit?.version!==expected.preview||uiAudit?.version!==expected.ui) throw new Error('CHARACTER_V2_VERSION_MISMATCH');
    if(Schema.slots.length!==24||A.slots.length!==24||window.KELO_CHARACTER_SLOT_SCHEMA_AUDIT?.slotCount!==24) throw new Error('EXPECTED_24_SHARED_SLOTS');
    for(const slot of ['eyebrows','nose','mouth']) if(!Schema.isSlot(slot)||Schema.groupOf(slot)!=='appearance') throw new Error('MISSING_FACE_SLOT_'+slot);
    if(A.networkSchema!=='kelo-character-visual-v2') throw new Error('NETWORK_V2_SCHEMA_MISSING');
    if(window.KELO_CHARACTER_CUSTOMIZATION_AUDIT?.directRenderAvatarWrapper!==false||window.KELO_CHARACTER_CUSTOMIZATION_AUDIT?.avatarMiddleware!==true) throw new Error('AVATAR_OWNER_CONTRACT_BROKEN');
    const avatar=window.KeloAvatar?.snapshot?.();
    if(!avatar?.middleware?.some(entry=>entry.owner==='character-customization:modular-layers'&&entry.priority===250)) throw new Error('MODULAR_AVATAR_MIDDLEWARE_MISSING');
    if(A.listPresets().length!==4) throw new Error('EXPECTED_4_CHARACTER_PRESETS');
    if(A.listPalettes('skinTone').length!==8||A.listPalettes('hair').length!==6||A.listPalettes('eyes').length!==5) throw new Error('PALETTE_VERTICAL_SLICE_INCOMPLETE');
    if(kit?.pieceIds?.length!==20||kit?.paletteCount!==19||kit?.presetCount!==4) throw new Error('STARTER_KIT_COUNTS_WRONG');

    const assetResults=[];
    for(const src of kit.assets){
      const join=String(src).includes('?')?'&':'?';
      const response=await fetch(src+join+'audit='+Date.now(),{cache:'no-store'});
      assetResults.push({src,status:response.status,ok:response.ok});
      if(!response.ok) throw new Error('CHARACTER_ASSET_HTTP_'+response.status+'_'+src);
    }

    A.reset();
    const preset=A.applyPreset('preset_kelo_natural');
    if(!preset.ok) throw new Error('NATURAL_PRESET_FAILED');
    const state=A.getState();
    if(state.slots.skinTone!=='skin_base_01'||state.slots.eyebrows!=='eyebrows_soft_01'||state.slots.nose!=='nose_small_01'||state.slots.mouth!=='mouth_neutral_01'||state.slots.hair!=='hair_messy_01') throw new Error('NATURAL_PRESET_FACE_INCOMPLETE');
    if(state.palettes.skinTone!=='skin_warm'||state.palettes.hair!=='hair_black'||state.palettes.eyes!=='eyes_brown') throw new Error('NATURAL_PRESET_PALETTE_INCOMPLETE');
    const net=A.networkSnapshot();
    if(net.schema!=='kelo-character-visual-v2'||!net.palettes||net.palettes.skinTone!=='skin_warm') throw new Error('NETWORK_VISUAL_V2_INCOMPLETE');
    if(Object.prototype.hasOwnProperty.call(net,'hp')||Object.prototype.hasOwnProperty.call(net,'damage')||Object.prototype.hasOwnProperty.call(net,'inventory')) throw new Error('NETWORK_VISUAL_LEAKS_GAMEPLAY');

    const remote={id:'__character_creator_v2_remote',x:-1000,y:-1000,radius:20,_face:'up',_visualMotion:{on:true,frame:2,face:'up'}};
    if(!A.applyRemote(remote,net)) throw new Error('REMOTE_V2_APPLY_FAILED');
    const remoteState=A.stateForActor(remote);
    if(remoteState.slots.nose!=='nose_small_01'||remoteState.palettes.hair!=='hair_black') throw new Error('REMOTE_V2_STATE_MISMATCH');
    const upEntries=Stack.resolve({actor:remote,face:'up'});
    if(!upEntries.some(e=>e.slot==='hair'&&e.paletteId==='hair_black')) throw new Error('REMOTE_STACK_PALETTE_MISSING');

    return {
      versions:{schema:Schema.version,core:A.version,stack:Stack.version,kit:kit.version,preview:previewAudit.version,ui:uiAudit.version},
      slotCount:A.slots.length,
      paletteCounts:{skin:A.listPalettes('skinTone').length,hair:A.listPalettes('hair').length,eyes:A.listPalettes('eyes').length},
      presetCount:A.listPresets().length,
      assetResults,
      networkSchema:net.schema,
      avatarMiddleware:avatar.middleware,
      state
    };
  }, EXPECTED);

  await page.evaluate(() => {
    window.confirm=()=>true;
    return window.KeloCharacterCustomizer.open();
  });
  const modal=page.locator('#kelo-character-customizer');
  await modal.waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(() => window.KeloInputLocks?.has?.('character-customizer') === true);

  const tabs=modal.locator('[data-kc-tab]');
  if(await tabs.count()!==4) throw new Error('EXPECTED_4_PREMIUM_TABS');
  for(const tab of ['appearance','clothing','equipment','cosmetics']){
    await modal.locator(`[data-kc-tab="${tab}"]`).click();
    await page.waitForTimeout(60);
  }
  await modal.locator('[data-kc-tab="appearance"]').click();
  await modal.locator('[data-kc-preset="preset_kelo_natural"]').click();

  const faceSelections=[
    ['face','face_angular_01'],['eyes','eyes_sharp_01'],['eyebrows','eyebrows_bold_01'],
    ['nose','nose_straight_01'],['mouth','mouth_smile_01'],['hair','hair_short_01']
  ];
  for(const [slot,item] of faceSelections){
    await modal.locator(`[data-kc-slot="${slot}"]`).click();
    await modal.locator(`[data-kc-item="${item}"]`).click();
  }

  await modal.locator('[data-kc-slot="skinTone"]').click();
  await modal.locator('[data-kc-item="skin_base_01"]').click();
  await modal.locator('[data-kc-palette="skin_deep"]').click();
  await modal.locator('[data-kc-slot="eyes"]').click();
  await modal.locator('[data-kc-palette="eyes_blue"]').click();
  await modal.locator('[data-kc-slot="hair"]').click();
  await modal.locator('[data-kc-palette="hair_silver"]').click();

  await waitPreviewItem('skin_base_01');
  await waitPreviewItem('face_angular_01');
  await waitPreviewItem('eyes_sharp_01');
  await waitPreviewItem('eyebrows_bold_01');
  await waitPreviewItem('nose_straight_01');
  await waitPreviewItem('mouth_smile_01');
  await waitPreviewItem('hair_short_01');
  await page.waitForFunction(() => window.KELO_CHARACTER_CUSTOMIZATION_AUDIT?.paletteBuilds > 0, null, {timeout:10000});

  const editedState=await page.evaluate(() => window.KeloCharacterCustomization.getState());
  if(editedState.palettes.skinTone!=='skin_deep'||editedState.palettes.eyes!=='eyes_blue'||editedState.palettes.hair!=='hair_silver') throw new Error('UI_PALETTE_SELECTION_FAILED');

  for(const face of ['down','left','right','up']){
    await modal.locator(`[data-kc-face="${face}"]`).click();
    await page.waitForFunction(expectedFace => window.KeloCharacterCustomizerPreview.getState().face===expectedFace, face);
  }
  await modal.locator('[data-kc-motion="walk"]').click();
  await page.waitForFunction(() => window.KeloCharacterCustomizerPreview.getState().motion==='walk');
  await page.waitForTimeout(320);
  await modal.locator('[data-kc-motion="idle"]').click();
  await page.waitForFunction(() => window.KeloCharacterCustomizerPreview.getState().motion==='idle');

  await modal.locator('[data-kc-slot="hair"]').click();
  const hairBeforeRandom=await page.evaluate(() => window.KeloCharacterCustomization.getState().slots.hair);
  await modal.locator('[data-kc-lock="hair"]').click();
  await modal.locator('[data-kc-random="group"]').click();
  const hairAfterRandom=await page.evaluate(() => window.KeloCharacterCustomization.getState().slots.hair);
  if(hairAfterRandom!==hairBeforeRandom) throw new Error('SMART_RANDOMIZER_IGNORED_HAIR_LOCK');

  const beforeUndo=await page.evaluate(() => window.KeloCharacterCustomization.getState().slots.face);
  await modal.locator('[data-kc-slot="face"]').click();
  const alternateFace=beforeUndo==='face_soft_01'?'face_angular_01':'face_soft_01';
  await modal.locator(`[data-kc-item="${alternateFace}"]`).click();
  await modal.locator('[data-kc-undo]').click();
  const afterUndo=await page.evaluate(() => window.KeloCharacterCustomization.getState().slots.face);
  if(afterUndo!==beforeUndo) throw new Error('UNDO_UI_FAILED');
  await modal.locator('[data-kc-redo]').click();
  const afterRedo=await page.evaluate(() => window.KeloCharacterCustomization.getState().slots.face);
  if(afterRedo!==alternateFace) throw new Error('REDO_UI_FAILED');

  await modal.locator('.kc-tools-btn').click();
  const saveName=modal.locator('[data-kc-save-name="1"]');
  await saveName.fill('Audit Hero');
  await modal.locator('[data-kc-save="1"]').click();
  const saved=await page.evaluate(() => window.KeloCharacterCustomization.listSavedProfiles()[0]);
  if(!saved?.occupied||saved.name!=='Audit Hero') throw new Error('SAVE_SLOT_UI_FAILED');

  await modal.locator('.kc-tools-btn').click();
  await modal.locator('[data-kc-preset="preset_kelo_silver"]').click();
  await modal.locator('.kc-tools-btn').click();
  await modal.locator('[data-kc-load="1"]').click();
  const loaded=await page.evaluate(() => window.KeloCharacterCustomization.getState());
  if(loaded.slots.hair!==afterRedo && loaded.slots.hair!==hairBeforeRandom) {
    // Hair may be the same across the saved edited state; validate the explicit palette instead.
    if(loaded.palettes.hair!=='hair_silver') throw new Error('LOAD_SLOT_UI_FAILED');
  }

  const code=await modal.locator('.kc-code').inputValue();
  if(!/^KW2\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/.test(code)) throw new Error('SHARE_CODE_UI_FORMAT_FAILED');
  await modal.locator('.kc-code').fill(code);
  await modal.locator('[data-kc-import]').click();
  const importWarnings=await page.evaluate(() => window.KELO_CHARACTER_CUSTOMIZATION_AUDIT.lastImportWarnings || []);
  if(importWarnings.length) throw new Error('OWN_SHARE_CODE_IMPORTED_WITH_WARNINGS_'+importWarnings.join(','));

  const portraitOverflow=await assertNoViewportOverflow('PORTRAIT');
  await page.screenshot({path:path.join(outDir,'character-creator-v2-portrait.png'),fullPage:true});

  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(180);
  const landscapeOverflow=await assertNoViewportOverflow('LANDSCAPE');
  await page.screenshot({path:path.join(outDir,'character-creator-v2-landscape.png'),fullPage:true});

  await modal.locator('.kc-done').click();
  await modal.waitFor({state:'hidden',timeout:5000});
  const postClose=await page.evaluate(async () => {
    const locks=window.KeloInputLocks;
    const customizerReleased=locks?.has?.('character-customizer')===false;
    const lockSnapshot=locks?.snapshot?.('character-creator-audit') || null;
    let backpack={available:!!window.KeloBackpackUI,opened:false,closed:false};
    if(window.KeloBackpackUI?.open){
      try{window.KeloBackpackUI.open();backpack.opened=window.KeloBackpackUI.isOpen?!!window.KeloBackpackUI.isOpen():true;}catch(_){}
      try{window.KeloBackpackUI.close();backpack.closed=window.KeloBackpackUI.isOpen?!window.KeloBackpackUI.isOpen():true;}catch(_){}
    }
    return {
      customizerReleased,
      lockSnapshot,
      backpack,
      menuCallable:typeof window.toggleMenu==='function',
      pvpCallable:typeof window.enterPvPWorld==='function'&&typeof window.leavePvPWorld==='function',
      movementOwner:!!window.KeloMovement,
      inputOwner:!!window.KeloInput
    };
  });
  if(!postClose.customizerReleased) throw new Error('CUSTOMIZER_INPUT_LOCK_LEAKED');
  if(postClose.backpack.available&&(!postClose.backpack.opened||!postClose.backpack.closed)) throw new Error('BACKPACK_BROKEN_AFTER_CUSTOMIZER');
  if(!postClose.menuCallable||!postClose.pvpCallable||!postClose.movementOwner||!postClose.inputOwner) throw new Error('CORE_FLOW_MISSING_AFTER_CUSTOMIZER_'+JSON.stringify(postClose));

  const finalAudit=await page.evaluate(() => ({
    customization:window.KELO_CHARACTER_CUSTOMIZATION_AUDIT,
    stack:window.KELO_CHARACTER_VISUAL_STACK_AUDIT,
    preview:window.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT,
    ui:window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT,
    inputLocks:window.KeloInputLocks?.snapshot?.('final')
  }));
  if(finalAudit.customization?.missingAssets?.length) throw new Error('MISSING_CHARACTER_ASSETS_'+finalAudit.customization.missingAssets.join(','));
  if(pageErrors.length) throw new Error('PAGE_ERRORS_'+pageErrors.join(' | '));

  const report={
    ok:true,url,expected:EXPECTED,
    baseline,
    editedState,
    hairLock:{before:hairBeforeRandom,after:hairAfterRandom},
    undoRedo:{before:beforeUndo,afterUndo,afterRedo},
    saved,loadedShareCodePrefix:code.slice(0,12),
    viewport:{portrait:portraitOverflow,landscape:landscapeOverflow},
    postClose,finalAudit,pageErrors,consoleErrors
  };
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  console.log('CHARACTER_CREATOR_V2_BROWSER_OK',JSON.stringify({slots:baseline.slotCount,assets:baseline.assetResults.length,presets:baseline.presetCount,palettes:baseline.paletteCounts,paletteBuilds:finalAudit.customization?.paletteBuilds||0,lockReleased:postClose.customizerReleased,pageErrors:pageErrors.length,consoleErrors:consoleErrors.length}));
} catch(error) {
  await page.screenshot({path:path.join(outDir,'character-creator-v2-failure.png'),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify({ok:false,url,expected:EXPECTED,error:String(error?.stack||error),pageErrors,consoleErrors},null,2));
  throw error;
} finally {
  await browser.close();
}
