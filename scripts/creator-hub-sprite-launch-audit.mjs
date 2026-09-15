import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(process.argv[2] || 'src/creators/ui/creator-hub.mjs', 'utf8');

const directStart = source.indexOf("if(id==='sprite-ability'&&!projectId){");
assert.ok(directStart >= 0, 'Sprite Ability direct launch branch missing');

const directEnd = source.indexOf("\n      }\n\n      let resolvedProjectId", directStart);
assert.ok(directEnd > directStart, 'Sprite Ability direct launch branch boundary missing');

const direct = source.slice(directStart, directEnd);
const openAt = direct.indexOf("const session=await platform.openWorkspace(id,{})");
const mountAt = direct.indexOf("await requireSpriteAbilityMount(session)");
const destroyAt = direct.indexOf("destroy()");
assert.ok(openAt >= 0, 'Direct launch must await platform.openWorkspace');
assert.ok(mountAt > openAt, 'Mount confirmation must happen after workspace open resolves');
assert.ok(destroyAt > mountAt, 'Hub must only be destroyed after mount confirmation');

assert.ok(source.includes("if(opening.size)return;"), 'Cross-workspace re-entry guard missing');
assert.ok(source.includes("candidate?.isConnected&&titleText.includes('SPRITE ABILITY')"), 'Mounted Sprite Ability identity check missing');
assert.ok(source.includes("throw new Error('SPRITE_ABILITY_WORKSPACE_MOUNT_FAILED')"), 'Explicit mount failure missing');
assert.ok(source.includes("showLaunchError(id,error);"), 'Visible/recoverable launch failure path missing');
assert.ok(source.includes("if(hub.isConnected)setOpeningUi(id,false);"), 'Busy UI must reset while Hub survives');
assert.ok(source.includes("card.dataset.workspace=wid;"), 'Workspace cards must be addressable for busy state');
assert.ok(source.includes("version:'kelo-creator-hub-v1.19.0-world-bridge'"), 'Expected transactional launcher version missing');
assert.ok((source.match(/await nextPaint\(\);/g)||[]).length>=2, 'Sprite Ability launch must yield so busy UI can paint before import');
assert.ok(source.includes("pill.textContent='ABRIENDO'"), 'Busy World card must show ABRIENDO instead of looking frozen');
assert.ok(source.includes("platform.workspaces.resolve('world')?.paintLaunch"), 'World launch must paint Studio chrome before importing the Studio graph');
assert.ok(source.includes("const pending=platform.openWorkspace(id,resolvedProjectId?{projectId:resolvedProjectId}:{})"), 'World must hand the Hub off without awaiting the Studio graph');
assert.ok(!source.includes("if(id==='world')await requireWorldStudioMount(session);"), 'World must not keep the Hub busy waiting for Studio to finish booting');
assert.ok(source.includes("throw new Error('WORLD_EDITOR_MOUNT_FAILED')"), 'World mount failure must be explicit and recoverable');
assert.ok(source.includes("World Editor no abrió. Toca World de nuevo para reintentar."), 'World launch error must tell the player they can retry');
assert.ok(source.includes('function parkHub()'), 'World launch must detach the Hub so iPhone is not frozen under backdrop-filter');
assert.ok(/if\(id==='world'\)\{\s*parkHub\(\);/.test(source), 'World launch must park the Hub before importing Studio');
assert.ok(source.includes("hub.style.display='none'"), 'World launch must hide the Hub without synchronously tearing it out of a live canvas');
assert.ok(source.includes("card.addEventListener('pointerup'"), 'World card must start on pointerup so iPhone does not wait for a delayed click');
assert.ok(!source.includes('backdrop-filter:blur'), 'Creator Hub must not blur the live canvas; that freezes World open on iPhone');

console.log('CREATOR_HUB_SPRITE_LAUNCH_AUDIT: PASS');
