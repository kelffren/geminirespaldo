/* KELO-INDEX
 * area: CREATORS / ASSET SHEET COMPILER
 * owner: Kelo Creator Asset Bridge
 * owns: local pixel segmentation, composite grouping, deterministic frame metadata and category suggestions
 * does-not-own: asset bytes storage, ChatGPT/remote APIs, catalog registration, map layout, collider authority
 * public-api: analyzeAssetSheetPixels(), buildAssetSheetManifest()
 * online: no; deterministic local analysis, output crosses the existing file/review boundary
 */
import {analyzeSpriteForeground, connectedSpriteComponents} from '../sprite-compiler/sprite-foreground-analysis.mjs';
import {compileWorldAssetPixels} from '../sprite-compiler/sprite-world-asset-compiler.mjs';

export const ASSET_SHEET_COMPILER_VERSION = 'kelo-asset-sheet-compiler-v1.1.0';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = value => Math.max(0, Math.round(Number(value) || 0));
const text = value => String(value == null ? '' : value).trim();
const positive = (value, fallback) => Math.max(1, Number(value) || fallback);

function assertPixels(rgba, width, height) {
  const w = integer(width), h = integer(height);
  if (!w || !h || !rgba || rgba.length < w * h * 4) throw new Error('ASSET_SHEET_PIXELS_INVALID');
  return {width:w, height:h};
}

function median(values) {
  if (!values.length) return 0;
  const ordered = values.slice().sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function maskToRegion(alpha, width, height, region) {
  if (!region || (region.y === 0 && region.h === height)) return alpha;
  const clipped = new Uint8ClampedArray(alpha);
  const top = clamp(integer(region.y), 0, height);
  const bottom = clamp(top + integer(region.h), 0, height);
  for (let y = 0; y < top; y += 1) clipped.fill(0, y * width, (y + 1) * width);
  for (let y = bottom; y < height; y += 1) clipped.fill(0, y * width, (y + 1) * width);
  return clipped;
}

function coreFromAlpha(alpha, threshold) {
  const core = new Uint8Array(alpha.length);
  const cutoff = clamp(integer(threshold), 1, 255);
  for (let index = 0; index < alpha.length; index += 1) if (alpha[index] >= cutoff) core[index] = 1;
  return core;
}

function alphaFromCleanedData(cleanedData, width, height) {
  const alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = cleanedData[index * 4 + 3];
  return alpha;
}

function normalizeComponents(components, options) {
  return (components || []).filter(component => component.area >= options.minComponentArea).slice(0, options.maxComponents).map((component, index) => ({
    id:`component-${String(index + 1).padStart(4, '0')}`,
    x:component.x, y:component.y, w:component.w, h:component.h, area:component.area
  }));
}

function bboxGap(a, b) {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

function componentRows(components, width, height, options) {
  if (!components.length) return {x:0, y:0, w:width, h:height, confidence:0};
  if (options.detectInterfaceNoise === false) return {x:0, y:0, w:width, h:height, confidence:1};
  const largest = Math.max(...components.map(component => component.area));
  const eligible = components.filter(component => component.area >= Math.max(options.minComponentArea * 2, largest * 0.008));
  if (eligible.length < 2) return {x:0, y:0, w:width, h:height, confidence:0.25};
  const binSize = Math.max(8, Math.floor(height / 96));
  const bins = Math.ceil(height / binSize);
  const histogram = new Float64Array(bins);
  for (const component of eligible) histogram[Math.min(bins - 1, Math.floor((component.y + component.h / 2) / binSize))] += component.area;
  const smoothed = new Float64Array(bins);
  for (let index = 0; index < bins; index += 1) smoothed[index] = (histogram[index - 1] || 0) + histogram[index] + (histogram[index + 1] || 0);
  const peak = Math.max(...smoothed);
  if (!peak) return {x:0, y:0, w:width, h:height, confidence:0};
  const active = smoothed.map(value => value >= peak * 0.035);
  const maxGapBins = Math.max(2, Math.ceil((height * 0.1) / binSize));
  const segments = [];
  let start = -1, gap = 0;
  for (let index = 0; index <= bins; index += 1) {
    const on = index < bins && active[index];
    if (on) {
      if (start < 0) start = index;
      gap = 0;
      continue;
    }
    if (start < 0) continue;
    gap += 1;
    if (gap <= maxGapBins && index < bins) continue;
    segments.push({start, end:index - gap});
    start = -1; gap = 0;
  }
  if (!segments.length) return {x:0, y:0, w:width, h:height, confidence:0};
  const best = segments.sort((a, b) => {
    const weightA = smoothed.slice(a.start, a.end + 1).reduce((sum, value) => sum + value, 0);
    const weightB = smoothed.slice(b.start, b.end + 1).reduce((sum, value) => sum + value, 0);
    return weightB - weightA;
  })[0];
  const selected = eligible.filter(component => {
    const center = component.y + component.h / 2;
    return center >= best.start * binSize && center <= (best.end + 1) * binSize;
  });
  if (selected.length < 2) return {x:0, y:0, w:width, h:height, confidence:0.2};
  const top = Math.min(...selected.map(component => component.y));
  const bottom = Math.max(...selected.map(component => component.y + component.h));
  const padding = Math.max(3, Math.round(height * 0.01));
  const y = clamp(top - padding, 0, height);
  const end = clamp(bottom + padding, 0, height);
  const h = end - y;
  if (h >= height * 0.86) return {x:0, y:0, w:width, h:height, confidence:0.35};
  return {x:0, y, w:width, h, confidence:0.78};
}

function groupComponents(components, options) {
  if (!components.length) return [];
  const largest = Math.max(...components.map(component => component.area));
  const primaryArea = Math.max(options.minComponentArea * 3, Math.round(largest * options.primaryAreaRatio));
  const primaries = components.filter(component => component.area >= primaryArea);
  const seeds = primaries.length ? primaries : components.slice().sort((a, b) => b.area - a.area).slice(0, 1);
  const groups = seeds.map(seed => ({seed, components:[seed]}));
  const seedSet = new Set(seeds);
  const satelliteRatio = clamp(Number(options.satelliteAreaRatio) || 0.22, 0.02, 0.6);
  const satelliteDistance = Math.max(4, Number(options.satelliteDistance) || 36);
  for (const component of components) {
    if (seedSet.has(component)) continue;
    let best = null;
    for (const group of groups) {
      const seed = group.seed;
      const ratio = component.area / Math.max(1, seed.area);
      // Compare against the growing group rather than only its first seed.
      // Scattered leaves and petals form visual chains: each fragment can be
      // close to the previous fragment while the last one is far from the
      // original seed.
      const gap = Math.min(...group.components.map(part => bboxGap(component, part)));
      const bothSmall = component.area < primaryArea && seed.area < primaryArea;
      const maxGap = bothSmall ? Math.max(12, satelliteDistance * 1.25) : Math.max(satelliteDistance, Math.min(72, Math.max(seed.w, seed.h) * 0.16));
      if ((ratio <= satelliteRatio || bothSmall) && gap <= maxGap && (!best || gap < best.gap)) best = {group, gap};
    }
    if (best) best.group.components.push(component);
    else groups.push({seed:component, components:[component]});
  }
  return groups.map((group, index) => {
    const x = Math.min(...group.components.map(component => component.x));
    const y = Math.min(...group.components.map(component => component.y));
    const right = Math.max(...group.components.map(component => component.x + component.w));
    const bottom = Math.max(...group.components.map(component => component.y + component.h));
    return {id:`group-${String(index + 1).padStart(4, '0')}`, x, y, w:right - x, h:bottom - y,
      area:group.components.reduce((sum, component) => sum + component.area, 0),
      componentIds:group.components.map(component => component.id), seedId:group.seed.id};
  }).filter(group => group.area >= Math.max(1, options.minComponentArea * 2));
}

function assignRows(groups, options) {
  const sorted = groups.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const medianHeight = median(sorted.map(group => group.h));
  const rowGap = Math.max(4, Math.round(medianHeight * (Number(options.rowGapRatio) || 0.22)));
  const rows = [];
  for (const group of sorted) {
    let row = rows.find(candidate => {
      const candidateHeight = candidate.bottom - candidate.y;
      const overlap = Math.max(0, Math.min(candidate.bottom, group.y + group.h) - Math.max(candidate.y, group.y));
      const aligned = overlap >= Math.min(candidateHeight, group.h) * 0.08 || Math.abs((candidate.y + candidate.bottom) / 2 - (group.y + group.h / 2)) <= Math.max(candidateHeight, group.h) * 0.32;
      return aligned && group.y <= candidate.bottom + rowGap;
    });
    if (!row) {
      row = {y:group.y, bottom:group.y + group.h, groups:[]};
      rows.push(row);
    }
    row.groups.push(group);
    row.y = Math.min(row.y, group.y);
    row.bottom = Math.max(row.bottom, group.y + group.h);
  }
  rows.sort((a, b) => a.y - b.y);
  const rowByGroup = new Map();
  rows.forEach((row, index) => row.groups.forEach(group => rowByGroup.set(group.id, index)));
  return {sorted, rowByGroup, count:rows.length};
}

function roundConfidence(value) {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

function classifyGroup(group, width, height, artworkHeight = height) {
  const aspect = group.h / Math.max(1, group.w);
  const density = group.area / Math.max(1, group.w * group.h);
  const heightRatio = group.h / Math.max(1, height);
  const widthRatio = group.w / Math.max(1, width);
  // A tree label should be conservative. Small vertical props (flower pots,
  // topiary bases and rock clusters) share the same bounding-box aspect, so a
  // candidate must also be prominent relative to the detected artwork area.
  if (group.h >= Math.max(48, artworkHeight * 0.23) && aspect >= 0.82 && density >= 0.025) {
    return {family:'tree', category:'nature/tree', confidence:roundConfidence(0.78 + Math.min(0.14, heightRatio * 0.45) + Math.min(0.06, density * 0.08)), layer:'props_back', rationale:'alto y con copa o silueta vertical; revisar especie y nombre'};
  }
  if (group.w >= 48 && group.w / Math.max(1, group.h) >= 1.45 && heightRatio <= 0.22 && group.componentIds.length <= 2) {
    return {family:'hedge', category:'nature/hedge', confidence:roundConfidence(0.74 + Math.min(0.16, widthRatio * 0.4)), layer:'props_front', rationale:'silueta horizontal baja; candidato a seto, jardinera o borde'};
  }
  if (group.h >= Math.max(24, height * 0.035) && aspect >= 1.05) {
    return {family:'plant', category:'nature/plant', confidence:roundConfidence(0.58 + Math.min(0.18, heightRatio * 0.4)), layer:'props_front', rationale:'silueta vertical pequeña; candidato a planta o maceta'};
  }
  if (group.w >= 16 || group.h >= 16) {
    return {family:'ground-cluster', category:'nature/detail', confidence:roundConfidence(0.52 + Math.min(0.18, density * 0.3)), layer:'props_front', rationale:'silueta baja o compacta; candidato a flores, rocas o detalle de suelo'};
  }
  return {family:'unknown', category:'unknown', confidence:0.25, layer:'props_front', rationale:'geometría insuficiente para una etiqueta segura'};
}

function slug(value, fallback = 'asset-sheet') {
  const normalized = text(value).toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function cropPixels(source, sourceWidth, rect) {
  const output = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y += 1) {
    const start = ((rect.y + y) * sourceWidth + rect.x) * 4;
    output.set(source.subarray(start, start + rect.w * 4), y * rect.w * 4);
  }
  return output;
}

function rectShape(rect) {
  if (!rect) return null;
  return {x:rect.x, y:rect.y, w:rect.width, h:rect.height, right:rect.right, bottom:rect.bottom};
}

function makeFrame(group, classification, index, familyIndex, width, height, options, rowIndex, cleanedPixels) {
  const padding = clamp(integer(options.cropPadding), 0, 64);
  const x = clamp(group.x - padding, 0, width);
  const y = clamp(group.y - padding, 0, height);
  const right = clamp(group.x + group.w + padding, 0, width);
  const bottom = clamp(group.y + group.h + padding, 0, height);
  const frameWidth = Math.max(1, right - x), frameHeight = Math.max(1, bottom - y);
  const frameId = `asset-${String(index + 1).padStart(3, '0')}`;
  const name = `${classification.family}-${String(familyIndex).padStart(2, '0')}`;
  const compiled = compileWorldAssetPixels(cropPixels(cleanedPixels, width, {x, y, w:frameWidth, h:frameHeight}), frameWidth, frameHeight, {
    assetId:frameId, category:classification.category, portal:classification.family === 'structure' ? 'auto' : false,
    variantGroup:classification.family, variantId:String(familyIndex).padStart(2, '0')
  });
  const profile = compiled.metadata;
  const bounds = profile.source.bounds;
  const visualBounds = bounds ? {x:bounds.x, y:bounds.y, w:bounds.width, h:bounds.height} : {x:group.x - x, y:group.y - y, w:group.w, h:group.h};
  const anchor = {x:Math.round(profile.pivot?.px?.x ?? visualBounds.x + visualBounds.w / 2), y:Math.round(profile.pivot?.px?.y ?? visualBounds.y + visualBounds.h), kind:'ground-pivot', confidence:profile.pivot?.confidence ?? 0};
  const footprint = profile.footprint?.rect ? {...rectShape(profile.footprint.rect), kind:'inferred', confidence:profile.footprint.confidence} : null;
  const collision = profile.collision || {};
  return {
    id:frameId, assetId:frameId, frameId, label:name, suggestedName:name,
    family:classification.family, category:classification.category, layer:classification.layer,
    classification:{family:classification.family, category:classification.category, confidence:classification.confidence, needsReview:classification.confidence < 0.8, rationale:classification.rationale},
    sourceRect:{x, y, w:frameWidth, h:frameHeight}, frameRect:{sx:x, sy:y, w:frameWidth, h:frameHeight},
    visualBounds, anchor, footprint,
    collider:{mode:collision.mode || 'none', shape:collision.shape || 'none', passThrough:collision.passThrough === true, solidBounds:rectShape(collision.solidBounds), solidSegments:(collision.solidSegments || []).map(rectShape), portalCutout:rectShape(collision.portalCutout), authority:'review-required'},
    portal:profile.portal, scale:profile.scale, variant:profile.variant, placementRules:profile.placementRules, styleValidation:profile.styleValidation,
    worldAssetProfile:profile.schema,
    rowIndex, sourceComponentIds:group.componentIds, groupingEvidence:{groupId:group.id, seedId:group.seedId, componentCount:group.componentIds.length, pixelArea:group.area}
  };
}

function publicAnalysis(analysis, alphaMask) {
  Object.defineProperty(analysis, 'alphaMask', {value:alphaMask, enumerable:false, configurable:false});
  return analysis;
}

export function analyzeAssetSheetPixels(rgba, width, height, inputOptions = {}) {
  const dimensions = assertPixels(rgba, width, height);
  const options = {
    alphaThreshold:clamp(integer(inputOptions.alphaThreshold == null ? 16 : inputOptions.alphaThreshold), 0, 254),
    coreAlpha:positive(inputOptions.coreAlpha, 32),
    minComponentArea:positive(inputOptions.minComponentArea, Math.max(12, Math.floor(dimensions.width * dimensions.height / 120000))),
    maxComponents:positive(inputOptions.maxComponents, 4096),
    primaryAreaRatio:clamp(Number(inputOptions.primaryAreaRatio) || 0.018, 0.001, 0.2),
    satelliteAreaRatio:clamp(Number(inputOptions.satelliteAreaRatio) || 0.22, 0.02, 0.6),
    satelliteDistance:positive(inputOptions.satelliteDistance, 36),
    rowGapRatio:clamp(Number(inputOptions.rowGapRatio) || 0.22, 0.03, 0.8),
    cropPadding:inputOptions.cropPadding == null ? 8 : integer(inputOptions.cropPadding),
    detectInterfaceNoise:inputOptions.detectInterfaceNoise !== false
  };
  const foreground = analyzeSpriteForeground(rgba, dimensions.width, dimensions.height, {alphaThreshold:options.alphaThreshold});
  const provisionalAlpha = alphaFromCleanedData(foreground.cleanedData, dimensions.width, dimensions.height);
  const provisionalComponents = normalizeComponents(foreground.components, options);
  // Native-alpha sheets already carry an explicit artwork/background boundary.
  // Row-density cropping is reserved for opaque screenshots, where it removes
  // browser/phone chrome. Applying it to a transparent atlas can mistake the
  // largest first row for the whole content region and discard later rows.
  const contentRegion = foreground.background.kind === 'transparent'
    ? {x:0, y:0, w:dimensions.width, h:dimensions.height, confidence:1}
    : componentRows(provisionalComponents, dimensions.width, dimensions.height, options);
  const alphaMask = maskToRegion(provisionalAlpha, dimensions.width, dimensions.height, contentRegion);
  const components = normalizeComponents(connectedSpriteComponents(coreFromAlpha(alphaMask, options.coreAlpha), dimensions.width, dimensions.height, {minArea:options.minComponentArea}), options);
  const groups = groupComponents(components, options);
  const rowData = assignRows(groups, options);
  const cleanedPixels = new Uint8ClampedArray(foreground.cleanedData);
  for (let index = 0; index < alphaMask.length; index += 1) cleanedPixels[index * 4 + 3] = alphaMask[index];
  const familyCounts = new Map();
  const assets = rowData.sorted.map((group, index) => {
    const classification = classifyGroup(group, dimensions.width, dimensions.height, contentRegion.h);
    const familyIndex = (familyCounts.get(classification.family) || 0) + 1;
    familyCounts.set(classification.family, familyIndex);
    return makeFrame(group, classification, index, familyIndex, dimensions.width, dimensions.height, options, rowData.rowByGroup.get(group.id) || 0, cleanedPixels);
  });
  const foregroundPixels = alphaMask.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);
  const ignoredComponentCount = Math.max(0, provisionalComponents.length - components.length);
  return publicAnalysis({
    version:ASSET_SHEET_COMPILER_VERSION,
    width:dimensions.width, height:dimensions.height,
    foregroundOwner:foreground.version,
    worldAssetProfile:'kelo-world-asset-profile-v1',
    background:{
      mode:foreground.background.kind === 'transparent' ? 'native-alpha' : (foreground.background.kind === 'color' ? 'edge-connected' : 'conservative-alpha'),
      kind:foreground.background.kind,
      color:{r:foreground.background.rgb[0], g:foreground.background.rgb[1], b:foreground.background.rgb[2]},
      confidence:Math.round(foreground.background.confidence * 100) / 100,
      transparentFraction:Math.round((1 - foregroundPixels / (dimensions.width * dimensions.height)) * 10000) / 10000
    },
    contentRegion,
    components:components.map(component => ({...component})),
    assets,
    stats:{componentCount:components.length, assetCount:assets.length, rowCount:rowData.count, foregroundPixels, ignoredComponentCount, interfaceNoiseDetected:contentRegion.confidence >= 0.6 && (contentRegion.y > 0 || contentRegion.h < dimensions.height)},
    options
  }, alphaMask);
}

function copyFrame(frame) {
  return JSON.parse(JSON.stringify(frame));
}

export function buildAssetSheetManifest(analysis, {sourceName='', sourcePath='', atlasId=''} = {}) {
  if (!analysis?.version || !Array.isArray(analysis.assets)) throw new Error('ASSET_SHEET_ANALYSIS_REQUIRED');
  const sourceSlug = slug(atlasId || sourceName, 'creator-asset-sheet');
  const resolvedAtlasId = atlasId || `${sourceSlug}-atlas-v1`;
  const frames = analysis.assets.map(copyFrame);
  const galleryMap = new Map();
  for (const frame of frames) {
    const family = frame.family || 'unknown';
    if (!galleryMap.has(family)) galleryMap.set(family, []);
    galleryMap.get(family).push(frame.assetId);
  }
  const galleries = [...galleryMap.entries()].map(([family, assetIds]) => ({id:`gallery-${sourceSlug}-${family}`, label:`${family} gallery`, family, kind:'asset-gallery', assetIds}));
  const prefabs = [...galleryMap.entries()].filter(([family]) => family !== 'unknown').map(([family, assetIds]) => ({id:`prefab-${sourceSlug}-${family}`, label:`${family} cluster`, family, kind:'asset-prefab-suggestion', assetIds, placement:'bottom-anchor', requiresReview:true}));
  return {
    kind:'kelo-asset-sheet-manifest', version:'kelo-asset-sheet-manifest-v1', compiler:ASSET_SHEET_COMPILER_VERSION,
    source:{name:text(sourceName), path:text(sourcePath), width:analysis.width, height:analysis.height, background:analysis.background, contentRegion:analysis.contentRegion},
    atlas:{id:resolvedAtlasId, kind:'prop-atlas-irregular', frameMode:'irregular', width:analysis.width, height:analysis.height, sourcePath:text(sourcePath || sourceName), frames:Object.fromEntries(frames.map(frame => [frame.frameId, frame]))},
    assets:frames, galleries, prefabs,
    importPolicy:{rectangles:'compiler-owned', semantics:'reviewable', anchor:'lower-support ground pivot', collider:'suggestion-only', placementOwner:'Map Forge / Property Catalog', bytesBoundary:'existing natural file bridge'}
  };
}
