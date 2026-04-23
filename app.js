// ============================================================
// Prop Placer - clean rebuild
// Beginner-friendly scene prop placement tool
// ============================================================

import { dom, ctx, assetPreviewCtx } from './dom.js';
import { exportAsJson as buildExportJson, exportAsJsModule as buildExportJsModule } from './export-helpers.js';
import {
  DEFAULTS,
  HISTORY_LIMIT,
  STORAGE_KEY,
  assetImageCache,
  assetUploadDraft,
  counters,
  createAsset,
  createPlacedProp,
  editHistory,
  previewState,
  state,
  uiState
} from './state.js';
import {
  clamp,
  fileToDataUrl,
  isTypingTarget,
  randomBetween,
  revokeObjectUrl,
  timestampString
} from './utils.js';

function snapValue(value) {
  if (!state.grid.enabled) return value;
  const size = Math.max(1, state.grid.size);
  return Math.round(value / size) * size;
}

function snapPoint(x, y) {
  return {
    x: snapValue(x),
    y: snapValue(y)
  };
}

function revokeRuntimeObjectUrls() {
  revokeObjectUrl(assetUploadDraft.imageSrc);
  revokeObjectUrl(uiState.pendingBackgroundUrl);
  revokeObjectUrl(state.background.imageSrc);
  getAllAssets().forEach((asset) => revokeObjectUrl(asset.imageSrc));
}

// ------------------------------------------------------------
// Local storage
// ------------------------------------------------------------
function getNextNumberedId(ids, prefix) {
  const pattern = new RegExp(`^${prefix}_(\\d+)$`);
  let highest = 0;

  ids.forEach((id) => {
    const match = String(id).match(pattern);
    if (!match) return;
    highest = Math.max(highest, Number(match[1]) || 0);
  });

  return highest + 1;
}

function saveToLocalStorage() {
  const dataToSave = {
    version: 1,
    background: state.background,
    world: state.world,
    assets: state.assets,
    props: state.props,
    grid: state.grid,
    mobileMode: state.mobileMode,
    selection: state.selection,
    preview: {
      bpm: previewState.bpm
    },
    counters: {
      assetCounter: counters.asset,
      propCounter: counters.prop
    }
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Failed to save state', error);
  }
}

function restoreBackgroundImageFromState() {
  uiState.backgroundImage = null;

  if (!state.background.imageSrc) return;

  const image = new Image();
  image.onload = () => {
    uiState.backgroundImage = image;
    fitCanvasToBackground();
    renderEditor();
  };
  image.src = state.background.imageSrc;
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    const data = JSON.parse(saved);

    Object.assign(state.background, data.background || {});
    Object.assign(state.world, data.world || {});

    if (data.assets?.byId) {
      state.assets = {
        byId: data.assets.byId
      };
    }

    if (data.props?.byId && Array.isArray(data.props.order)) {
      state.props = {
        byId: data.props.byId,
        order: data.props.order
      };
    }

    Object.assign(state.grid, data.grid || {});
    Object.assign(state.selection, data.selection || {});
    state.mobileMode = Boolean(data.mobileMode);

    if (data.preview?.bpm) {
      previewState.bpm = clamp(Number(data.preview.bpm) || DEFAULTS.preview.bpm, 30, 300);
    }

    counters.asset = Math.max(
      Number(data.counters?.assetCounter) || 1,
      getNextNumberedId(Object.keys(state.assets.byId), 'asset')
    );
    counters.prop = Math.max(
      Number(data.counters?.propCounter) || 1,
      getNextNumberedId(Object.keys(state.props.byId), 'prop')
    );

    if (state.selection.assetId && !getAsset(state.selection.assetId)) {
      state.selection.assetId = null;
    }

    if (state.selection.propId && !getProp(state.selection.propId)) {
      state.selection.propId = null;
    }

    restoreBackgroundImageFromState();
    ensurePreviewStatesMatchProps();
    return true;
  } catch (error) {
    console.error('Failed to load saved state', error);
    return false;
  }
}

// ------------------------------------------------------------
// Edit history
// ------------------------------------------------------------
function clonePropsState() {
  return JSON.parse(JSON.stringify(state.props));
}

function propsSnapshotsMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function pushHistorySnapshot(stack, snapshot) {
  stack.push(snapshot);

  if (stack.length > HISTORY_LIMIT) {
    stack.shift();
  }
}

function rememberPropsBeforeChange(beforeSnapshot) {
  const afterSnapshot = clonePropsState();
  if (propsSnapshotsMatch(beforeSnapshot, afterSnapshot)) return;

  pushHistorySnapshot(editHistory.undo, beforeSnapshot);
  editHistory.redo = [];
}

function restorePropsSnapshot(snapshot) {
  state.props = JSON.parse(JSON.stringify(snapshot));

  if (state.selection.propId && !getProp(state.selection.propId)) {
    state.selection.propId = null;
  }

  ensurePreviewStatesMatchProps();
  saveToLocalStorage();
  refreshAllUi();
}

function undoEdit() {
  const snapshot = editHistory.undo.pop();
  if (!snapshot) return;

  pushHistorySnapshot(editHistory.redo, clonePropsState());
  restorePropsSnapshot(snapshot);
}

function redoEdit() {
  const snapshot = editHistory.redo.pop();
  if (!snapshot) return;

  pushHistorySnapshot(editHistory.undo, clonePropsState());
  restorePropsSnapshot(snapshot);
}

// ------------------------------------------------------------
// Asset helpers
// ------------------------------------------------------------
function addAsset(assetData) {
  const asset = createAsset(assetData);
  state.assets.byId[asset.id] = asset;
  saveToLocalStorage();
  return asset;
}

function updateAsset(assetId, patch) {
  const existing = state.assets.byId[assetId];
  if (!existing) return null;
  state.assets.byId[assetId] = { ...existing, ...patch };
  saveToLocalStorage();
  return state.assets.byId[assetId];
}

function getAsset(assetId) {
  return state.assets.byId[assetId] || null;
}

function getAllAssets() {
  return Object.values(state.assets.byId);
}

function removeAsset(assetId) {
  const asset = getAsset(assetId);
  if (!asset) return false;

  const usedBy = getAllProps().filter((prop) => prop.assetId === assetId);

  if (usedBy.length > 0) {
    const ok = window.confirm(
      `This picture is being used on the screen. Deleting it will also remove ${usedBy.length} placed thing${usedBy.length === 1 ? '' : 's'}. Delete anyway?`
    );

    if (!ok) return false;
  }

  usedBy.forEach((prop) => removeProp(prop.id));
  delete state.assets.byId[assetId];
  if (assetImageCache[assetId]) {
    assetImageCache[assetId].src = '';
  }
  delete assetImageCache[assetId];
  revokeObjectUrl(asset.imageSrc);

  if (state.selection.assetId === assetId) {
    state.selection.assetId = null;
  }

  saveToLocalStorage();
  return true;
}

// ------------------------------------------------------------
// Prop helpers
// ------------------------------------------------------------
function addProp(propData) {
  const prop = createPlacedProp(propData);
  state.props.byId[prop.id] = prop;
  state.props.order.push(prop.id);
  ensurePreviewStatesMatchProps();
  saveToLocalStorage();
  return prop;
}

function updateProp(propId, patch) {
  const existing = state.props.byId[propId];
  if (!existing) return null;
  state.props.byId[propId] = { ...existing, ...patch };
  ensurePreviewStatesMatchProps();
  saveToLocalStorage();
  return state.props.byId[propId];
}

function removeProp(propId) {
  if (!state.props.byId[propId]) return false;
  delete state.props.byId[propId];
  state.props.order = state.props.order.filter((id) => id !== propId);
  delete previewState.props[propId];
  if (state.selection.propId === propId) {
    state.selection.propId = null;
  }
  saveToLocalStorage();
  return true;
}

function duplicateProp(propId) {
  const existing = state.props.byId[propId];
  if (!existing) return null;

  const snapped = snapPoint(existing.x + state.grid.size, existing.y + state.grid.size);

  const copy = createPlacedProp({
    ...existing,
    id: undefined,
    x: snapped.x,
    y: snapped.y
  });

  state.props.byId[copy.id] = copy;
  state.props.order.push(copy.id);
  ensurePreviewStatesMatchProps();
  saveToLocalStorage();
  return copy;
}

function getProp(propId) {
  return state.props.byId[propId] || null;
}

function getAllProps() {
  return state.props.order.map((id) => state.props.byId[id]).filter(Boolean);
}

// ------------------------------------------------------------
// Selection helpers
// ------------------------------------------------------------
function selectAsset(assetId) {
  state.selection.assetId = getAsset(assetId) ? assetId : null;
  saveToLocalStorage();
}

function selectProp(propId) {
  state.selection.propId = getProp(propId) ? propId : null;
  saveToLocalStorage();
}

function clearSelection() {
  state.selection.assetId = null;
  state.selection.propId = null;
  saveToLocalStorage();
}

// ------------------------------------------------------------
// World / background helpers
// ------------------------------------------------------------
function setBackground({
  imageSrc = '',
  fileName = '',
  naturalWidth = 0,
  naturalHeight = 0
} = {}) {
  state.background = { imageSrc, fileName, naturalWidth, naturalHeight };
  saveToLocalStorage();
}

function setWorldSize(width, height) {
  state.world.width = Number(width) || DEFAULTS.worldWidth;
  state.world.height = Number(height) || DEFAULTS.worldHeight;
  saveToLocalStorage();
}

// ------------------------------------------------------------
// Preview runtime helpers
// ------------------------------------------------------------
function makePreviewPropState(prop) {
  return {
    frame: 0,
    loopAccumulatorMs: 0,
    flickerAccumulatorMs: 0,
    nextFlickerMs: randomBetween(
      Math.max(10, prop.minDelay || 120),
      Math.max(10, prop.maxDelay || 300)
    )
  };
}

function getPreviewPropState(propId) {
  if (!previewState.props[propId]) {
    const prop = getProp(propId);
    if (!prop) return null;
    previewState.props[propId] = makePreviewPropState(prop);
  }
  return previewState.props[propId];
}

function ensurePreviewStatesMatchProps() {
  const validIds = new Set(getAllProps().map((prop) => prop.id));
  getAllProps().forEach((prop) => {
    if (!previewState.props[prop.id]) {
      previewState.props[prop.id] = makePreviewPropState(prop);
    }
  });

  Object.keys(previewState.props).forEach((propId) => {
    if (!validIds.has(propId)) {
      delete previewState.props[propId];
    }
  });
}

function resetPreviewState() {
  previewState.lastTickTime = 0;
  previewState.beatAccumulatorMs = 0;
  previewState.beatCount = 0;
  previewState.props = {};
  ensurePreviewStatesMatchProps();
  renderEditor();
  updatePreviewUi();
}

function setPreviewBpm(value) {
  previewState.bpm = clamp(Number(value) || 120, 30, 300);
  saveToLocalStorage();
  updatePreviewUi();
}

function getBeatLengthMs() {
  return 60000 / Math.max(1, previewState.bpm);
}

function getPreviewFrameForProp(prop) {
  const asset = getAsset(prop.assetId);
  if (!asset) return 0;

  const frameCount = Math.max(1, asset.frameCount || 1);
  if (frameCount <= 1) return 0;

  const runtime = getPreviewPropState(prop.id);
  if (!runtime) return 0;

  return clamp(runtime.frame, 0, frameCount - 1);
}

function tickLoopProp(prop, deltaMs) {
  const asset = getAsset(prop.assetId);
  if (!asset || asset.frameCount <= 1) return;
  const runtime = getPreviewPropState(prop.id);
  if (!runtime) return;

  const fps = Math.max(1, Number(prop.fps) || 6);
  const frameDurationMs = 1000 / fps;

  runtime.loopAccumulatorMs += deltaMs;

  while (runtime.loopAccumulatorMs >= frameDurationMs) {
    runtime.loopAccumulatorMs -= frameDurationMs;
    runtime.frame = (runtime.frame + 1) % asset.frameCount;
  }
}

function tickBeatPropsIfNeeded() {
  const props = getAllProps();

  props.forEach((prop) => {
    if (prop.mode !== 'beat') return;

    const asset = getAsset(prop.assetId);
    if (!asset || asset.frameCount <= 1) return;

    const runtime = getPreviewPropState(prop.id);
    if (!runtime) return;

    const beatDiv = Math.max(1, Number(prop.beatDiv) || 1);
    if (previewState.beatCount % beatDiv === 0) {
      runtime.frame = (runtime.frame + 1) % asset.frameCount;
    }
  });
}

function tickFlickerProp(prop, deltaMs) {
  const asset = getAsset(prop.assetId);
  if (!asset || asset.frameCount <= 1) return;

  const runtime = getPreviewPropState(prop.id);
  if (!runtime) return;

  const minDelay = Math.max(10, Number(prop.minDelay) || 120);
  const maxDelay = Math.max(10, Number(prop.maxDelay) || 300);

  runtime.flickerAccumulatorMs += deltaMs;

  while (runtime.flickerAccumulatorMs >= runtime.nextFlickerMs) {
    runtime.flickerAccumulatorMs -= runtime.nextFlickerMs;
    runtime.frame = (runtime.frame + 1) % asset.frameCount;
    runtime.nextFlickerMs = randomBetween(minDelay, maxDelay);
  }
}

function tickPreview(deltaMs) {
  ensurePreviewStatesMatchProps();

  previewState.beatAccumulatorMs += deltaMs;
  const beatLengthMs = getBeatLengthMs();

  while (previewState.beatAccumulatorMs >= beatLengthMs) {
    previewState.beatAccumulatorMs -= beatLengthMs;
    previewState.beatCount += 1;
    tickBeatPropsIfNeeded();
  }

  getAllProps().forEach((prop) => {
    if (prop.mode === 'loop') {
      tickLoopProp(prop, deltaMs);
    } else if (prop.mode === 'randomFlicker') {
      tickFlickerProp(prop, deltaMs);
    }
  });
}

function previewLoop(timestamp) {
  if (!previewState.playing) {
    previewState.animationFrameId = null;
    return;
  }

  if (!previewState.lastTickTime) {
    previewState.lastTickTime = timestamp;
  }

  const deltaMs = timestamp - previewState.lastTickTime;
  previewState.lastTickTime = timestamp;

  tickPreview(deltaMs);
  renderEditor();

  previewState.animationFrameId = requestAnimationFrame(previewLoop);
}

function startPreview() {
  if (previewState.playing) return;
  previewState.playing = true;
  previewState.lastTickTime = 0;
  updatePreviewUi();

  if (!previewState.animationFrameId) {
    previewState.animationFrameId = requestAnimationFrame(previewLoop);
  }
}

function pausePreview() {
  previewState.playing = false;

  if (previewState.animationFrameId) {
    cancelAnimationFrame(previewState.animationFrameId);
    previewState.animationFrameId = null;
  }

  previewState.lastTickTime = 0;
  updatePreviewUi();
}

function updatePreviewUi() {
  dom.previewBpmInput.value = String(previewState.bpm);
  dom.playPreviewButton.disabled = previewState.playing;
  dom.pausePreviewButton.disabled = !previewState.playing;
  dom.previewStatusText.textContent = previewState.playing
    ? `Preview is playing at ${previewState.bpm} BPM.`
    : 'Preview is paused.';
}

// ------------------------------------------------------------
// Canvas sizing and mapping
// ------------------------------------------------------------
function fitCanvasToBackground() {
  if (state.background.naturalWidth > 0 && state.background.naturalHeight > 0) {
    dom.editorCanvas.width = state.background.naturalWidth;
    dom.editorCanvas.height = state.background.naturalHeight;
  } else {
    dom.editorCanvas.width = 1200;
    dom.editorCanvas.height = 720;
  }
}

function resetEditorView() {
  uiState.view.zoom = 1;
  uiState.view.panX = 0;
  uiState.view.panY = 0;
  renderEditor();
}

function getCanvasPointerPosition(event) {
  const rect = dom.editorCanvas.getBoundingClientRect();
  const scaleX = dom.editorCanvas.width / rect.width;
  const scaleY = dom.editorCanvas.height / rect.height;

  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  return { canvasX, canvasY };
}

function canvasToWorld(canvasX, canvasY) {
  const stageX = (canvasX - uiState.view.panX) / uiState.view.zoom;
  const stageY = (canvasY - uiState.view.panY) / uiState.view.zoom;

  return {
    worldX: Math.round((stageX / dom.editorCanvas.width) * state.world.width),
    worldY: Math.round((stageY / dom.editorCanvas.height) * state.world.height)
  };
}

function worldToCanvas(worldX, worldY) {
  const stageX = (worldX / state.world.width) * dom.editorCanvas.width;
  const stageY = (worldY / state.world.height) * dom.editorCanvas.height;

  return {
    canvasX: stageX * uiState.view.zoom + uiState.view.panX,
    canvasY: stageY * uiState.view.zoom + uiState.view.panY
  };
}

function getAssetDrawMetrics(asset, prop) {
  if (!asset) return null;

  const scaleToCanvasX = (dom.editorCanvas.width / state.world.width) * uiState.view.zoom;
  const scaleToCanvasY = (dom.editorCanvas.height / state.world.height) * uiState.view.zoom;

  const drawWidth = asset.frameWidth * prop.scale * scaleToCanvasX;
  const drawHeight = asset.frameHeight * prop.scale * scaleToCanvasY;

  const { canvasX, canvasY } = worldToCanvas(prop.x, prop.y);

  const drawX = canvasX - drawWidth * prop.originX;
  const drawY = canvasY - drawHeight * prop.originY;

  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    canvasX,
    canvasY
  };
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------
function drawCheckerBackground() {
  const size = 32;
  for (let y = 0; y < dom.editorCanvas.height; y += size) {
    for (let x = 0; x < dom.editorCanvas.width; x += size) {
      const even = ((x / size) + (y / size)) % 2 === 0;
      ctx.fillStyle = even ? '#1c1c1c' : '#242424';
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawBackgroundImage() {
  if (!uiState.backgroundImage) return;
  ctx.drawImage(
    uiState.backgroundImage,
    uiState.view.panX,
    uiState.view.panY,
    dom.editorCanvas.width * uiState.view.zoom,
    dom.editorCanvas.height * uiState.view.zoom
  );
}

function drawGridOverlay() {
  if (!state.grid.enabled) return;

  const gridSize = Math.max(1, state.grid.size);
  const stepX = (gridSize / state.world.width) * dom.editorCanvas.width * uiState.view.zoom;
  const stepY = (gridSize / state.world.height) * dom.editorCanvas.height * uiState.view.zoom;
  const startX = uiState.view.panX + Math.ceil((0 - uiState.view.panX) / stepX) * stepX;
  const startY = uiState.view.panY + Math.ceil((0 - uiState.view.panY) / stepY) * stepY;

  ctx.save();
  ctx.strokeStyle = 'rgba(121, 199, 255, 0.12)';
  ctx.lineWidth = 1;

  for (let x = startX; x <= dom.editorCanvas.width; x += stepX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dom.editorCanvas.height);
    ctx.stroke();
  }

  for (let y = startY; y <= dom.editorCanvas.height; y += stepY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dom.editorCanvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function getCachedAssetImage(asset) {
  if (!asset || !asset.imageSrc) return null;
  if (!assetImageCache[asset.id]) {
    const img = new Image();
    img.src = asset.imageSrc;
    assetImageCache[asset.id] = img;
  }
  return assetImageCache[asset.id];
}

function drawPlacedProps() {
  getAllProps().forEach((prop) => {
    const asset = getAsset(prop.assetId);
    if (!asset || !asset.imageSrc) return;

    const image = getCachedAssetImage(asset);
    if (!image || !image.complete) return;

    const metrics = getAssetDrawMetrics(asset, prop);
    if (!metrics) return;

    const frameIndex = getPreviewFrameForProp(prop);
    const sourceX = frameIndex * asset.frameWidth;
    const sourceY = 0;

    ctx.save();

    if (prop.flipX) {
      ctx.translate(metrics.drawX + metrics.drawWidth / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        asset.frameWidth,
        asset.frameHeight,
        -(metrics.drawWidth / 2),
        metrics.drawY,
        metrics.drawWidth,
        metrics.drawHeight
      );
    } else {
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        asset.frameWidth,
        asset.frameHeight,
        metrics.drawX,
        metrics.drawY,
        metrics.drawWidth,
        metrics.drawHeight
      );
    }

    ctx.restore();
  });
}

function drawSelectedPropOutline() {
  const prop = getProp(state.selection.propId);
  if (!prop) return;

  const asset = getAsset(prop.assetId);
  if (!asset) return;

  const metrics = getAssetDrawMetrics(asset, prop);
  if (!metrics) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(121, 199, 255, 1)';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    Math.round(metrics.drawX) - 2,
    Math.round(metrics.drawY) - 2,
    Math.round(metrics.drawWidth) + 4,
    Math.round(metrics.drawHeight) + 4
  );

  ctx.fillStyle = 'rgba(121, 199, 255, 1)';
  ctx.beginPath();
  ctx.arc(metrics.canvasX, metrics.canvasY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCursorCrosshair() {
  if (uiState.cursorWorldX == null || uiState.cursorWorldY == null) return;

  const { canvasX, canvasY } = worldToCanvas(uiState.cursorWorldX, uiState.cursorWorldY);

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasX - 8, canvasY);
  ctx.lineTo(canvasX + 8, canvasY);
  ctx.moveTo(canvasX, canvasY - 8);
  ctx.lineTo(canvasX, canvasY + 8);
  ctx.stroke();
  ctx.restore();
}

function drawLastClickMarker() {
  if (uiState.lastClickWorldX == null || uiState.lastClickWorldY == null) return;

  const { canvasX, canvasY } = worldToCanvas(uiState.lastClickWorldX, uiState.lastClickWorldY);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 0, 0.95)';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvasX - 6, canvasY - 6, 12, 12);
  ctx.restore();
}

function renderEditor() {
  ctx.clearRect(0, 0, dom.editorCanvas.width, dom.editorCanvas.height);
  drawCheckerBackground();
  drawBackgroundImage();
  drawGridOverlay();
  drawPlacedProps();
  drawSelectedPropOutline();
  drawLastClickMarker();
  drawCursorCrosshair();
  updateReadouts();
}

function updateReadouts() {
  dom.canvasSizeReadout.textContent = `${dom.editorCanvas.width} x ${dom.editorCanvas.height}`;
  dom.worldSizeReadout.textContent = `${state.world.width} x ${state.world.height}`;
  dom.cursorWorldReadout.textContent =
    uiState.cursorWorldX == null ? '-' : `${uiState.cursorWorldX}, ${uiState.cursorWorldY}`;
  dom.lastClickReadout.textContent =
    uiState.lastClickWorldX == null ? '-' : `${uiState.lastClickWorldX}, ${uiState.lastClickWorldY}`;
}

// ------------------------------------------------------------
// Draft picture preview
// ------------------------------------------------------------
function drawPreviewBackground(ctxRef, width, height) {
  const size = 16;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const even = ((x / size) + (y / size)) % 2 === 0;
      ctxRef.fillStyle = even ? '#171717' : '#202020';
      ctxRef.fillRect(x, y, size, size);
    }
  }
}

function renderAssetPreview() {
  const canvas = dom.assetPreviewCanvas;
  assetPreviewCtx.clearRect(0, 0, canvas.width, canvas.height);
  drawPreviewBackground(assetPreviewCtx, canvas.width, canvas.height);

  if (!assetUploadDraft.image) {
    assetPreviewCtx.fillStyle = '#9a9a9a';
    assetPreviewCtx.font = '14px Arial';
    assetPreviewCtx.fillText('Your uploaded picture will show here', 14, 56);
    return;
  }

  const frameWidth = Math.max(1, Number(dom.frameWidthInput.value) || 1);
  const frameHeight = Math.max(1, Number(dom.frameHeightInput.value) || 1);
  const frameCount = Math.max(1, Number(dom.frameCountInput.value) || 1);

  const sourceWidth = Math.min(assetUploadDraft.image.naturalWidth, frameWidth * frameCount);
  const sourceHeight = Math.min(assetUploadDraft.image.naturalHeight, frameHeight);

  const scale = Math.min(
    (canvas.width - 20) / sourceWidth,
    (canvas.height - 20) / sourceHeight
  );

  const drawWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.floor(sourceHeight * scale));
  const drawX = Math.floor((canvas.width - drawWidth) / 2);
  const drawY = Math.floor((canvas.height - drawHeight) / 2);

  assetPreviewCtx.imageSmoothingEnabled = false;
  assetPreviewCtx.drawImage(
    assetUploadDraft.image,
    0,
    0,
    sourceWidth,
    sourceHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );

  if (frameCount > 1) {
    assetPreviewCtx.save();
    assetPreviewCtx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
    assetPreviewCtx.lineWidth = 1;

    for (let i = 1; i < frameCount; i += 1) {
      const lineX = drawX + Math.floor((i / frameCount) * drawWidth);
      assetPreviewCtx.beginPath();
      assetPreviewCtx.moveTo(lineX, drawY);
      assetPreviewCtx.lineTo(lineX, drawY + drawHeight);
      assetPreviewCtx.stroke();
    }

    assetPreviewCtx.restore();
  }
}

function resetAssetDraft(keepFileInput = false, revokeDraftUrl = true) {
  if (revokeDraftUrl) {
    revokeObjectUrl(assetUploadDraft.imageSrc);
  }

  assetUploadDraft.file = null;
  assetUploadDraft.imageSrc = '';
  assetUploadDraft.image = null;

  if (!keepFileInput) {
    dom.propImageUpload.value = '';
  }

  dom.propNameInput.value = '';
  dom.frameWidthInput.value = 64;
  dom.frameHeightInput.value = 64;
  dom.frameCountInput.value = 1;
  dom.uploadStatusText.textContent = 'No picture uploaded yet. Upload one to get started.';
  renderAssetPreview();
}

function loadDraftImageFromFile(file) {
  if (!file) return;

  revokeObjectUrl(assetUploadDraft.imageSrc);

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  assetUploadDraft.file = null;
  assetUploadDraft.imageSrc = objectUrl;
  assetUploadDraft.image = null;

  image.onload = () => {
    if (assetUploadDraft.imageSrc !== objectUrl) return;

    assetUploadDraft.file = file;
    assetUploadDraft.imageSrc = objectUrl;
    assetUploadDraft.image = image;

    const suggestedName = file.name.replace(/\.[^/.]+$/, '');
    if (!dom.propNameInput.value.trim()) {
      dom.propNameInput.value = suggestedName;
    }

    dom.uploadStatusText.textContent = `Loaded: ${file.name} (${image.naturalWidth} x ${image.naturalHeight})`;
    renderAssetPreview();
  };

  image.onerror = () => {
    revokeObjectUrl(objectUrl);
    if (assetUploadDraft.imageSrc === objectUrl) {
      assetUploadDraft.file = null;
      assetUploadDraft.imageSrc = '';
      assetUploadDraft.image = null;
      dom.uploadStatusText.textContent = 'Could not load that picture.';
      renderAssetPreview();
    }
  };

  image.src = objectUrl;
}

async function saveDraftAsAsset() {
  if (!assetUploadDraft.image || !assetUploadDraft.imageSrc) {
    dom.uploadStatusText.textContent = 'Upload a picture first.';
    return;
  }

  const name = dom.propNameInput.value.trim() || 'New Picture';
  const frameWidth = Math.max(1, Number(dom.frameWidthInput.value) || 1);
  const frameHeight = Math.max(1, Number(dom.frameHeightInput.value) || 1);
  const frameCount = Math.max(1, Number(dom.frameCountInput.value) || 1);

  let baseId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!baseId) baseId = makeAssetId('asset');

  let finalId = baseId;
  let suffix = 2;

  while (getAsset(finalId)) {
    finalId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  const draftImageSrc = assetUploadDraft.imageSrc;
  let savedImageSrc = draftImageSrc;

  if (assetUploadDraft.file && isObjectUrl(draftImageSrc)) {
    try {
      savedImageSrc = await fileToDataUrl(assetUploadDraft.file);
    } catch (error) {
      dom.uploadStatusText.textContent = 'Could not save that picture.';
      return;
    }

    if (assetUploadDraft.imageSrc !== draftImageSrc) {
      revokeObjectUrl(draftImageSrc);
      return;
    }
  }

  const asset = addAsset({
    id: finalId,
    name,
    imageSrc: savedImageSrc,
    fileName: assetUploadDraft.file?.name || '',
    frameWidth,
    frameHeight,
    frameCount
  });

  selectAsset(asset.id);
  dom.uploadStatusText.textContent = `Saved: ${asset.name}`;
  renderAssetList();
  resetAssetDraft();
  refreshAllUi();
}

// ------------------------------------------------------------
// Asset / prop display names
// ------------------------------------------------------------
function getPropDisplayName(prop) {
  if (!prop) return 'Unknown';
  if (prop.label && prop.label.trim()) return prop.label.trim();
  const asset = getAsset(prop.assetId);
  if (asset?.name) return asset.name;
  return prop.assetId || prop.id;
}

// ------------------------------------------------------------
// Asset list UI
// ------------------------------------------------------------
function makeAssetCard(asset) {
  const card = document.createElement('div');
  card.className = 'asset-card';
  if (state.selection.assetId === asset.id) {
    card.classList.add('selected');
  }

  const title = document.createElement('div');
  title.className = 'asset-card-title';
  title.textContent = asset.name || asset.id;

  const meta = document.createElement('div');
  meta.className = 'asset-card-meta';
  meta.innerHTML = `
    Key: ${asset.id}<br>
    Size: ${asset.frameWidth} x ${asset.frameHeight}<br>
    Images: ${asset.frameCount}
  `;

  const actions = document.createElement('div');
  actions.className = 'asset-card-actions';

  const chooseButton = document.createElement('button');
  chooseButton.type = 'button';
  chooseButton.textContent = state.selection.assetId === asset.id ? 'Chosen' : 'Choose this picture';
  chooseButton.addEventListener('click', () => {
    selectAsset(asset.id);
    refreshAllUi();
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => {
    removeAsset(asset.id);
    refreshAllUi();
  });

  actions.appendChild(chooseButton);
  actions.appendChild(deleteButton);

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

function renderAssetList() {
  dom.assetList.innerHTML = '';

  const assets = getAllAssets();

  if (assets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'helper-text';
    empty.textContent = 'No saved pictures yet. Upload one, save it, then choose it.';
    dom.assetList.appendChild(empty);
    return;
  }

  assets.forEach((asset) => {
    dom.assetList.appendChild(makeAssetCard(asset));
  });
}

// ------------------------------------------------------------
// Placed prop list UI
// ------------------------------------------------------------
function makePlacedPropCard(prop) {
  const card = document.createElement('div');
  card.className = 'placed-card';
  card.dataset.propId = prop.id;

  if (state.selection.propId === prop.id) {
    card.classList.add('selected');
  }

  card.addEventListener('click', () => {
    selectProp(prop.id);
    refreshAllUi();
    scrollSelectedPropCardIntoView();
  });

  const title = document.createElement('div');
  title.className = 'placed-title';
  title.textContent = getPropDisplayName(prop);

  const meta = document.createElement('div');
  meta.className = 'placed-meta';
  meta.textContent = `x: ${prop.x}, y: ${prop.y}`;

  const actions = document.createElement('div');
  actions.className = 'placed-actions';

  const selectBtn = document.createElement('button');
  selectBtn.textContent = 'Select';
  selectBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    selectProp(prop.id);
    refreshAllUi();
    scrollSelectedPropCardIntoView();
  });

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const copied = duplicateProp(prop.id);
    if (copied) {
      selectProp(copied.id);
      refreshAllUi();
      scrollSelectedPropCardIntoView();
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    removeProp(prop.id);
    refreshAllUi();
  });

  actions.appendChild(selectBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

function renderPlacedPropList() {
  dom.placedPropList.innerHTML = '';

  const props = getAllProps();

  if (props.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'helper-text';
    empty.textContent = 'Nothing on screen yet. Choose a picture, then click the stage.';
    dom.placedPropList.appendChild(empty);
    return;
  }

  props.forEach((prop) => {
    dom.placedPropList.appendChild(makePlacedPropCard(prop));
  });
}

function scrollSelectedPropCardIntoView() {
  if (!state.selection.propId) return;
  const card = dom.placedPropList.querySelector(`[data-prop-id="${state.selection.propId}"]`);
  if (card) {
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ------------------------------------------------------------
// Behaviour panel
// ------------------------------------------------------------
function hideAllBehaviourBoxes() {
  dom.loopSettings.hidden = true;
  dom.beatSettings.hidden = true;
  dom.flickerSettings.hidden = true;
}

function showBehaviourBoxForMode(mode) {
  hideAllBehaviourBoxes();

  if (mode === 'loop') {
    dom.loopSettings.hidden = false;
  } else if (mode === 'beat') {
    dom.beatSettings.hidden = false;
  } else if (mode === 'randomFlicker') {
    dom.flickerSettings.hidden = false;
  }
}

function getSelectedPlacedProp() {
  return getProp(state.selection.propId);
}

function updateSelectedPropPanel() {
  const prop = getSelectedPlacedProp();
  const hasSelection = !!prop;

  if (!hasSelection) {
    dom.selectedPropStatus.textContent = 'No thing selected yet. Click something on the stage or in the list.';
    dom.selectedPropNameInput.value = '';
  } else {
    dom.selectedPropStatus.textContent = `You are editing: ${getPropDisplayName(prop)}`;
    dom.selectedPropNameInput.value = prop.label || '';
  }

  [
    dom.selectedPropNameInput,
    dom.moveUpButton,
    dom.moveLeftButton,
    dom.moveRightButton,
    dom.moveDownButton,
    dom.makeBiggerButton,
    dom.makeSmallerButton,
    dom.flipPropButton,
    dom.copyPropButton,
    dom.deletePropButton,
    dom.propBehaviourSelect,
    dom.loopSpeedSelect,
    dom.beatDivSelect,
    dom.flickerMinInput,
    dom.flickerMaxInput
  ].forEach((el) => {
    el.disabled = !hasSelection;
  });
}

function updateBehaviourPanel() {
  const prop = getSelectedPlacedProp();
  const hasSelection = !!prop;

  if (!hasSelection) {
    dom.propBehaviourSelect.value = 'static';
    dom.loopSpeedSelect.value = '6';
    dom.beatDivSelect.value = '1';
    dom.flickerMinInput.value = '120';
    dom.flickerMaxInput.value = '300';
    hideAllBehaviourBoxes();
    return;
  }

  dom.propBehaviourSelect.value = prop.mode || 'static';
  dom.loopSpeedSelect.value = String(prop.fps ?? 6);
  dom.beatDivSelect.value = String(prop.beatDiv ?? 1);
  dom.flickerMinInput.value = String(prop.minDelay ?? 120);
  dom.flickerMaxInput.value = String(prop.maxDelay ?? 300);

  showBehaviourBoxForMode(prop.mode || 'static');
}

function setSelectedPropBehaviour(mode) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

  const beforeSnapshot = clonePropsState();
  const patch = { mode };

  if (mode === 'loop' && !prop.fps) patch.fps = 6;
  if (mode === 'beat' && !prop.beatDiv) patch.beatDiv = 1;
  if (mode === 'randomFlicker') {
    if (!prop.minDelay) patch.minDelay = 120;
    if (!prop.maxDelay) patch.maxDelay = 300;
  }

  updateProp(prop.id, patch);
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function setSelectedPropLoopSpeed(fps) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  updateProp(prop.id, { fps: Math.max(1, Number(fps) || 6) });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function setSelectedPropBeatDiv(value) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  updateProp(prop.id, { beatDiv: Math.max(1, Number(value) || 1) });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function setSelectedPropFlickerRange(minDelay, maxDelay) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

  const beforeSnapshot = clonePropsState();
  let safeMin = Math.max(10, Number(minDelay) || 120);
  let safeMax = Math.max(10, Number(maxDelay) || 300);

  if (safeMin > safeMax) {
    const temp = safeMin;
    safeMin = safeMax;
    safeMax = temp;
  }

  updateProp(prop.id, {
    minDelay: safeMin,
    maxDelay: safeMax
  });

  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

// ------------------------------------------------------------
// Editor actions
// ------------------------------------------------------------
function getMoveAmount() {
  return Math.max(1, Number(dom.moveAmountSelect.value) || 8);
}

function placeSelectedAssetAtWorld(worldX, worldY) {
  const selectedAssetId = state.selection.assetId;
  if (!selectedAssetId) return null;

  const asset = getAsset(selectedAssetId);
  if (!asset) return null;

  const snapped = snapPoint(worldX, worldY);
  const beforeSnapshot = clonePropsState();

  const placed = addProp({
    assetId: asset.id,
    x: snapped.x,
    y: snapped.y,
    scale: 1,
    depth: 50,
    originX: 0.5,
    originY: 1,
    flipX: false,
    mode: 'static',
    label: ''
  });

  selectProp(placed.id);
  rememberPropsBeforeChange(beforeSnapshot);
  return placed;
}

function moveSelectedProp(dx, dy) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

  const beforeSnapshot = clonePropsState();
  let nextX = prop.x + dx;
  let nextY = prop.y + dy;

  if (state.grid.enabled) {
    const snapped = snapPoint(nextX, nextY);
    nextX = snapped.x;
    nextY = snapped.y;
  }

  nextX = clamp(nextX, 0, state.world.width);
  nextY = clamp(nextY, 0, state.world.height);

  updateProp(prop.id, { x: nextX, y: nextY });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function resizeSelectedProp(scaleDelta) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

  const beforeSnapshot = clonePropsState();
  const nextScale = clamp(Number((prop.scale + scaleDelta).toFixed(2)), 0.25, 4);
  updateProp(prop.id, { scale: nextScale });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function flipSelectedProp() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  updateProp(prop.id, { flipX: !prop.flipX });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function copySelectedPropAction() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  const copy = duplicateProp(prop.id);
  if (!copy) return;
  selectProp(copy.id);
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
  scrollSelectedPropCardIntoView();
}

function deleteSelectedPropAction() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  removeProp(prop.id);
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

function renameSelectedProp(value) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const beforeSnapshot = clonePropsState();
  updateProp(prop.id, { label: value });
  rememberPropsBeforeChange(beforeSnapshot);
  refreshAllUi();
}

// ------------------------------------------------------------
// Hit testing
// ------------------------------------------------------------
function findTopmostPropAtCanvasPoint(canvasX, canvasY) {
  const ordered = [...getAllProps()];
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const prop = ordered[i];
    const asset = getAsset(prop.assetId);
    if (!asset) continue;

    const metrics = getAssetDrawMetrics(asset, prop);
    if (!metrics) continue;

    const inside =
      canvasX >= metrics.drawX &&
      canvasX <= metrics.drawX + metrics.drawWidth &&
      canvasY >= metrics.drawY &&
      canvasY <= metrics.drawY + metrics.drawHeight;

    if (inside) return prop;
  }
  return null;
}

// ------------------------------------------------------------
// Export helpers
// ------------------------------------------------------------
function exportAsJson() {
  return buildExportJson({
    world: state.world,
    assets: getAllAssets(),
    props: getAllProps()
  });
}

function exportAsJsModule() {
  return buildExportJsModule({
    assets: getAllAssets(),
    props: getAllProps()
  });
}

function refreshExportPanel() {
  dom.exportPreviewText.value = exportAsJson();
}

function downloadTextFile(filename, text, mimeType = 'application/json') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function downloadExportForGame() {
  const filename = `stage-props-${timestampString()}.json`;
  downloadTextFile(filename, exportAsJson(), 'application/json');
  dom.exportStatusText.textContent = `Downloaded ${filename}`;
}

async function copyExportForGame() {
  const text = exportAsJsModule();

  try {
    await navigator.clipboard.writeText(text);
    dom.exportStatusText.textContent = 'Game code copied.';
  } catch (error) {
    dom.exportStatusText.textContent = 'Could not copy automatically. Copy it from the box below.';
    dom.exportPreviewText.value = text;
    dom.exportPreviewText.focus();
    dom.exportPreviewText.select();
  }
}

// ------------------------------------------------------------
// UI refresh
// ------------------------------------------------------------
function refreshAllUi() {
  renderAssetList();
  renderPlacedPropList();
  updateSelectedPropPanel();
  updateBehaviourPanel();
  updatePreviewUi();
  refreshExportPanel();
  renderEditor();
}

// ------------------------------------------------------------
// Background loading
// ------------------------------------------------------------
function loadBackgroundFromFile(file) {
  if (!file) return;

  revokeObjectUrl(uiState.pendingBackgroundUrl);

  const previousBackgroundSrc = state.background.imageSrc;
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  uiState.pendingBackgroundUrl = objectUrl;

  image.onload = async () => {
    if (uiState.pendingBackgroundUrl !== objectUrl) return;

    let savedImageSrc = objectUrl;

    try {
      savedImageSrc = await fileToDataUrl(file);
    } catch (error) {
      revokeObjectUrl(objectUrl);
      if (uiState.pendingBackgroundUrl === objectUrl) {
        uiState.pendingBackgroundUrl = '';
      }
      return;
    }

    if (uiState.pendingBackgroundUrl !== objectUrl) {
      revokeObjectUrl(objectUrl);
      return;
    }

    uiState.pendingBackgroundUrl = '';
    uiState.backgroundImage = image;
    setBackground({
      imageSrc: savedImageSrc,
      fileName: file.name,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    });

    if (previousBackgroundSrc !== objectUrl) {
      revokeObjectUrl(previousBackgroundSrc);
    }
    revokeObjectUrl(objectUrl);

    fitCanvasToBackground();
    renderEditor();
  };

  image.onerror = () => {
    revokeObjectUrl(objectUrl);
    if (uiState.pendingBackgroundUrl === objectUrl) {
      uiState.pendingBackgroundUrl = '';
    }
  };

  image.src = objectUrl;
}

function getDroppedImageFile(event) {
  const files = Array.from(event.dataTransfer?.files || []);
  return files.find((file) => file.type.startsWith('image/')) || null;
}

function hasDraggedFile(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function bindImageDropTarget(dropTarget, onImageFile) {
  if (!dropTarget) return;

  dropTarget.addEventListener('dragover', (event) => {
    if (!hasDraggedFile(event)) return;
    event.preventDefault();
    dropTarget.classList.add('drag-over');
  });

  dropTarget.addEventListener('dragleave', (event) => {
    if (dropTarget.contains(event.relatedTarget)) return;
    dropTarget.classList.remove('drag-over');
  });

  dropTarget.addEventListener('drop', (event) => {
    const file = getDroppedImageFile(event);
    if (!file) return;

    event.preventDefault();
    dropTarget.classList.remove('drag-over');
    onImageFile(file);
  });
}

function updateEditorCursor() {
  dom.editorCanvas.classList.toggle('can-pan', uiState.view.spacePanning);
  dom.editorCanvas.classList.toggle('is-panning', uiState.view.isPanning);
}

// ------------------------------------------------------------
// Canvas interactions
// ------------------------------------------------------------
function handleEditorCanvasWheel(event) {
  event.preventDefault();

  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  const oldZoom = uiState.view.zoom;
  const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = clamp(oldZoom * zoomFactor, 0.25, 4);

  if (newZoom === oldZoom) return;

  const stageX = (canvasX - uiState.view.panX) / oldZoom;
  const stageY = (canvasY - uiState.view.panY) / oldZoom;

  uiState.view.zoom = newZoom;
  uiState.view.panX = canvasX - stageX * newZoom;
  uiState.view.panY = canvasY - stageY * newZoom;
  renderEditor();
}

function startEditorPan(event) {
  const middleMouse = event.button === 1;
  const spaceDrag = event.button === 0 && uiState.view.spacePanning;

  if (!middleMouse && !spaceDrag) return;

  event.preventDefault();

  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  uiState.view.isPanning = true;
  uiState.view.didPan = true;
  uiState.view.panStartX = canvasX;
  uiState.view.panStartY = canvasY;
  uiState.view.panStartViewX = uiState.view.panX;
  uiState.view.panStartViewY = uiState.view.panY;
  updateEditorCursor();
}

function updateEditorPan(event) {
  if (!uiState.view.isPanning) return false;

  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  const deltaX = canvasX - uiState.view.panStartX;
  const deltaY = canvasY - uiState.view.panStartY;

  uiState.view.panX = uiState.view.panStartViewX + deltaX;
  uiState.view.panY = uiState.view.panStartViewY + deltaY;

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    uiState.view.didPan = true;
  }

  renderEditor();
  return true;
}

function stopEditorPan() {
  if (!uiState.view.isPanning) return;
  uiState.view.isPanning = false;
  updateEditorCursor();
}

function handleEditorCanvasMove(event) {
  if (updateEditorPan(event)) {
    event.stopPropagation();
    return;
  }

  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  const { worldX, worldY } = canvasToWorld(canvasX, canvasY);

  uiState.cursorWorldX = worldX;
  uiState.cursorWorldY = worldY;
  renderEditor();
}

function handleEditorWindowMove(event) {
  updateEditorPan(event);
}

function handleEditorCanvasLeave() {
  uiState.cursorWorldX = null;
  uiState.cursorWorldY = null;
  renderEditor();
}

function handleEditorCanvasClick(event) {
  if (uiState.view.didPan) {
    uiState.view.didPan = false;
    return;
  }

  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  let { worldX, worldY } = canvasToWorld(canvasX, canvasY);

  if (state.grid.enabled) {
    const snapped = snapPoint(worldX, worldY);
    worldX = snapped.x;
    worldY = snapped.y;
  }

  uiState.lastClickWorldX = worldX;
  uiState.lastClickWorldY = worldY;

  const clickedProp = findTopmostPropAtCanvasPoint(canvasX, canvasY);

  if (clickedProp) {
    selectProp(clickedProp.id);
    refreshAllUi();
    scrollSelectedPropCardIntoView();
    return;
  }

  if (state.selection.assetId) {
    const placed = placeSelectedAssetAtWorld(worldX, worldY);
    if (placed) {
      refreshAllUi();
      scrollSelectedPropCardIntoView();
      return;
    }
  }

  clearSelection();
  refreshAllUi();
}

// ------------------------------------------------------------
// Keyboard shortcuts
// ------------------------------------------------------------
function handleKeyboardShortcuts(event) {
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redoEdit();
    } else {
      undoEdit();
    }
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redoEdit();
    return;
  }

  if (isTypingTarget(document.activeElement)) return;

  const key = event.key;
  const move = event.shiftKey ? 16 : getMoveAmount();

  if (key === ' ') {
    event.preventDefault();
    uiState.view.spacePanning = true;
    updateEditorCursor();
  } else if (key === 'ArrowUp') {
    event.preventDefault();
    moveSelectedProp(0, -move);
  } else if (key === 'ArrowDown') {
    event.preventDefault();
    moveSelectedProp(0, move);
  } else if (key === 'ArrowLeft') {
    event.preventDefault();
    moveSelectedProp(-move, 0);
  } else if (key === 'ArrowRight') {
    event.preventDefault();
    moveSelectedProp(move, 0);
  } else if (key === 'Delete' || key === 'Backspace') {
    event.preventDefault();
    deleteSelectedPropAction();
  } else if (key === '[' || key === '-') {
    event.preventDefault();
    resizeSelectedProp(-0.1);
  } else if (key === ']' || key === '=') {
    event.preventDefault();
    resizeSelectedProp(0.1);
  } else if (key.toLowerCase() === 'f') {
    event.preventDefault();
    flipSelectedProp();
  } else if (key.toLowerCase() === 'd') {
    event.preventDefault();
    copySelectedPropAction();
  }
}

function handleKeyboardShortcutRelease(event) {
  if (event.key !== ' ') return;
  uiState.view.spacePanning = false;
  updateEditorCursor();
}

// ------------------------------------------------------------
// Event binding
// ------------------------------------------------------------
function bindUi() {
  dom.mobileModeToggle.checked = state.mobileMode;
  dom.appRoot.classList.toggle('mobile-mode', state.mobileMode);

  dom.mobileModeToggle.addEventListener('change', () => {
    state.mobileMode = dom.mobileModeToggle.checked;
    dom.appRoot.classList.toggle('mobile-mode', state.mobileMode);
    saveToLocalStorage();
  });

  dom.worldWidthInput.value = state.world.width;
  dom.worldHeightInput.value = state.world.height;
  dom.previewBpmInput.value = previewState.bpm;
  dom.snapToggle.checked = state.grid.enabled;
  dom.gridSizeSelect.value = String(state.grid.size);

  dom.backgroundUpload.addEventListener('change', (event) => {
    loadBackgroundFromFile(event.target.files?.[0]);
  });
  bindImageDropTarget(dom.backgroundDropArea, loadBackgroundFromFile);

  dom.worldWidthInput.addEventListener('input', () => {
    setWorldSize(dom.worldWidthInput.value, dom.worldHeightInput.value);
    refreshAllUi();
  });

  dom.worldHeightInput.addEventListener('input', () => {
    setWorldSize(dom.worldWidthInput.value, dom.worldHeightInput.value);
    refreshAllUi();
  });

  dom.propImageUpload.addEventListener('change', (event) => {
    loadDraftImageFromFile(event.target.files?.[0]);
  });
  bindImageDropTarget(dom.propImageDropArea, loadDraftImageFromFile);

  dom.frameWidthInput.addEventListener('input', renderAssetPreview);
  dom.frameHeightInput.addEventListener('input', renderAssetPreview);
  dom.frameCountInput.addEventListener('input', renderAssetPreview);
  dom.savePropAssetButton.addEventListener('click', saveDraftAsAsset);

  dom.selectedPropNameInput.addEventListener('input', () => {
    renameSelectedProp(dom.selectedPropNameInput.value);
  });

  dom.moveUpButton.addEventListener('click', () => moveSelectedProp(0, -getMoveAmount()));
  dom.moveLeftButton.addEventListener('click', () => moveSelectedProp(-getMoveAmount(), 0));
  dom.moveRightButton.addEventListener('click', () => moveSelectedProp(getMoveAmount(), 0));
  dom.moveDownButton.addEventListener('click', () => moveSelectedProp(0, getMoveAmount()));

  dom.makeBiggerButton.addEventListener('click', () => resizeSelectedProp(0.1));
  dom.makeSmallerButton.addEventListener('click', () => resizeSelectedProp(-0.1));
  dom.flipPropButton.addEventListener('click', flipSelectedProp);
  dom.copyPropButton.addEventListener('click', copySelectedPropAction);
  dom.deletePropButton.addEventListener('click', deleteSelectedPropAction);

  dom.propBehaviourSelect.addEventListener('change', () => {
    setSelectedPropBehaviour(dom.propBehaviourSelect.value);
  });

  dom.loopSpeedSelect.addEventListener('change', () => {
    setSelectedPropLoopSpeed(dom.loopSpeedSelect.value);
  });

  dom.beatDivSelect.addEventListener('change', () => {
    setSelectedPropBeatDiv(dom.beatDivSelect.value);
  });

  dom.flickerMinInput.addEventListener('change', () => {
    setSelectedPropFlickerRange(dom.flickerMinInput.value, dom.flickerMaxInput.value);
  });

  dom.flickerMaxInput.addEventListener('change', () => {
    setSelectedPropFlickerRange(dom.flickerMinInput.value, dom.flickerMaxInput.value);
  });

  dom.snapToggle.addEventListener('change', () => {
    state.grid.enabled = dom.snapToggle.checked;
    saveToLocalStorage();
    refreshAllUi();
  });

  dom.gridSizeSelect.addEventListener('change', () => {
    state.grid.size = Math.max(1, Number(dom.gridSizeSelect.value) || 8);
    saveToLocalStorage();
    refreshAllUi();
  });

  dom.playPreviewButton.addEventListener('click', startPreview);
  dom.pausePreviewButton.addEventListener('click', pausePreview);
  dom.resetPreviewButton.addEventListener('click', resetPreviewState);
  dom.previewBpmInput.addEventListener('change', () => {
    setPreviewBpm(dom.previewBpmInput.value);
  });

  dom.downloadExportButton.addEventListener('click', downloadExportForGame);
  dom.copyExportButton.addEventListener('click', copyExportForGame);

  dom.resetViewButton.addEventListener('click', resetEditorView);
  dom.editorCanvas.addEventListener('wheel', handleEditorCanvasWheel, { passive: false });
  dom.editorCanvas.addEventListener('mousedown', startEditorPan);
  dom.editorCanvas.addEventListener('mousemove', handleEditorCanvasMove);
  dom.editorCanvas.addEventListener('mouseleave', handleEditorCanvasLeave);
  dom.editorCanvas.addEventListener('click', handleEditorCanvasClick);
  dom.editorCanvas.addEventListener('auxclick', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  window.addEventListener('mousemove', handleEditorWindowMove);
  window.addEventListener('mouseup', stopEditorPan);

  window.addEventListener('beforeunload', revokeRuntimeObjectUrls);
  document.addEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('keyup', handleKeyboardShortcutRelease);
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function init() {
  loadFromLocalStorage();
  fitCanvasToBackground();
  bindUi();
  renderAssetPreview();
  renderAssetList();
  renderPlacedPropList();
  updateSelectedPropPanel();
  updateBehaviourPanel();
  updatePreviewUi();
  refreshExportPanel();
  renderEditor();
  console.log('Prop Placer loaded');
}

init();
