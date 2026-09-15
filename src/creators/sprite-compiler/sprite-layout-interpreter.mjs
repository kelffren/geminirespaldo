/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / LAYOUT INTERPRETATION
 * owner: deterministic frame-layout hypotheses and evidence ranking
 * keys: SPRITE LAYOUT HYPOTHESIS ADAPTIVE GRID COMPONENT CLUSTER STRIP FREE POSITION REVIEW
 * purpose: interpret foreground evidence as competing frame layouts without assigning animation meaning
 * public-api: interpretSpriteLayout, buildSpriteLayoutHypotheses, buildManualSpriteLayout, scoreSpriteLayout
 * consumes: sprite-foreground-analysis only
 * state-owned: none; pure foreground analysis -> ranked immutable hypotheses
 * extension-points: new deterministic hypothesis builders and scoring evidence
 * online: N/A
 * do-not: clean pixels, normalize art, infer directions, persist assets or hide ambiguity
 */
import {analyzeSpriteForeground,projectSpriteMask} from './sprite-foreground-analysis.mjs';

const F = Object.freeze;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};
const cv = values => {
  if (values.length < 2) return 0;
  const average = mean(values);
  if (!average) return 1;
  return Math.sqrt(mean(values.map(value => (value - average) ** 2))) / average;
};

function immutableRect(rect) {
  return F({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.max(1, Math.round(rect.w)),
    h: Math.max(1, Math.round(rect.h))
  });
}

function contentExtent(analysis) {
  const bounds = analysis.contentBounds;
  if (!bounds) return {x: 0, y: 0, w: analysis.width, h: analysis.height};
  const padX = Math.max(1, Math.round(bounds.w * .012));
  const padY = Math.max(1, Math.round(bounds.h * .012));
  const x = Math.max(0, bounds.x - padX);
  const y = Math.max(0, bounds.y - padY);
  const right = Math.min(analysis.width, bounds.x + bounds.w + padX);
  const bottom = Math.min(analysis.height, bounds.y + bounds.h + padY);
  return {x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y)};
}

function integralMask(mask, width, height) {
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  return {integral, stride};
}

function sumRect(integralState, width, height, rect) {
  const x0 = clamp(Math.floor(rect.x), 0, width);
  const y0 = clamp(Math.floor(rect.y), 0, height);
  const x1 = clamp(Math.ceil(rect.x + rect.w), x0, width);
  const y1 = clamp(Math.ceil(rect.y + rect.h), y0, height);
  const {integral, stride} = integralState;
  return integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
}

function scanFrame(mask, width, height, cell, row, column) {
  const x0 = clamp(Math.floor(cell.x), 0, width - 1);
  const y0 = clamp(Math.floor(cell.y), 0, height - 1);
  const x1 = clamp(Math.ceil(cell.x + cell.w), x0 + 1, width);
  const y1 = clamp(Math.ceil(cell.y + cell.h), y0 + 1, height);
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  let area = 0;
  let boundaryPixels = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!mask[y * width + x]) continue;
    area++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1) boundaryPixels++;
  }
  const empty = area === 0;
  const bounds = empty ? null : {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
  const padX = bounds ? Math.max(2, Math.round(bounds.w * .035)) : 0;
  const padY = bounds ? Math.max(2, Math.round(bounds.h * .025)) : 0;
  const sx = bounds ? Math.max(x0, bounds.x - padX) : x0;
  const sy = bounds ? Math.max(y0, bounds.y - padY) : y0;
  const sr = bounds ? Math.min(x1, bounds.x + bounds.w + padX) : x1;
  const sb = bounds ? Math.min(y1, bounds.y + bounds.h + padY) : y1;
  const sourceRect = {x: sx, y: sy, w: Math.max(1, sr - sx), h: Math.max(1, sb - sy)};
  const touchesCanvasEdge = !!bounds && (bounds.x <= 0 || bounds.y <= 0 || bounds.x + bounds.w >= width || bounds.y + bounds.h >= height);
  return {
    row,
    column,
    cell: immutableRect({x: x0, y: y0, w: x1 - x0, h: y1 - y0}),
    sourceRect: immutableRect(sourceRect),
    bounds: bounds ? immutableRect(bounds) : null,
    area,
    empty,
    boundaryPixels,
    boundaryRatio: area ? boundaryPixels / area : 1,
    touchesCanvasEdge,
    cx: bounds ? bounds.x + bounds.w / 2 : x0 + (x1 - x0) / 2,
    cy: bounds ? bounds.y + bounds.h / 2 : y0 + (y1 - y0) / 2,
    feetY: bounds ? bounds.y + bounds.h : y0
  };
}

function framesFromCuts(analysis, xCuts, yCuts) {
  const groups = [];
  for (let row = 0; row < yCuts.length - 1; row++) {
    const group = [];
    for (let column = 0; column < xCuts.length - 1; column++) {
      group.push(scanFrame(analysis.mask, analysis.width, analysis.height, {
        x: xCuts[column],
        y: yCuts[row],
        w: xCuts[column + 1] - xCuts[column],
        h: yCuts[row + 1] - yCuts[row]
      }, row, column));
    }
    groups.push(group);
  }
  return groups;
}

function equalCuts(start, length, count) {
  const cuts = [];
  for (let index = 0; index <= count; index++) cuts.push(Math.round(start + index * length / count));
  return cuts;
}

function smoothProjection(values, radius) {
  const out = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    let total = 0;
    let count = 0;
    for (let probe = Math.max(0, index - radius); probe <= Math.min(values.length - 1, index + radius); probe++) {
      total += values[probe];
      count++;
    }
    out[index] = total / Math.max(1, count);
  }
  return out;
}

function adaptiveCuts(projection, start, length, count) {
  if (count <= 1) return [start, start + length];
  const smooth = smoothProjection(projection, Math.max(1, Math.round(length / 360)));
  const nominal = length / count;
  const cuts = [start];
  for (let index = 1; index < count; index++) {
    const expected = start + index * nominal;
    const low = Math.max(cuts.at(-1) + Math.max(3, nominal * .28), expected - nominal * .38);
    const high = Math.min(start + length - (count - index) * Math.max(3, nominal * .28), expected + nominal * .38);
    let best = Math.round(expected);
    let bestScore = Infinity;
    for (let position = Math.ceil(low); position <= Math.floor(high); position++) {
      const density = smooth[clamp(position, 0, smooth.length - 1)];
      const distance = Math.abs(position - expected) / Math.max(1, nominal);
      const score = density + distance * .018;
      if (score < bestScore) {
        best = position;
        bestScore = score;
      }
    }
    cuts.push(Math.round(best));
  }
  cuts.push(start + length);
  return cuts;
}

function projectionRuns(projection, start, length, otherExtent) {
  const end = Math.min(projection.length, start + length);
  let peak = 0;
  for (let index = start; index < end; index++) peak = Math.max(peak, projection[index]);
  const threshold = Math.max(1 / Math.max(1, otherExtent), peak * .025);
  const active = [];
  for (let index = start; index < end; index++) active.push(projection[index] >= threshold ? 1 : 0);
  const maxHole = Math.max(1, Math.round(length * .004));
  let cursor = 0;
  while (cursor < active.length) {
    while (cursor < active.length && active[cursor]) cursor++;
    const holeStart = cursor;
    while (cursor < active.length && !active[cursor]) cursor++;
    if (holeStart > 0 && cursor < active.length && cursor - holeStart <= maxHole) {
      for (let index = holeStart; index < cursor; index++) active[index] = 1;
    }
  }
  const runs = [];
  cursor = 0;
  while (cursor < active.length) {
    while (cursor < active.length && !active[cursor]) cursor++;
    if (cursor >= active.length) break;
    const runStart = cursor;
    while (cursor < active.length && active[cursor]) cursor++;
    if (cursor - runStart >= 2) runs.push({start: start + runStart, end: start + cursor});
  }
  return runs;
}

function cutsAroundRuns(runs, start, end) {
  const cuts = [start];
  for (let index = 1; index < runs.length; index++) cuts.push(Math.round((runs[index - 1].end + runs[index].start) / 2));
  cuts.push(end);
  return cuts;
}

function clusterItems(items, axis, tolerance) {
  const groups = [];
  for (const item of [...items].sort((a, b) => a[axis] - b[axis])) {
    let selected = null;
    let distance = Infinity;
    for (const group of groups) {
      const nextDistance = Math.abs(item[axis] - group.center);
      if (nextDistance <= tolerance && nextDistance < distance) {
        selected = group;
        distance = nextDistance;
      }
    }
    if (!selected) {
      selected = {center: item[axis], items: []};
      groups.push(selected);
    }
    selected.items.push(item);
    selected.center = mean(selected.items.map(entry => entry[axis]));
  }
  return groups.sort((a, b) => a.center - b.center);
}

function majorComponents(analysis) {
  const components = analysis.components;
  if (!components.length) return [];
  const largest = components[0].area;
  const minimum = Math.max(8, largest * .09, analysis.foregroundPixels * .0016);
  let majors = components.filter(component => component.area >= minimum);
  if (majors.length > 64) majors = majors.slice(0, 64);
  return majors;
}

function localProjectionValley(mask, width, component, axis) {
  const length = axis === 'x' ? component.w : component.h;
  const other = axis === 'x' ? component.h : component.w;
  if (length < 12) return null;
  const density = new Float32Array(length);
  for (let position = 0; position < length; position++) {
    let active = 0;
    for (let cross = 0; cross < other; cross++) {
      const x = axis === 'x' ? component.x + position : component.x + cross;
      const y = axis === 'x' ? component.y + cross : component.y + position;
      active += mask[y * width + x];
    }
    density[position] = active / Math.max(1, other);
  }
  let peak = 0;
  for (const value of density) peak = Math.max(peak, value);
  let best = -1;
  let value = Infinity;
  for (let position = Math.round(length * .28); position <= Math.round(length * .72); position++) {
    if (density[position] < value) {
      value = density[position];
      best = position;
    }
  }
  return best > 0 && value <= peak * .36 ? {position: best, ratio: peak ? value / peak : 1} : null;
}

function splitMergedComponents(analysis, components) {
  if (components.length < 2) return components;
  const medianWidth = median(components.map(component => component.w));
  const medianHeight = median(components.map(component => component.h));
  const out = [];
  for (const component of components) {
    const wide = component.w > medianWidth * 1.62 && component.h < medianHeight * 1.48;
    const tall = component.h > medianHeight * 1.62 && component.w < medianWidth * 1.48;
    const axis = wide ? 'x' : tall ? 'y' : null;
    const valley = axis ? localProjectionValley(analysis.mask, analysis.width, component, axis) : null;
    if (!valley) {
      out.push(component);
      continue;
    }
    const cells = axis === 'x'
      ? [
          {x: component.x, y: component.y, w: valley.position, h: component.h},
          {x: component.x + valley.position, y: component.y, w: component.w - valley.position, h: component.h}
        ]
      : [
          {x: component.x, y: component.y, w: component.w, h: valley.position},
          {x: component.x, y: component.y + valley.position, w: component.w, h: component.h - valley.position}
        ];
    const split = cells.map((cell, index) => {
      const frame = scanFrame(analysis.mask, analysis.width, analysis.height, cell, 0, index);
      return frame.bounds ? {
        ...component,
        id: `${component.id}:${index}`,
        area: frame.area,
        x: frame.bounds.x,
        y: frame.bounds.y,
        w: frame.bounds.w,
        h: frame.bounds.h,
        right: frame.bounds.x + frame.bounds.w - 1,
        bottom: frame.bounds.y + frame.bounds.h - 1,
        cx: frame.cx,
        cy: frame.cy,
        density: frame.area / Math.max(1, frame.bounds.w * frame.bounds.h),
        splitEvidence: valley.ratio
      } : null;
    }).filter(Boolean);
    if (split.length === 2 && split.every(entry => entry.area >= component.area * .22)) out.push(...split);
    else out.push(component);
  }
  return out;
}

function componentFrames(analysis) {
  const majors = splitMergedComponents(analysis, majorComponents(analysis));
  if (!majors.length) return {groups: [], assignedArea: 0, seedCount: 0};
  const seedIds = new Set(majors.map(component => String(component.id)));
  const splitSourceIds = new Set(majors.filter(component => String(component.id).includes(':')).map(component => String(component.id).split(':')[0]));
  const medianWidth = median(majors.map(component => component.w));
  const medianHeight = median(majors.map(component => component.h));
  const assigned = new Map(majors.map(component => [String(component.id), [component]]));
  for (const component of analysis.components) {
    if (seedIds.has(String(component.id)) || splitSourceIds.has(String(component.id))) continue;
    let closest = null;
    let closestDistance = Infinity;
    for (const seed of majors) {
      const dx = Math.max(seed.x - component.right, component.x - seed.right, 0) / Math.max(1, medianWidth);
      const dy = Math.max(seed.y - component.bottom, component.y - seed.bottom, 0) / Math.max(1, medianHeight);
      const centerDistance = Math.hypot((component.cx - seed.cx) / Math.max(1, medianWidth), (component.cy - seed.cy) / Math.max(1, medianHeight));
      const distance = Math.hypot(dx, dy) + centerDistance * .16;
      if (distance < closestDistance) {
        closest = seed;
        closestDistance = distance;
      }
    }
    if (closest && closestDistance <= .62) assigned.get(String(closest.id)).push(component);
  }
  const combined = majors.map(seed => {
    const items = assigned.get(String(seed.id));
    const x = Math.min(...items.map(item => item.x));
    const y = Math.min(...items.map(item => item.y));
    const right = Math.max(...items.map(item => item.right));
    const bottom = Math.max(...items.map(item => item.bottom));
    const area = items.reduce((total, item) => total + item.area, 0);
    return {...seed, x, y, right, bottom, w: right - x + 1, h: bottom - y + 1, area, cx: x + (right - x + 1) / 2, cy: y + (bottom - y + 1) / 2};
  });
  const rowTolerance = Math.max(4, medianHeight * .46);
  const rows = clusterItems(combined, 'cy', rowTolerance);
  const rowBounds = rows.map(row => ({top: Math.min(...row.items.map(item => item.y)), bottom: Math.max(...row.items.map(item => item.bottom))}));
  const groups = rows.map((row, rowIndex) => {
    const items = row.items.sort((a, b) => a.cx - b.cx);
    const top = rowIndex
      ? Math.floor((rowBounds[rowIndex - 1].bottom + rowBounds[rowIndex].top + 1) / 2)
      : Math.max(0, rowBounds[rowIndex].top - Math.max(2, Math.round(medianHeight * .035)));
    const bottom = rowIndex + 1 < rows.length
      ? Math.ceil((rowBounds[rowIndex].bottom + rowBounds[rowIndex + 1].top + 1) / 2)
      : Math.min(analysis.height, rowBounds[rowIndex].bottom + 1 + Math.max(2, Math.round(medianHeight * .035)));
    return items.map((component, column) => {
    const left = column
      ? Math.floor((items[column - 1].right + component.x + 1) / 2)
      : Math.max(0, component.x - Math.max(2, Math.round(medianWidth * .05)));
    const right = column + 1 < items.length
      ? Math.ceil((component.right + items[column + 1].x + 1) / 2)
      : Math.min(analysis.width, component.right + 1 + Math.max(2, Math.round(medianWidth * .05)));
    const cell = {x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top)};
    const frame = scanFrame(analysis.mask, analysis.width, analysis.height, cell, rowIndex, column);
    return {...frame, componentIds: F(assigned.get(String(component.id))?.map(item => item.id) || [component.id]), splitEvidence: component.splitEvidence ?? null};
    });
  });
  return {groups, assignedArea: combined.reduce((sum, component) => sum + component.area, 0), seedCount: majors.length};
}

function boundaryDensity(analysis, cuts, axis) {
  if (cuts.length <= 2) return 1;
  const projection = projectSpriteMask(analysis.mask, analysis.width, analysis.height, axis);
  const values = cuts.slice(1, -1).map(cut => {
    const center = clamp(Math.round(cut), 0, projection.length - 1);
    let minimum = Infinity;
    for (let offset = -1; offset <= 1; offset++) minimum = Math.min(minimum, projection[clamp(center + offset, 0, projection.length - 1)]);
    return minimum;
  });
  const peak = Math.max(...projection, 1 / Math.max(analysis.width, analysis.height));
  return clamp(1 - mean(values) / peak * 2.8);
}

function frameLayoutEvidence(analysis, groups, {xCuts = null, yCuts = null, seedCount = 0, assignedArea = null} = {}) {
  const frames = groups.flat();
  const alive = frames.filter(frame => !frame.empty && frame.bounds);
  const frameCount = frames.length;
  const detectedFrames = alive.length;
  const coveragePixels = assignedArea ?? alive.reduce((sum, frame) => sum + frame.area, 0);
  const coverage = clamp(coveragePixels / Math.max(1, analysis.foregroundPixels));
  const nonEmpty = detectedFrames / Math.max(1, frameCount);
  const heights = alive.map(frame => frame.bounds.h);
  const widths = alive.map(frame => frame.bounds.w);
  const areas = alive.map(frame => frame.area);
  const sizeConsistency = alive.length ? clamp(1 - cv(areas.map(Math.sqrt)) * 1.18) : 0;
  const heightConsistency = alive.length ? clamp(1 - cv(heights) * 1.35) : 0;
  const widthConsistency = alive.length ? clamp(1 - cv(widths) * .78) : 0;
  const boundaryTouches = alive.length ? alive.filter(frame => frame.boundaryPixels > 0).length / alive.length : 1;
  const boundaryRisk = alive.length ? clamp(
    boundaryTouches * .62 + mean(alive.map(frame => clamp(frame.boundaryRatio * 12))) * .38
  ) : 1;
  const canvasClipping = alive.length ? alive.filter(frame => frame.touchesCanvasEdge).length / alive.length : 1;
  const clipping = clamp(boundaryRisk * .72 + canvasClipping * .28);
  const groupCounts = groups.filter(group => group.some(frame => !frame.empty)).map(group => group.filter(frame => !frame.empty).length);
  const groupConsistency = groupCounts.length ? clamp(1 - cv(groupCounts) * .8) : 0;
  const footVariation = mean(groups.map(group => {
    const feet = group.filter(frame => !frame.empty).map(frame => frame.feetY);
    const scale = median(group.filter(frame => frame.bounds).map(frame => frame.bounds.h));
    return feet.length > 1 && scale ? (Math.max(...feet) - Math.min(...feet)) / scale : 0;
  }));
  const alignment = clamp(1 - footVariation * .9);
  const densities = alive.map(frame => frame.area / Math.max(1, frame.bounds.w * frame.bounds.h));
  const occupancy = densities.length ? mean(densities) : 0;
  const seeds = majorComponents(analysis);
  const evidenceCount = seedCount || seeds.length;
  const countAgreement = evidenceCount ? Math.exp(-Math.abs(Math.log(Math.max(1, detectedFrames) / evidenceCount)) * 1.25) : .5;
  const componentCounts = alive.map(frame => seeds.filter(seed => (
    seed.cx >= frame.cell.x && seed.cx < frame.cell.x + frame.cell.w &&
    seed.cy >= frame.cell.y && seed.cy < frame.cell.y + frame.cell.h
  )).length);
  const componentPurity = componentCounts.length
    ? componentCounts.filter(count => count === 1).length / componentCounts.length
    : 0;
  const xBoundary = xCuts ? boundaryDensity(analysis, xCuts, 'x') : 1;
  const yBoundary = yCuts ? boundaryDensity(analysis, yCuts, 'y') : 1;
  const separators = mean([xBoundary, yBoundary]);
  const falseFrames = alive.filter(frame => frame.area < median(areas) * .32).length;
  const xClusters = groups.length > 1 && alive.length > 1
    ? clusterItems(alive, 'cx', Math.max(3, median(widths) * .58))
    : [];
  let internalEmptySlots = 0;
  if (xClusters.length > 1 && xClusters.length <= 12) for (const group of groups) {
    const occupied = group.filter(frame => !frame.empty).map(frame => {
      let nearest = 0;
      let distance = Infinity;
      xClusters.forEach((cluster, index) => {
        const next = Math.abs(frame.cx - cluster.center);
        if (next < distance) { nearest = index; distance = next; }
      });
      return nearest;
    }).sort((a, b) => a - b);
    if (occupied.length > 1) for (let index = occupied[0]; index <= occupied.at(-1); index++) if (!occupied.includes(index)) internalEmptySlots++;
  }
  const score = clamp(
    coverage * .16 +
    nonEmpty * .09 +
    sizeConsistency * .12 +
    heightConsistency * .07 +
    widthConsistency * .04 +
    (1 - clipping) * .15 +
    groupConsistency * .06 +
    alignment * .05 +
    countAgreement * .12 +
    componentPurity * .10 +
    separators * .04 -
    falseFrames / Math.max(1, frameCount) * .16 -
    internalEmptySlots / Math.max(1, frameCount) * .10
  );
  return F({
    score,
    frameCount,
    detectedFrames,
    emptyFrames: frameCount - detectedFrames,
    falseFrames,
    internalEmptySlots,
    coverage,
    missedForeground: clamp(1 - coverage),
    nonEmpty,
    sizeConsistency,
    heightConsistency,
    widthConsistency,
    clipping,
    canvasClipping,
    groupConsistency,
    footVariation,
    alignment,
    occupancy,
    countAgreement,
    componentPurity,
    boundaryTouches,
    separators
  });
}

export function scoreSpriteLayout(analysis, groups, metadata = {}) {
  return frameLayoutEvidence(analysis, groups, metadata);
}

function freezeHypothesis(hypothesis) {
  const groups = hypothesis.groups.map(group => F(group.map(frame => F({...frame}))));
  return F({...hypothesis, groups: F(groups), frames: F(groups.flat()), evidence: F({...hypothesis.evidence})});
}

function layoutSignature(groups) {
  return groups.map(group => group.filter(frame => !frame.empty).map(frame => `${Math.round(frame.cx / 8)},${Math.round(frame.cy / 8)}`).join('|')).join('/');
}

function topologySignature(layout) {
  return `${layout.rows}:${layout.frameCounts.join(',')}`;
}

function hypothesisFromGroups(analysis, mode, groups, details = {}) {
  const evidence = frameLayoutEvidence(analysis, groups, details);
  return freezeHypothesis({
    mode,
    groups,
    rows: groups.length,
    columns: Math.max(0, ...groups.map(group => group.length)),
    frameCounts: F(groups.map(group => group.filter(frame => !frame.empty).length)),
    evidence,
    score: evidence.score,
    why: String(details.why || ''),
    adaptive: !!details.adaptive,
    signature: layoutSignature(groups)
  });
}

export function buildSpriteLayoutHypotheses(analysis, {
  maxColumns = 12,
  maxRows = 8,
  maxFrames = 64
} = {}) {
  if (!analysis?.mask || !analysis?.width || !analysis?.height) throw new Error('SPRITE_LAYOUT_FOREGROUND_ANALYSIS_REQUIRED');
  const hypotheses = [];
  const extent = contentExtent(analysis);
  const component = componentFrames(analysis);
  if (component.groups.length && component.seedCount <= maxFrames) {
    const count = component.groups.flat().length;
    const mode = component.groups.length === 1 && count > 1
      ? 'horizontal-strip'
      : component.groups.every(group => group.length === 1) && count > 1
        ? 'vertical-strip'
        : component.groups.length > 1
          ? 'spatial-clusters'
          : 'connected-components';
    hypotheses.push(hypothesisFromGroups(analysis, mode, component.groups, {
      seedCount: component.seedCount,
      assignedArea: component.assignedArea,
      why: 'connected foreground objects grouped by spatial rows'
    }));
  }

  const xProjection = projectSpriteMask(analysis.mask, analysis.width, analysis.height, 'x');
  const yProjection = projectSpriteMask(analysis.mask, analysis.width, analysis.height, 'y');
  const xRuns = projectionRuns(xProjection, extent.x, extent.w, extent.h);
  const yRuns = projectionRuns(yProjection, extent.y, extent.h, extent.w);
  if (xRuns.length >= 1 && yRuns.length >= 1 && xRuns.length <= maxColumns && yRuns.length <= maxRows && xRuns.length * yRuns.length <= maxFrames) {
    const xCuts = cutsAroundRuns(xRuns, extent.x, extent.x + extent.w);
    const yCuts = cutsAroundRuns(yRuns, extent.y, extent.y + extent.h);
    const groups = framesFromCuts(analysis, xCuts, yCuts);
    const mode = yRuns.length === 1 && xRuns.length > 1
      ? 'projection-horizontal-strip'
      : xRuns.length === 1 && yRuns.length > 1
        ? 'projection-vertical-strip'
        : 'projection-clusters';
    hypotheses.push(hypothesisFromGroups(analysis, mode, groups, {
      xCuts,
      yCuts,
      seedCount: component.seedCount,
      why: 'foreground projection valleys delimit independently spaced regions'
    }));
  }

  const suggestedColumns = new Set([1, 2, 3, 4, 6, 8]);
  const suggestedRows = new Set([1, 2, 4, 8]);
  if (component.groups.length) {
    suggestedRows.add(component.groups.length);
    for (const group of component.groups) suggestedColumns.add(group.length);
  }
  if (xRuns.length) suggestedColumns.add(xRuns.length);
  if (yRuns.length) suggestedRows.add(yRuns.length);
  const pairs = [];
  for (const rows of suggestedRows) for (const columns of suggestedColumns) {
    if (columns < 1 || rows < 1 || columns > maxColumns || rows > maxRows || columns * rows > maxFrames) continue;
    const cellAspect = (extent.w / columns) / Math.max(1, extent.h / rows);
    if (cellAspect < .28 || cellAspect > 3.5) continue;
    pairs.push({columns, rows});
  }
  for (const {columns, rows} of pairs) {
    const equalX = equalCuts(extent.x, extent.w, columns);
    const equalY = equalCuts(extent.y, extent.h, rows);
    hypotheses.push(hypothesisFromGroups(analysis, 'regular-grid', framesFromCuts(analysis, equalX, equalY), {
      xCuts: equalX,
      yCuts: equalY,
      seedCount: component.seedCount,
      why: `equal ${columns}×${rows} divisions over trimmed content`
    }));
    if (columns > 1 || rows > 1) {
      const adaptiveX = adaptiveCuts(xProjection, extent.x, extent.w, columns);
      const adaptiveY = adaptiveCuts(yProjection, extent.y, extent.h, rows);
      hypotheses.push(hypothesisFromGroups(analysis, 'adaptive-grid', framesFromCuts(analysis, adaptiveX, adaptiveY), {
        xCuts: adaptiveX,
        yCuts: adaptiveY,
        seedCount: component.seedCount,
        adaptive: true,
        why: `low-density separators near a ${columns}×${rows} layout`
      }));
    }
  }

  const unique = [];
  const seen = new Set();
  for (const hypothesis of hypotheses.sort((a, b) => b.score - a.score || a.frames.length - b.frames.length)) {
    if (seen.has(hypothesis.signature)) continue;
    seen.add(hypothesis.signature);
    unique.push(hypothesis);
  }
  return F(unique.slice(0, 12));
}

export function buildManualSpriteLayout(analysis, {columns = 1, rows = 1, sourceRects = null} = {}) {
  if (!analysis?.mask) throw new Error('SPRITE_LAYOUT_FOREGROUND_ANALYSIS_REQUIRED');
  columns = Math.max(1, Math.min(16, Math.round(columns)));
  rows = Math.max(1, Math.min(12, Math.round(rows)));
  let groups;
  if (Array.isArray(sourceRects) && sourceRects.length === columns * rows) {
    groups = [];
    for (let row = 0; row < rows; row++) {
      const group = [];
      for (let column = 0; column < columns; column++) {
        group.push(scanFrame(analysis.mask, analysis.width, analysis.height, sourceRects[row * columns + column], row, column));
      }
      groups.push(group);
    }
  } else {
    const extent = contentExtent(analysis);
    groups = framesFromCuts(analysis, equalCuts(extent.x, extent.w, columns), equalCuts(extent.y, extent.h, rows));
  }
  return hypothesisFromGroups(analysis, 'manual-layout', groups, {
    seedCount: majorComponents(analysis).length,
    why: 'explicit advanced layout selected by the user'
  });
}

export function interpretSpriteLayout(sourceData, width, height, options = {}) {
  const foreground = options.foreground || analyzeSpriteForeground(sourceData, width, height, options.foregroundOptions);
  const hypotheses = buildSpriteLayoutHypotheses(foreground, options);
  const best = hypotheses[0] || null;
  const topology = best ? topologySignature(best) : '';
  const runner = hypotheses.find(candidate => topologySignature(candidate) !== topology) || null;
  const margin = best ? best.score - (runner?.score || 0) : 0;
  const confidence = best ? clamp(
    (best.score - .52) / .42 * .74 +
    clamp(margin / .12) * .18 +
    best.evidence.countAgreement * .08
  ) : 0;
  const closeAlternatives = best ? hypotheses.filter(candidate => topologySignature(candidate) !== topology && best.score - candidate.score <= .045).slice(0, 2) : [];
  const reasons = [];
  if (!best) reasons.push('NO_LAYOUT');
  if (best && best.score < .70) reasons.push('LOW_LAYOUT_SCORE');
  if (confidence < .68) reasons.push('LOW_CONFIDENCE');
  if (closeAlternatives.length) reasons.push('AMBIGUOUS_INTERPRETATION');
  if (best?.evidence.clipping > .09) reasons.push('CLIPPING_RISK');
  if (best?.evidence.emptyFrames || best?.evidence.internalEmptySlots) reasons.push('EMPTY_FRAMES');
  if (foreground.background.kind === 'mixed') reasons.push('COMPLEX_BACKGROUND');
  return F({
    version: 'sprite-layout-interpreter-v1.0.0',
    foreground,
    best,
    hypotheses,
    alternatives: F(closeAlternatives),
    confidence,
    margin,
    reviewRequired: reasons.length > 0,
    reviewReasons: F(reasons)
  });
}

export const __spriteLayoutInternals = F({
  adaptiveCuts,
  clusterItems,
  componentFrames,
  contentExtent,
  framesFromCuts,
  integralMask,
  localProjectionValley,
  majorComponents,
  projectionRuns,
  scanFrame,
  sumRect,
  topologySignature
});
