export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomBetween(min, max) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function timestampString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function isObjectUrl(src) {
  return typeof src === 'string' && src.startsWith('blob:');
}

export function revokeObjectUrl(src) {
  if (isObjectUrl(src)) {
    URL.revokeObjectURL(src);
  }
}

function arrayBufferToDataUrl(buffer, mimeType = 'application/octet-stream') {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function fileToDataUrl(file) {
  const buffer = await file.arrayBuffer();
  return arrayBufferToDataUrl(buffer, file.type || 'application/octet-stream');
}
