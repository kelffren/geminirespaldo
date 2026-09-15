import { normalizeSpriteAbilityDocument, spriteAbilityTiming, eventsAtFrame, validateSpriteAbilityDocument, buildGeneratedDrafts, frameRect, addAnimationEvent } from '../src/creators/sprite-ability/sprite-ability-document.mjs';

const d = normalizeSpriteAbilityDocument({
  sheet: { columns: 4, rows: 2, frameWidth: 64, frameHeight: 64, startFrame: 0, endFrame: 7, fps: 16, loop: false },
  combat: { impactFrame: 5, activeStartFrame: 4, activeEndFrame: 6, damage: 22, range: 140 }
});
if (d.events.filter(e => e.type === 'IMPACT').length !== 1) throw new Error('IMPACT_EVENT_MISSING');
if (d.events.find(e => e.type === 'IMPACT').frame !== 5) throw new Error('IMPACT_FRAME_MISMATCH');
const moved = normalizeSpriteAbilityDocument({ ...d, combat: { ...d.combat, impactFrame: 3 } });
if (moved.events.find(e => e.type === 'IMPACT').frame !== 3) throw new Error('IMPACT_DID_NOT_FOLLOW_FRAME');
if (eventsAtFrame(moved, 3).some(e => e.type !== 'IMPACT')) throw new Error('EVENT_LOOKUP_WRONG');
const t = spriteAbilityTiming(moved);
if (!(t.impactMs > 0) || t.animationMs !== 8 * (1000 / 16)) throw new Error('TIMING_WRONG');
const built = buildGeneratedDrafts(moved);
if (!built.animation.tracks.event.some(e => e.payload?.type === 'IMPACT')) throw new Error('EXPORT_MISSING_IMPACT_EVENT');
const spaced = normalizeSpriteAbilityDocument({ sheet: { columns: 2, rows: 2, frameWidth: 32, frameHeight: 32, spacingX: 4, spacingY: 6 } });
const r1 = frameRect(spaced, 1);
if (r1.sx !== 36 || r1.sy !== 0) throw new Error('SPACING_X_WRONG');
const r2 = frameRect(spaced, 2);
if (r2.sx !== 0 || r2.sy !== 38) throw new Error('SPACING_Y_WRONG');
const withSpawn = addAnimationEvent(moved, 'PROJECTILE_SPAWN', 1);
if (!withSpawn.events.some(e => e.type === 'PROJECTILE_SPAWN' && e.frame === 1)) throw new Error('EXTRA_EVENT_MISSING');
if (withSpawn.events.filter(e => e.type === 'IMPACT').length !== 1) throw new Error('IMPACT_LOST_AFTER_EXTRA_EVENT');
const looped = normalizeSpriteAbilityDocument({ sheet: { loop: true } });
if (looped.sheet.loop !== true) throw new Error('LOOP_NOT_PRESERVED');
const tight = validateSpriteAbilityDocument({
  sheet: { dataUrl: 'data:image/png;base64,AA==', imageWidth: 68, imageHeight: 32, columns: 2, rows: 1, frameWidth: 32, frameHeight: 32, spacingX: 4 }
});
if (!tight.ok) throw new Error('SPACING_GRID_SHOULD_FIT:' + tight.errors.join(','));
const overflow = validateSpriteAbilityDocument({
  sheet: { dataUrl: 'data:image/png;base64,AA==', imageWidth: 64, imageHeight: 32, columns: 2, rows: 1, frameWidth: 32, frameHeight: 32, spacingX: 4 }
});
if (overflow.ok || !overflow.errors.includes('GRID_W_EXCEEDS_IMAGE')) throw new Error('SPACING_OVERFLOW_NOT_DETECTED');
const bad = validateSpriteAbilityDocument({ sheet: { dataUrl: '' } });
if (bad.ok || !bad.errors.includes('SPRITESHEET_REQUIRED')) throw new Error('VALIDATION_SHOULD_FAIL');
console.log('SPRITE_ABILITY_EVENTS_AUDIT: PASS');
console.log(JSON.stringify({ impact: moved.combat.impactFrame, events: moved.events, impactMs: t.impactMs }, null, 2));
