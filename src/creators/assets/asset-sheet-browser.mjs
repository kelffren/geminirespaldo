/* KELO-INDEX
 * area: CREATORS / ASSET SHEET BROWSER ADAPTER
 * owner: Kelo Creator Asset Bridge
 * owns: browser image decoding, clean preview and atlas/frame PNG export
 * does-not-own: pixel segmentation, semantic review, storage, catalog registration or remote APIs
 * public-api: analyzeAssetSheetFile(), renderAssetSheetPreview(), exportAssetFramePng(), exportCleanAtlasPng(), exportCleanAtlasDataUrl()
 * online: no; reads a local File and returns local Blobs
 */
import { analyzeAssetSheetPixels } from './asset-sheet-compiler.mjs';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 12_000_000;
const text = value => String(value == null ? '' : value).trim();

function assertImageFile(file) {
  const name = text(file?.name).toLowerCase();
  const type = text(file?.type).toLowerCase();
  const supported = type === 'image/png' || type === 'image/webp' || type === 'image/jpeg' || /\.(png|webp|jpe?g)$/.test(name);
  if (!supported) throw new Error('ASSET_SHEET_IMAGE_TYPE_UNSUPPORTED');
  if (Number(file?.size) > MAX_BYTES) throw new Error('ASSET_SHEET_IMAGE_TOO_LARGE:20MB');
}

function canvasFor(root, width, height) {
  if (!root?.document?.createElement) throw new Error('ASSET_SHEET_DOM_REQUIRED');
  const canvas = root.document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  if (!context) throw new Error('ASSET_SHEET_CANVAS_UNAVAILABLE');
  return {canvas, context};
}

async function decodeWithImageBitmap(file, root) {
  if (typeof root?.createImageBitmap !== 'function') return null;
  const bitmap = await root.createImageBitmap(file);
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, bitmap.width * bitmap.height)), 2048 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const {context} = canvasFor(root, width, height);
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return {width, height, data:context.getImageData(0, 0, width, height).data};
  } finally {
    bitmap.close?.();
  }
}

async function decodeWithImageElement(file, root) {
  const document = root?.document;
  if (!document?.createElement || !root?.URL?.createObjectURL) throw new Error('ASSET_SHEET_IMAGE_DECODER_UNAVAILABLE');
  const url = root.URL.createObjectURL(file);
  try {
    const image = document.createElement('img');
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('ASSET_SHEET_IMAGE_DECODE_FAILED'));
      image.src = url;
    });
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, image.naturalWidth * image.naturalHeight)), 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const {context} = canvasFor(root, width, height);
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return {width, height, data:context.getImageData(0, 0, width, height).data};
  } finally {
    root.URL.revokeObjectURL?.(url);
  }
}

export async function analyzeAssetSheetFile(file, {root=globalThis, options={}} = {}) {
  assertImageFile(file);
  const decoded = await decodeWithImageBitmap(file, root) || await decodeWithImageElement(file, root);
  const analysis = analyzeAssetSheetPixels(decoded.data, decoded.width, decoded.height, options);
  Object.defineProperty(analysis, 'sourcePixels', {value:decoded.data, enumerable:false, configurable:false});
  Object.defineProperty(analysis, 'sourceName', {value:text(file.name) || 'asset-sheet.png', enumerable:false, configurable:false});
  return analysis;
}

function cleanImageData(analysis, root) {
  if (!analysis?.sourcePixels || !analysis?.alphaMask) throw new Error('ASSET_SHEET_SOURCE_PIXELS_REQUIRED');
  const {context} = canvasFor(root, analysis.width, analysis.height);
  const image = context.createImageData(analysis.width, analysis.height);
  for (let index = 0; index < analysis.width * analysis.height; index += 1) {
    const sourceIndex = index * 4;
    image.data[sourceIndex] = analysis.sourcePixels[sourceIndex];
    image.data[sourceIndex + 1] = analysis.sourcePixels[sourceIndex + 1];
    image.data[sourceIndex + 2] = analysis.sourcePixels[sourceIndex + 2];
    image.data[sourceIndex + 3] = Math.round(Math.min(analysis.sourcePixels[sourceIndex + 3], analysis.alphaMask[index]));
  }
  return {context, image};
}

export function renderAssetSheetPreview(analysis, {root=globalThis} = {}) {
  const {context, image} = cleanImageData(analysis, root);
  context.putImageData(image, 0, 0);
  return context.canvas;
}

function canvasBlob(canvas, root) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('ASSET_SHEET_PNG_EXPORT_FAILED')), 'image/png');
  });
}

export async function exportCleanAtlasPng(analysis, {root=globalThis} = {}) {
  const {context, image} = cleanImageData(analysis, root);
  context.putImageData(image, 0, 0);
  return canvasBlob(context.canvas, root);
}

export function exportCleanAtlasDataUrl(analysis, {root=globalThis} = {}) {
  const {context, image} = cleanImageData(analysis, root);
  context.putImageData(image, 0, 0);
  return context.canvas.toDataURL('image/png');
}

export async function exportAssetFramePng(analysis, frameId, {root=globalThis} = {}) {
  const frame = (analysis?.assets || []).find(candidate => candidate.frameId === frameId || candidate.assetId === frameId);
  if (!frame) throw new Error(`ASSET_SHEET_FRAME_NOT_FOUND:${frameId}`);
  const rect = frame.sourceRect;
  const {context, image} = cleanImageData(analysis, root);
  const crop = context.createImageData(rect.w, rect.h);
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const source = ((rect.y + y) * analysis.width + rect.x + x) * 4;
      const target = (y * rect.w + x) * 4;
      crop.data[target] = image.data[source];
      crop.data[target + 1] = image.data[source + 1];
      crop.data[target + 2] = image.data[source + 2];
      crop.data[target + 3] = image.data[source + 3];
    }
  }
  const output = root.document.createElement('canvas');
  output.width = rect.w; output.height = rect.h;
  output.getContext('2d').putImageData(crop, 0, 0);
  return canvasBlob(output, root);
}
