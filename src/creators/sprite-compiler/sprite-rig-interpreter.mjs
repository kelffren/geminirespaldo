/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / RIG INTERPRETATION
 * owner: deterministic animation/direction semantic hypotheses
 * keys: SPRITE RIG 1D 4D 8D DIRECTION SEMANTIC FRAME COUNT AMBIGUITY
 * purpose: map an interpreted physical layout to a lossless 1, 4 or 8 direction runtime rig
 * public-api: interpretSpriteRig, canonicalDirectionOrder
 * consumes: ranked sprite-layout-interpreter hypothesis + optional explicit hints
 * state-owned: none; pure layout -> semantic candidates
 * extension-points: explicit source direction conventions and future animation labels
 * online: N/A
 * do-not: detect foreground, mutate pixels, invent low-confidence semantics or discard source frames
 */

const F = Object.freeze;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export const canonicalDirectionOrder = F({
  1: F(['s']),
  4: F(['s', 'w', 'e', 'n']),
  8: F(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])
});

const SOUTH_CLOCKWISE = F(['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']);
const LONG_TO_SHORT = F({down: 's', left: 'w', right: 'e', up: 'n', south: 's', west: 'w', east: 'e', north: 'n'});

function directionName(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return LONG_TO_SHORT[key] || (['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].includes(key) ? key : null);
}

function sourceFrames(layout) {
  return layout.groups.map(group => group.filter(frame => !frame.empty));
}

function canonicalizeGroups(groups, directions, sourceOrder) {
  const byDirection = new Map();
  sourceOrder.forEach((direction, index) => byDirection.set(direction, groups[index] || []));
  return directions.map((direction, row) => F((byDirection.get(direction) || []).map((frame, column) => F({...frame, row, column, direction}))));
}

function rowMapFor(directions) {
  const rowMap = {};
  directions.forEach((direction, row) => { rowMap[direction] = row; });
  if ('s' in rowMap) rowMap.down = rowMap.s;
  if ('n' in rowMap) rowMap.up = rowMap.n;
  if ('w' in rowMap) rowMap.left = rowMap.w;
  if ('e' in rowMap) rowMap.right = rowMap.e;
  return F(rowMap);
}

function makeCandidate(profile, groups, directions, sourceOrder, score, why, metadata = {}) {
  const canonicalGroups = canonicalizeGroups(groups, directions, sourceOrder);
  return F({
    profile,
    directions: directions.length,
    directionKeys: F([...directions]),
    sourceDirectionOrder: F([...sourceOrder]),
    groups: F(canonicalGroups),
    frameCounts: F(canonicalGroups.map(group => group.length)),
    columns: Math.max(1, ...canonicalGroups.map(group => group.length)),
    rows: directions.length,
    rowMap: rowMapFor(directions),
    score: clamp(score),
    why,
    ...metadata
  });
}

function explicitOrder(hint, count) {
  const raw = Array.isArray(hint) ? hint.map(directionName) : [];
  return raw.length === count && raw.every(Boolean) && new Set(raw).size === count ? raw : null;
}

function rowOrderFromMap(rowMapHint, rowCount) {
  if (rowCount !== 4 || !rowMapHint) return null;
  const entries = [['s', rowMapHint.s ?? rowMapHint.down], ['w', rowMapHint.w ?? rowMapHint.left], ['e', rowMapHint.e ?? rowMapHint.right], ['n', rowMapHint.n ?? rowMapHint.up]];
  if (!entries.every(([, row]) => Number.isInteger(Number(row)) && Number(row) >= 0 && Number(row) < rowCount)) return null;
  const order = new Array(rowCount);
  for (const [direction, row] of entries) order[Number(row)] = direction;
  return order.every(Boolean) && new Set(order).size === rowCount ? order : null;
}

export function interpretSpriteRig(layout, {
  fileName = '',
  rowMapHint = null,
  sourceDirectionOrder = null,
  rigHint = null
} = {}) {
  if (!layout?.groups?.length) throw new Error('SPRITE_RIG_LAYOUT_REQUIRED');
  const groups = sourceFrames(layout);
  const totalFrames = groups.flat().length;
  const rowCount = groups.length;
  const counts = groups.map(group => group.length);
  const name = String(fileName || '').toLowerCase();
  const explicitRig = Number(rigHint);
  const explicit8 = explicitRig === 8 || /(?:^|[-_ ])8(?:dir|d|way|direction)/.test(name);
  const explicit4 = explicitRig === 4 || /(?:^|[-_ ])4(?:dir|d|way|direction)/.test(name);
  const candidates = [];

  if (explicitRig === 1) {
    candidates.push(makeCandidate('sprite-rig-1d', [groups.flat()], canonicalDirectionOrder[1], ['s'], .995, 'explicit single-direction hint preserves the physical reading order'));
  }

  if (rowCount === 1) {
    candidates.push(makeCandidate('sprite-rig-1d', groups, canonicalDirectionOrder[1], ['s'], explicitRig === 1 ? .99 : .88, 'one physical row is a single-direction animation'));
    if (totalFrames === 8 && explicit8) {
      const order = explicitOrder(sourceDirectionOrder, 8) || SOUTH_CLOCKWISE;
      candidates.push(makeCandidate('sprite-rig-8d-static', groups[0].map(frame => [frame]), canonicalDirectionOrder[8], order, .98, 'explicit 8-direction hint maps eight static views'));
    }
  }

  if (rowCount === 4) {
    const order = explicitOrder(sourceDirectionOrder, 4) || rowOrderFromMap(rowMapHint, 4) || ['s', 'w', 'e', 'n'];
    candidates.push(makeCandidate('sprite-rig-4d', groups, canonicalDirectionOrder[4], order, explicit4 ? .99 : .94, 'four spatial rows map to the four-direction Kelo rig'));
    if (totalFrames === 8 && counts.every(count => count === 2)) {
      const flat = groups.flat().map(frame => [frame]);
      candidates.push(makeCandidate('sprite-rig-8d-static', flat, canonicalDirectionOrder[8], explicitOrder(sourceDirectionOrder, 8) || SOUTH_CLOCKWISE, explicit8 ? .99 : .70, 'eight frames can alternatively represent eight static directions'));
    }
  }

  if (rowCount === 8) {
    const order = explicitOrder(sourceDirectionOrder, 8) || canonicalDirectionOrder[8];
    candidates.push(makeCandidate('sprite-rig-8d', groups, canonicalDirectionOrder[8], order, explicit8 ? .99 : .94, 'eight spatial rows preserve the complete eight-direction rig'));
  }

  const contactSheet8 = totalFrames === 8 && rowCount === 2 && counts.every(count => count === 4);
  if (contactSheet8) {
    const order = explicitOrder(sourceDirectionOrder, 8) || SOUTH_CLOCKWISE;
    const flat = groups.flat().map(frame => [frame]);
    candidates.push(makeCandidate('sprite-rig-8d-static', flat, canonicalDirectionOrder[8], order, explicit8 ? .99 : .86, 'a 4×2 contact sheet with eight unique views maps losslessly to 8D'));
    candidates.push(makeCandidate('sprite-rig-unresolved-2d', groups, ['s', 'n'], ['s', 'n'], explicit8 ? .38 : .59, 'alternative interpretation: two directions with four animation frames', {reviewOnly: true}));
  }

  if (!candidates.length) {
    const directions = groups.map((_, index) => `row${index + 1}`);
    candidates.push(makeCandidate('sprite-rig-unresolved', groups, directions, directions, .46, 'the physical rows do not prove a supported 1D, 4D or 8D semantic rig', {reviewOnly: true}));
  }

  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const ranked = candidates.filter(candidate => {
    const key = `${candidate.profile}:${candidate.directionKeys.join(',')}:${candidate.frameCounts.join(',')}:${candidate.sourceDirectionOrder.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const best = ranked[0];
  const runner = ranked[1] || null;
  const margin = best.score - (runner?.score || 0);
  const reasons = [];
  if (best.reviewOnly || ![1, 4, 8].includes(best.directions)) reasons.push('UNRESOLVED_DIRECTION_RIG');
  if (best.score < .78) reasons.push('LOW_SEMANTIC_CONFIDENCE');
  if (!explicitRig && runner && margin < .12) reasons.push('AMBIGUOUS_SEMANTICS');
  return F({
    version: 'sprite-rig-interpreter-v1.0.0',
    best,
    candidates: F(ranked),
    confidence: best.score,
    margin,
    reviewRequired: reasons.length > 0,
    reviewReasons: F(reasons)
  });
}

export const __spriteRigInternals = F({directionName, rowMapFor, rowOrderFromMap, SOUTH_CLOCKWISE});
