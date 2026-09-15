/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / VALIDATION
 * owner: compiled sprite health metrics and release gate
 * keys: SPRITE VALIDATION HEALTH DETECTION ALIGNMENT BACKGROUND CONSISTENCY REVIEW REQUIRED BOUNDARY REPAIR
 * purpose: verify the real runtime atlas and explain whether it is safe to use
 * public-api: validateSpriteIngestion
 * consumes: compiled RGBA atlas + layout/rig/normalization evidence + Sprite Frame Doctor
 * state-owned: none; pure evidence -> validation report
 * extension-points: labelled-corpus oracle metrics and stricter runtime gates
 * online: N/A
 * do-not: detect layouts, normalize frames, persist assets or silently accept uncertainty
 */
import {analyzeGridCells} from './sprite-compiler-core.mjs';
import {diagnoseSpriteFrames,buildSelectiveRepairTargets} from './sprite-frame-doctor.mjs';

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
  return average ? Math.sqrt(mean(values.map(value => (value - average) ** 2))) / average : 1;
};

function borderResidual(data, width, height, alphaThreshold = 18) {
  let active = 0;
  let total = 0;
  const take = (x, y) => {
    total++;
    if (data[(y * width + x) * 4 + 3] > alphaThreshold) active++;
  };
  for (let x = 0; x < width; x++) {
    take(x, 0);
    if (height > 1) take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    take(0, y);
    if (width > 1) take(width - 1, y);
  }
  return active / Math.max(1, total);
}

function transparencyRatio(data) {
  let transparent = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 250) transparent++;
  return transparent / Math.max(1, data.length / 4);
}

function liveFrameIndexes(columns, frameCounts) {
  const live = new Set();
  frameCounts.forEach((count, row) => {
    for (let column = 0; column < count; column++) live.add(row * columns + column);
  });
  return live;
}

function localFrameMetrics(frames, frameWidth, frameHeight) {
  const heights = frames.filter(frame => frame.bounds).map(frame => frame.bounds.height);
  const widths = frames.filter(frame => frame.bounds).map(frame => frame.bounds.width);
  const areas = frames.filter(frame => frame.bounds).map(frame => frame.pixels);
  const footOffsets = [];
  const centerOffsets = [];
  const rows = new Map();
  for (const frame of frames) {
    if (!frame.bounds) continue;
    const localFoot = frame.bounds.bottom + 1 - frame.row * frameHeight;
    if (!rows.has(frame.row)) rows.set(frame.row, []);
    rows.get(frame.row).push(localFoot);
    const localCenter = frame.bounds.x + frame.bounds.width / 2 - frame.column * frameWidth;
    centerOffsets.push(Math.abs(localCenter - frameWidth / 2));
  }
  for (const feet of rows.values()) {
    const expected = median(feet);
    footOffsets.push(...feet.map(value => Math.abs(value - expected)));
  }
  return F({
    heightVariation: cv(heights),
    widthVariation: cv(widths),
    scaleVariation: cv(areas.map(Math.sqrt)),
    footAnchorDispersionPx: footOffsets.length ? Math.max(...footOffsets) : 0,
    footAnchorDispersion: footOffsets.length ? mean(footOffsets) / Math.max(1, frameHeight) : 0,
    centerDriftPx: centerOffsets.length ? Math.max(...centerOffsets) : 0,
    centerDrift: centerOffsets.length ? mean(centerOffsets) / Math.max(1, frameWidth) : 0,
    occupancy: frames.length ? mean(frames.map(frame => frame.pixels / Math.max(1, frameWidth * frameHeight))) : 0,
    clippingFrames: frames.filter(frame => frame.clipped).length
  });
}

function boundaryRepairCandidates(normalization, columns) {
  const candidates = new Set();
  for (const plan of normalization?.plans || []) {
    const frame = plan?.frame;
    const patch = plan?.patch || {};
    const crop = patch.crop || {};
    const explicitSurgery = Math.abs(Number(patch.x) || 0) > .001 ||
      Math.abs(Number(patch.y) || 0) > .001 ||
      Math.abs((Number(patch.scale) || 1) - 1) > .001 ||
      Math.abs(Number(patch.rotation) || 0) > .001 ||
      ['left','right','top','bottom'].some(key => Math.abs(Number(crop[key]) || 0) > .001) ||
      (patch.erase?.length || 0) > 0 ||
      (patch.restore?.length || 0) > 0 ||
      (patch.clone?.length || 0) > 0 ||
      (patch.fill?.length || 0) > 0 ||
      patch.overlays?.some(item => item?.visible !== false);
    if (!frame || explicitSurgery || frame.touchesCanvasEdge || plan.scaleOutlier) continue;
    if (!(Number(frame.boundaryPixels) > 0 || Number(frame.boundaryRatio) > .012)) continue;
    const row = Math.max(0, Math.round(Number(plan.row) || 0));
    const column = Math.max(0, Math.round(Number(plan.column) || 0));
    candidates.add(row * columns + column);
  }
  for (const item of normalization?.suspicious || []) {
    if (!item?.reasons?.includes('REGION_BOUNDARY_CONTACT') || item.reasons.includes('SCALE_OUTLIER')) continue;
    const row = Math.max(0, Math.round(Number(item.row) || 0));
    const column = Math.max(0, Math.round(Number(item.column) || 0));
    candidates.add(row * columns + column);
  }
  return candidates;
}

export function validateSpriteIngestion({
  outputData,
  width,
  height,
  columns,
  rows,
  frameCounts,
  directionKeys,
  foreground,
  layout,
  rig,
  normalization,
  oracle = null
} = {}) {
  const data = outputData?.data || outputData;
  if (!data || data.length < width * height * 4) throw new Error('SPRITE_VALIDATION_PIXELS_REQUIRED');
  columns = Math.max(1, Math.round(columns));
  rows = Math.max(1, Math.round(rows));
  frameCounts = Array.isArray(frameCounts) && frameCounts.length === rows ? frameCounts.map(value => Math.max(0, Math.min(columns, Math.round(value)))) : new Array(rows).fill(columns);
  const frameWidth = width / columns;
  const frameHeight = height / rows;
  const allFrames = analyzeGridCells(data, width, height, {columns, rows, alphaThreshold: 18});
  const liveIndexes = liveFrameIndexes(columns, frameCounts);
  const liveFrames = allFrames.filter((_, index) => liveIndexes.has(index));
  const unusedFrames = allFrames.filter((_, index) => !liveIndexes.has(index));
  const detectedFrames = liveFrames.filter(frame => frame.bounds).length;
  const unexpectedFrames = unusedFrames.filter(frame => frame.bounds).length;
  const expectedFrames = Number(oracle?.expectedFrames) || liveIndexes.size;
  const missedFrames = Math.max(0, expectedFrames - detectedFrames);
  const falseFrames = Math.max(0, detectedFrames - expectedFrames) + unexpectedFrames;
  const layoutEvidence = layout?.best?.evidence || layout?.evidence || null;
  const exactDetection = oracle
    ? clamp((Math.min(detectedFrames, expectedFrames) - falseFrames) / Math.max(1, expectedFrames))
    : clamp(mean([
        detectedFrames / Math.max(1, liveIndexes.size),
        layoutEvidence?.coverage ?? .5,
        layoutEvidence?.countAgreement ?? .5
      ]));
  const output = localFrameMetrics(liveFrames, frameWidth, frameHeight);
  const doctor = diagnoseSpriteFrames(liveFrames, {
    columns,
    directions: directionKeys,
    sizeTolerance: .18,
    pixelTolerance: .48,
    centerTolerance: .08,
    feetTolerancePx: 2
  });
  const residual = borderResidual(data, width, height);
  const transparency = transparencyRatio(data);
  const alignment = clamp(1 - output.footAnchorDispersion * 8 - output.centerDrift * 4);
  const background = clamp(mean([
    1 - residual * 8,
    foreground?.backgroundScore ?? .5,
    foreground?.backgroundResidual == null ? .5 : 1 - foreground.backgroundResidual * 5
  ]));
  const frameConsistency = clamp(
    (1 - output.heightVariation * 3.2) * .34 +
    (1 - output.scaleVariation * 2.4) * .28 +
    alignment * .24 +
    (1 - doctor.defectiveCount / Math.max(1, doctor.total)) * .14
  );
  const interpretationConfidence = clamp(mean([layout?.confidence ?? .5, rig?.confidence ?? .5]));
  const clippingScore = clamp(1 - output.clippingFrames / Math.max(1, liveFrames.length));
  const transparencyScore = clamp((transparency - .08) / .62);
  const finalHealth = clamp(
    exactDetection * .25 +
    alignment * .18 +
    background * .16 +
    frameConsistency * .18 +
    interpretationConfidence * .13 +
    clippingScore * .07 +
    transparencyScore * .03
  );

  const repairCandidates = boundaryRepairCandidates(normalization, columns);
  const bridgeRepairEvidenceClean = repairCandidates.size > 0 &&
    exactDetection >= .999 &&
    output.clippingFrames === 0 &&
    background >= .95 &&
    alignment >= .90 &&
    frameConsistency >= .94 &&
    finalHealth >= .95 &&
    !(normalization?.artDefects?.length) &&
    !layout?.reviewRequired &&
    !rig?.reviewRequired;
  const doctorSuppressed = bridgeRepairEvidenceClean ? doctor.defective.filter(item => {
    const key = item.row * columns + item.column;
    const unsafe = item.reasons.includes('clipped') || item.reasons.includes('empty') || item.severity > .82;
    return repairCandidates.has(key) && !unsafe;
  }) : [];
  const suppressedKeys = new Set(doctorSuppressed.map(item => `${item.row}:${item.column}`));
  const doctorUnexplained = doctor.defective.filter(item => !suppressedKeys.has(`${item.row}:${item.column}`));
  const doctorGate = doctorUnexplained.length > 0;

  const reasons = [];
  if (layout?.reviewRequired) reasons.push(...layout.reviewReasons);
  if (rig?.reviewRequired) reasons.push(...rig.reviewReasons);
  if (exactDetection < .90) reasons.push('FRAME_DETECTION_INCOMPLETE');
  if (output.clippingFrames) reasons.push('OUTPUT_CLIPPING');
  if (normalization?.artDefects?.length) reasons.push('ART_DEFECT_REGENERATION_REQUIRED');
  if (doctorGate) reasons.push('SUSPICIOUS_FRAMES');
  if (background < .88) reasons.push('BACKGROUND_RESIDUAL');
  if (alignment < .90) reasons.push('ANCHOR_DRIFT');
  if (finalHealth < .84) reasons.push('HEALTH_BELOW_RELEASE_GATE');
  const uniqueReasons = [...new Set(reasons)];
  const gateDiagnosis = F({...doctor, defective:F(doctorUnexplained)});
  return F({
    version: 'sprite-ingestion-validator-v1.0.2-boundary-repair-aware',
    status: uniqueReasons.length ? 'REVIEW_REQUIRED' : 'VALIDATED',
    reviewRequired: uniqueReasons.length > 0,
    reviewReasons: F(uniqueReasons),
    scores: F({
      detection: exactDetection,
      alignment,
      background,
      frameConsistency,
      interpretationConfidence,
      clipping: clippingScore,
      transparency: transparencyScore,
      finalHealth
    }),
    counts: F({expectedFrames, detectedFrames, missedFrames, falseFrames, unexpectedFrames}),
    metrics: F({
      ...output,
      backgroundResidual: residual,
      sourceBackgroundResidual: foreground?.backgroundResidual ?? null,
      transparency,
      sourceTransparency: foreground?.transparency ?? null,
      sourceHeightVariation: normalization?.sourceMetrics?.heightVariation ?? null,
      sourceScaleVariation: normalization?.sourceMetrics?.visualScaleVariation ?? null,
      sourceFootAnchorDispersionPx: normalization?.sourceMetrics?.footAnchorDispersionPx ?? null,
      sourceCenterDrift: normalization?.sourceMetrics?.centerDrift ?? null
    }),
    frameDoctor: doctor,
    doctorGate: F({
      originalDefectiveCount: doctor.defectiveCount,
      unexplainedDefectiveCount: doctorUnexplained.length,
      suppressedBoundaryRepairCount: doctorSuppressed.length,
      suppressed: F(doctorSuppressed.map(item => F({index:item.index,row:item.row,column:item.column,reasons:item.reasons,severity:item.severity})))
    }),
    selectiveRepairTargets: buildSelectiveRepairTargets(gateDiagnosis, {maxTargets: 12}),
    artDefects: F([...(normalization?.artDefects || [])])
  });
}

export const __spriteValidationInternals = F({borderResidual, liveFrameIndexes, localFrameMetrics, transparencyRatio, boundaryRepairCandidates});
