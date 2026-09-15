/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FOREGROUND
 * owner: deterministic sprite foreground and background analysis
 * keys: SPRITE FOREGROUND BACKGROUND ALPHA HALO FLOOD COMPONENT PROJECTION
 * purpose: separate artwork from transparent or flat AI backgrounds without changing anatomy, clothing or design
 * public-api: analyzeSpriteForeground, estimateSpriteBackground, connectedSpriteComponents, projectSpriteMask
 * consumes: RGBA pixel buffers only
 * state-owned: none; pure pixels -> analysis
 * extension-points: background models, deterministic masks and component descriptors
 * online: N/A; local presentation preparation only
 * do-not: infer animation semantics, repack frames, persist assets or generate pixels
 */

const F = Object.freeze;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};
const quantile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.round(clamp(q, 0, 1) * (sorted.length - 1))];
};
const colorDistance = (r, g, b, rgb) => Math.hypot(r - rgb[0], g - rgb[1], b - rgb[2]);

function rgba(sourceData, width, height) {
  const data = sourceData?.data || sourceData;
  if (!data || data.length < width * height * 4) throw new Error('SPRITE_FOREGROUND_PIXELS_REQUIRED');
  return data;
}

function borderSamples(data, width, height, inset = 0) {
  const samples = [];
  const x0 = clamp(Math.round(inset), 0, Math.max(0, width - 1));
  const y0 = clamp(Math.round(inset), 0, Math.max(0, height - 1));
  const x1 = Math.max(x0, width - 1 - x0);
  const y1 = Math.max(y0, height - 1 - y0);
  const step = Math.max(1, Math.floor(Math.max(width, height) / 192));
  const take = (x, y) => {
    const i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  };
  for (let x = x0; x <= x1; x += step) {
    take(x, y0);
    if (y1 !== y0) take(x, y1);
  }
  for (let y = y0 + step; y < y1; y += step) {
    take(x0, y);
    if (x1 !== x0) take(x1, y);
  }
  return samples;
}

export function estimateSpriteBackground(sourceData, width, height, {
  alphaThreshold = 16,
  quantum = 20
} = {}) {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const data = rgba(sourceData, width, height);
  const inset = Math.min(3, Math.floor(Math.min(width, height) / 24));
  const samples = [...borderSamples(data, width, height, 0), ...borderSamples(data, width, height, inset)];
  const transparent = samples.filter(pixel => pixel[3] <= alphaThreshold).length;
  const transparentRatio = transparent / Math.max(1, samples.length);
  const opaque = samples.filter(pixel => pixel[3] > alphaThreshold);

  if (!opaque.length || transparentRatio >= 0.55) {
    return F({
      kind: 'transparent',
      rgb: F([0, 0, 0]),
      uniform: true,
      confidence: clamp(0.72 + transparentRatio * 0.28, 0, 1),
      transparentRatio,
      dominance: transparentRatio,
      borderNoise: 0,
      variationRatio: 0,
      coreThreshold: 0,
      haloThreshold: 0
    });
  }

  const bins = new Map();
  for (const pixel of opaque) {
    const key = `${Math.round(pixel[0] / quantum)}:${Math.round(pixel[1] / quantum)}:${Math.round(pixel[2] / quantum)}`;
    const group = bins.get(key) || [];
    group.push(pixel);
    bins.set(key, group);
  }
  const dominant = [...bins.values()].sort((a, b) => b.length - a.length)[0] || opaque;
  const rgb = [0, 1, 2].map(channel => Math.round(median(dominant.map(pixel => pixel[channel]))));
  const distances = opaque.map(pixel => colorDistance(pixel[0], pixel[1], pixel[2], rgb));
  const p90 = quantile(distances, 0.9);
  const variationRatio = distances.filter(distance => distance > 7).length / Math.max(1, distances.length);
  const dominance = dominant.length / Math.max(1, opaque.length);
  const uniform = dominance >= 0.46 && p90 <= 58;
  const confidence = clamp(dominance * 0.68 + (1 - clamp(p90 / 92, 0, 1)) * 0.32, 0, 1);
  const coreThreshold = clamp(24 + p90 * 1.45, 28, 92);
  const haloThreshold = clamp(coreThreshold + 34, 52, 132);

  return F({
    kind: uniform ? 'color' : 'mixed',
    rgb: F(rgb),
    uniform,
    confidence,
    transparentRatio,
    dominance,
    borderNoise: p90,
    variationRatio,
    coreThreshold,
    haloThreshold
  });
}

function floodConnectedBackground(data, width, height, background, alphaThreshold) {
  const total = width * height;
  const connected = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const eligible = pixel => {
    const i = pixel * 4;
    if (data[i + 3] <= alphaThreshold) return true;
    return colorDistance(data[i], data[i + 1], data[i + 2], background.rgb) <= background.haloThreshold;
  };
  const push = pixel => {
    if (pixel < 0 || pixel >= total || connected[pixel] || !eligible(pixel)) return;
    connected[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    push(y * width);
    if (width > 1) push(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) push(pixel - 1);
    if (x + 1 < width) push(pixel + 1);
    if (y > 0) push(pixel - width);
    if (y + 1 < height) push(pixel + width);
  }
  return connected;
}

function countOpaqueBorder(data, width, height, threshold = 18) {
  let opaque = 0;
  let total = 0;
  const take = (x, y) => {
    total++;
    if (data[(y * width + x) * 4 + 3] > threshold) opaque++;
  };
  for (let x = 0; x < width; x++) {
    take(x, 0);
    if (height > 1) take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    take(0, y);
    if (width > 1) take(width - 1, y);
  }
  return {opaque, total, ratio: opaque / Math.max(1, total)};
}

export function connectedSpriteComponents(mask, width, height, {minArea = 2} = {}) {
  if (!mask || mask.length < width * height) throw new Error('SPRITE_FOREGROUND_MASK_REQUIRED');
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const components = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    let edgePixels = 0;
    seen[start] = 1;
    queue[tail++] = start;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      area++;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edgePixels++;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (area < minArea) continue;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    components.push(F({
      id: components.length,
      area,
      x: minX,
      y: minY,
      w,
      h,
      right: maxX,
      bottom: maxY,
      cx: sumX / area,
      cy: sumY / area,
      density: area / Math.max(1, w * h),
      edgePixels,
      touchesCanvasEdge: edgePixels > 0
    }));
  }
  return F(components.sort((a, b) => b.area - a.area));
}

export function projectSpriteMask(mask, width, height, axis) {
  if (!mask || mask.length < width * height) throw new Error('SPRITE_FOREGROUND_MASK_REQUIRED');
  const length = axis === 'y' ? height : width;
  const other = axis === 'y' ? width : height;
  const projection = new Float32Array(length);
  if (axis === 'y') {
    for (let y = 0; y < height; y++) {
      let active = 0;
      for (let x = 0; x < width; x++) active += mask[y * width + x];
      projection[y] = active / Math.max(1, other);
    }
  } else {
    for (let x = 0; x < width; x++) {
      let active = 0;
      for (let y = 0; y < height; y++) active += mask[y * width + x];
      projection[x] = active / Math.max(1, other);
    }
  }
  return projection;
}

export function analyzeSpriteForeground(sourceData, width, height, options = {}) {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const data = rgba(sourceData, width, height);
  const alphaThreshold = clamp(options.alphaThreshold ?? 16, 0, 254);
  const background = estimateSpriteBackground(data, width, height, {alphaThreshold});
  const cleanedData = new Uint8ClampedArray(data);
  let removedPixels = 0;
  let softenedPixels = 0;

  if (background.kind === 'color' && background.uniform) {
    const connected = floodConnectedBackground(data, width, height, background, alphaThreshold);
    const span = Math.max(1, background.haloThreshold - background.coreThreshold);
    for (let pixel = 0; pixel < connected.length; pixel++) {
      if (!connected[pixel]) continue;
      const i = pixel * 4;
      const distance = colorDistance(data[i], data[i + 1], data[i + 2], background.rgb);
      if (distance <= background.coreThreshold || data[i + 3] <= alphaThreshold) {
        if (cleanedData[i + 3] > 0) removedPixels++;
        cleanedData[i + 3] = 0;
      } else {
        const ratio = clamp((distance - background.coreThreshold) / span, 0, 1);
        const alpha = Math.round(cleanedData[i + 3] * ratio * ratio);
        if (alpha < cleanedData[i + 3]) softenedPixels++;
        cleanedData[i + 3] = alpha;
      }
    }
  } else {
    for (let i = 0; i < cleanedData.length; i += 4) {
      if (cleanedData[i + 3] <= alphaThreshold) cleanedData[i + 3] = 0;
    }
  }

  const mask = new Uint8Array(width * height);
  let foregroundPixels = 0;
  let transparentPixels = 0;
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const alpha = cleanedData[pixel * 4 + 3];
    if (alpha > Math.max(18, alphaThreshold)) {
      mask[pixel] = 1;
      foregroundPixels++;
    }
    if (alpha < 250) transparentPixels++;
  }

  const noiseFloor = Math.max(2, Math.round(foregroundPixels * 0.000015));
  const components = connectedSpriteComponents(mask, width, height, {minArea: noiseFloor});
  const border = countOpaqueBorder(cleanedData, width, height);
  const content = components.length ? {
    x: Math.min(...components.map(component => component.x)),
    y: Math.min(...components.map(component => component.y)),
    right: Math.max(...components.map(component => component.right)),
    bottom: Math.max(...components.map(component => component.bottom))
  } : null;
  const contentBounds = content ? F({
    x: content.x,
    y: content.y,
    w: content.right - content.x + 1,
    h: content.bottom - content.y + 1
  }) : null;

  return F({
    version: 'sprite-foreground-v1.1.0',
    width,
    height,
    background,
    cleanedData,
    mask,
    components,
    contentBounds,
    foregroundPixels,
    foregroundRatio: foregroundPixels / Math.max(1, width * height),
    removedPixels,
    softenedPixels,
    backgroundResidual: border.ratio,
    transparency: transparentPixels / Math.max(1, width * height),
    backgroundScore: clamp(1 - border.ratio * 5, 0, 1)
  });
}

export const __spriteForegroundInternals = F({
  borderSamples,
  floodConnectedBackground,
  countOpaqueBorder,
  colorDistance,
  mean,
  median,
  quantile
});
