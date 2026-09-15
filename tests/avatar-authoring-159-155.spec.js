/* KELO-INDEX
 * area: QA / AVATAR AUTHORING 159+155
 * owner: browser acceptance for Frame Surgery + persistent 4x4 builder convergence
 * keys: AVATAR FRAME-SURGERY 4X4 INDEXEDDB PINCH POINTER-CANCEL LIFECYCLE AUTHORED-ATLAS WEBKIT CHROMIUM
 */
const {test,expect}=require('@playwright/test');
const QA=process.env.AVATAR_AUTHORING_QA_URL||'http://127.0.0.1:4173/tests/fixtures/avatar-authoring-159-155.html';
async function ready(page){await page.goto(QA);await page.waitForFunction(()=>window.__AVATAR_AUTHORING_QA__?.ready);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.reset());}
async function afterReload(page){await page.reload();await page.waitForFunction(()=>window.__AVATAR_AUTHORING_QA__?.ready);}
async function pointer(page,selector,type,id,rx,ry,{primary=id===1}={}){await page.evaluate(({selector,type,id,rx,ry,primary})=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,buttons:type==='pointerup'||type==='pointercancel'?0:1,clientX:r.left+r.width*rx,clientY:r.top+r.height*ry}));},{selector,type,id,rx,ry,primary});}
async function pinch(page,selector){await pointer(page,selector,'pointerdown',1,.38,.55);await pointer(page,selector,'pointerdown',2,.62,.55,{primary:false});await pointer(page,selector,'pointermove',1,.30,.55);await pointer(page,selector,'pointermove',2,.70,.55,{primary:false});await pointer(page,selector,'pointerup',1,.30,.55);await pointer(page,selector,'pointerup',2,.70,.55,{primary:false});}

test('real Avatar workspace keeps PR 159 primary, opens one PR 155 builder and tears nested editor down with parent',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.seed([0]));
  const info=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.openUnified());
  expect(info.surgery).toBe(true);expect(info.builderEntry).toBe(true);expect(info.version).toContain('frame-builder-v1');
  await expect(page.locator('#kelo-avatar-quick')).toBeVisible();
  const entry=page.locator('[data-kelo-frame-builder]');await expect(entry).toBeVisible();await expect(entry).toHaveText('CONSTRUIR 4×4 · FRAME A FRAME');
  await page.evaluate(()=>{const button=document.querySelector('[data-kelo-frame-builder]');button.click();button.click();});
  await expect(page.locator('.kfb')).toHaveCount(1);await expect(page.locator('.kfb-progress')).toContainText('FRAME 128×192');
  await page.locator('.kfb-slot').nth(0).click();await expect(page.locator('.kfe')).toBeVisible();
  await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.closeUnified());
  await expect(page.locator('.kfe')).toHaveCount(0);await expect(page.locator('.kfb')).toHaveCount(0);await expect(page.locator('#kelo-avatar-quick')).toHaveCount(0);
});

test('persistent 4x4 project survives reload, keeps isolated slots and exact Kelo frame contract',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.seed([0,1,2,3]));
  const seeded=await page.evaluate(async()=>{const p=await window.__AVATAR_AUTHORING_QA__.project();return p.slots.map(s=>s.sourceKey);});
  await afterReload(page);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.open());
  await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');
  await expect(page.locator('.kfb-progress')).toContainText('FRAME 128×192');
  await expect(page.locator('.kfb-progress')).toContainText('ATLAS 512×768');
  await expect(page.locator('.kfb-slot')).toHaveCount(16);
  const before=await page.evaluate(async()=>{const p=await window.__AVATAR_AUTHORING_QA__.project();return {keys:p.slots.map(s=>s.sourceKey),frameCanvas:p.frameCanvas};});
  expect(before.keys.slice(0,4)).toEqual(seeded.slice(0,4));
  expect(before.frameCanvas.width).toBe(128);expect(before.frameCanvas.height).toBe(192);
  await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.close());await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.seed([2]));
  const after=await page.evaluate(async()=>{const p=await window.__AVATAR_AUTHORING_QA__.project();return p.slots.map(s=>s.sourceKey);});
  expect(after[0]).toBe(before.keys[0]);expect(after[1]).toBe(before.keys[1]);expect(after[2]).not.toBe(before.keys[2]);expect(after[3]).toBe(before.keys[3]);
  const atlas=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.atlas());
  expect(atlas.width).toBe(512);expect(atlas.height).toBe(768);expect(atlas.frameWidth).toBe(128);expect(atlas.frameHeight).toBe(192);
});

test('mobile editor rolls back pointercancel then accepts native two-pointer pinch in runtime coordinates',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.seed([0,1,2,3,12,13,14,15],{largeRow:true}));await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.open());
  await page.locator('.kfb-slot').nth(1).click();await expect(page.locator('.kfe')).toBeVisible();
  const canvasSize=await page.locator('.kfe-canvas').evaluate(c=>({width:c.width,height:c.height}));expect(canvasSize).toEqual({width:128,height:192});
  const before=await page.evaluate(async()=>{const p=await window.__AVATAR_AUTHORING_QA__.project();return p.slots[1].patch;});
  await pointer(page,'.kfe-canvas','pointerdown',9,.45,.50);await pointer(page,'.kfe-canvas','pointermove',9,.72,.68);await pointer(page,'.kfe-canvas','pointercancel',9,.72,.68);await page.waitForTimeout(60);
  await page.getByRole('button',{name:'GUARDAR',exact:true}).click();
  let project=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.project());expect(project.slots[1].patch.x).toBe(before.x);expect(project.slots[1].patch.y).toBe(before.y);expect(project.slots[1].patch.scale).toBe(before.scale);
  await page.locator('.kfb-slot').nth(1).click();await expect(page.locator('.kfe')).toBeVisible();await pinch(page,'.kfe-canvas');await page.waitForTimeout(80);await page.getByRole('button',{name:'GUARDAR',exact:true}).click();
  project=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.project());expect(project.slots[1].patch.scale).toBeGreaterThan(before.scale*1.3);
  await page.locator('.kfb-slot').nth(0).click();await page.getByRole('button',{name:/GHOST/}).click();await expect(page.getByRole('button',{name:/GHOST/})).toHaveClass(/on/);await page.locator('.kfe-close').click();
  await page.getByRole('button',{name:'PREVIEW ATLAS',exact:true}).click();
  const atlas=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.atlas());expect(atlas.width).toBe(512);expect(atlas.height).toBe(768);
});

test('precomposed 4x4 PNG survives the real compiler byte-for-byte after browser decoding',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.seed(Array.from({length:16},(_,i)=>i)));
  const result=await page.evaluate(()=>window.__AVATAR_AUTHORING_QA__.authoredRoundTrip());
  expect(result.width).toBe(512);expect(result.height).toBe(768);expect(result.frameWidth).toBe(128);expect(result.frameHeight).toBe(192);
  expect(result.preserved).toBe(true);expect(result.auditPreserved).toBe(true);expect(result.compilerMismatches).toBe(0);expect(result.sameCompilerPixels).toBe(true);
});
