// ============================================================
// Prop Placer - clean rebuild
// Beginner-friendly scene prop placement tool
// ============================================================

const DEFAULTS = {
  worldWidth: 2000,
  worldHeight: 720,
  prop: {
    scale: 1,
    depth: 50,
    originX: 0.5,
    originY: 1,
    flipX: false,
    mode: 'static',
    beatDiv: 1,
    fps: 6,
    minDelay: 120,
    maxDelay: 300,
    label: ''
  },
  preview: {
    bpm: 120
  },
  grid: {
    enabled: false,
    size: 8
  }
};

const STORAGE_KEY = 'prop_placer_save_data';

let assetCounter = 1;
let propCounter = 1;

function makeAssetId(base = 'asset') {
  const id = `${base}_${String(assetCounter).padStart(3, '0')}`;
  assetCounter += 1;
  return id;
}

function makePropId() {
  const id = `prop_${String(propCounter).padStart(3, '0')}`;
  propCounter += 1;
  return id;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function timestampString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

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

function createAsset({
  id,
  name = '',
  imageSrc = '',
  fileName = '',
  frameWidth = 64,
  frameHeight = 64,
  frameCount = 1
} = {}) {
  return {
    id: id || makeAssetId(),
    name: name || 'New Picture',
    imageSrc,
    fileName,
    frameWidth,
    frameHeight,
    frameCount
  };
}

function createPlacedProp({
  id,
  assetId,
  x = 0,
  y = 0,
  scale = DEFAULTS.prop.scale,
  depth = DEFAULTS.prop.depth,
  originX = DEFAULTS.prop.originX,
  originY = DEFAULTS.prop.originY,
  flipX = DEFAULTS.prop.flipX,
  mode = DEFAULTS.prop.mode,
  beatDiv = DEFAULTS.prop.beatDiv,
  fps = DEFAULTS.prop.fps,
  minDelay = DEFAULTS.prop.minDelay,
  maxDelay = DEFAULTS.prop.maxDelay,
  label = DEFAULTS.prop.label
} = {}) {
  if (!assetId) {
    throw new Error('assetId is required');
  }

  return {
    id: id || makePropId(),
    assetId,
    x,
    y,
    scale,
    depth,
    originX,
    originY,
    flipX,
    mode,
    beatDiv,
    fps,
    minDelay,
    maxDelay,
    label
  };
}

const state = {
  background: {
    imageSrc: '',
    fileName: '',
    naturalWidth: 0,
    naturalHeight: 0
  },
  world: {
    width: DEFAULTS.worldWidth,
    height: DEFAULTS.worldHeight
  },
  assets: {
    byId: {}
  },
  props: {
    byId: {},
    order: []
  },
  selection: {
    assetId: null,
    propId: null
  },
  grid: {
    enabled: DEFAULTS.grid.enabled,
    size: DEFAULTS.grid.size
  },
  mobileMode: false
};

const uiState = {
  backgroundImage: null,
  cursorWorldX: null,
  cursorWorldY: null,
  lastClickWorldX: null,
  lastClickWorldY: null
};

const previewState = {
  playing: false,
  bpm: DEFAULTS.preview.bpm,
  animationFrameId: null,
  lastTickTime: 0,
  beatAccumulatorMs: 0,
  beatCount: 0,
  props: {}
};

const assetUploadDraft = {
  file: null,
  imageSrc: '',
  image: null
};

const assetImageCache = {};

const dom = {
  appRoot: document.getElementById('appRoot'),
  mobileModeToggle: document.getElementById('mobileModeToggle'),

  backgroundUpload: document.getElementById('backgroundUpload'),
  worldWidthInput: document.getElementById('worldWidthInput'),
  worldHeightInput: document.getElementById('worldHeightInput'),

  propImageUpload: document.getElementById('propImageUpload'),
  propNameInput: document.getElementById('propNameInput'),
  frameWidthInput: document.getElementById('frameWidthInput'),
  frameHeightInput: document.getElementById('frameHeightInput'),
  frameCountInput: document.getElementById('frameCountInput'),
  savePropAssetButton: document.getElementById('savePropAssetButton'),
  uploadStatusText: document.getElementById('uploadStatusText'),
  assetPreviewCanvas: document.getElementById('assetPreviewCanvas'),
  assetList: document.getElementById('assetList'),

  selectedPropStatus: document.getElementById('selectedPropStatus'),
  selectedPropNameInput: document.getElementById('selectedPropNameInput'),
  moveAmountSelect: document.getElementById('moveAmountSelect'),
  moveUpButton: document.getElementById('moveUpButton'),
  moveLeftButton: document.getElementById('moveLeftButton'),
  moveRightButton: document.getElementById('moveRightButton'),
  moveDownButton: document.getElementById('moveDownButton'),
  makeBiggerButton: document.getElementById('makeBiggerButton'),
  makeSmallerButton: document.getElementById('makeSmallerButton'),
  flipPropButton: document.getElementById('flipPropButton'),
  copyPropButton: document.getElementById('copyPropButton'),
  deletePropButton: document.getElementById('deletePropButton'),

  propBehaviourSelect: document.getElementById('propBehaviourSelect'),
  loopSettings: document.getElementById('loopSettings'),
  loopSpeedSelect: document.getElementById('loopSpeedSelect'),
  beatSettings: document.getElementById('beatSettings'),
  beatDivSelect: document.getElementById('beatDivSelect'),
  flickerSettings: document.getElementById('flickerSettings'),
  flickerMinInput: document.getElementById('flickerMinInput'),
  flickerMaxInput: document.getElementById('flickerMaxInput'),

  placedPropList: document.getElementById('placedPropList'),

  snapToggle: document.getElementById('snapToggle'),
  gridSizeSelect: document.getElementById('gridSizeSelect'),

  playPreviewButton: document.getElementById('playPreviewButton'),
  pausePreviewButton: document.getElementById('pausePreviewButton'),
  resetPreviewButton: document.getElementById('resetPreviewButton'),
  previewBpmInput: document.getElementById('previewBpmInput'),
  previewStatusText: document.getElementById('previewStatusText'),

  downloadExportButton: document.getElementById('downloadExportButton'),
  copyExportButton: document.getElementById('copyExportButton'),
  exportStatusText: document.getElementById('exportStatusText'),
  exportPreviewText: document.getElementById('exportPreviewText'),

  canvasSizeReadout: document.getElementById('canvasSizeReadout'),
  worldSizeReadout: document.getElementById('worldSizeReadout'),
  cursorWorldReadout: document.getElementById('cursorWorldReadout'),
  lastClickReadout: document.getElementById('lastClickReadout'),

  editorCanvas: document.getElementById('editorCanvas')
};

const ctx = dom.editorCanvas.getContext('2d');
const assetPreviewCtx = dom.assetPreviewCanvas.getContext('2d');

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
      assetCounter,
      propCounter
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

    assetCounter = Math.max(
      Number(data.counters?.assetCounter) || 1,
      getNextNumberedId(Object.keys(state.assets.byId), 'asset')
    );
    propCounter = Math.max(
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
  delete assetImageCache[assetId];

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

function getCanvasPointerPosition(event) {
  const rect = dom.editorCanvas.getBoundingClientRect();
  const scaleX = dom.editorCanvas.width / rect.width;
  const scaleY = dom.editorCanvas.height / rect.height;

  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  return { canvasX, canvasY };
}

function canvasToWorld(canvasX, canvasY) {
  return {
    worldX: Math.round((canvasX / dom.editorCanvas.width) * state.world.width),
    worldY: Math.round((canvasY / dom.editorCanvas.height) * state.world.height)
  };
}

function worldToCanvas(worldX, worldY) {
  return {
    canvasX: (worldX / state.world.width) * dom.editorCanvas.width,
    canvasY: (worldY / state.world.height) * dom.editorCanvas.height
  };
}

function getAssetDrawMetrics(asset, prop) {
  if (!asset) return null;

  const scaleToCanvasX = dom.editorCanvas.width / state.world.width;
  const scaleToCanvasY = dom.editorCanvas.height / state.world.height;

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
  ctx.drawImage(uiState.backgroundImage, 0, 0, dom.editorCanvas.width, dom.editorCanvas.height);
}

function drawGridOverlay() {
  if (!state.grid.enabled) return;

  const gridSize = Math.max(1, state.grid.size);
  const stepX = (gridSize / state.world.width) * dom.editorCanvas.width;
  const stepY = (gridSize / state.world.height) * dom.editorCanvas.height;

  ctx.save();
  ctx.strokeStyle = 'rgba(121, 199, 255, 0.12)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= dom.editorCanvas.width; x += stepX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dom.editorCanvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= dom.editorCanvas.height; y += stepY) {
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

function resetAssetDraft(keepFileInput = false) {
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

  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      assetUploadDraft.file = file;
      assetUploadDraft.imageSrc = reader.result;
      assetUploadDraft.image = image;

      const suggestedName = file.name.replace(/\.[^/.]+$/, '');
      if (!dom.propNameInput.value.trim()) {
        dom.propNameInput.value = suggestedName;
      }

      dom.uploadStatusText.textContent = `Loaded: ${file.name} (${image.naturalWidth} x ${image.naturalHeight})`;
      renderAssetPreview();
    };
    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function saveDraftAsAsset() {
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

  const asset = addAsset({
    id: finalId,
    name,
    imageSrc: assetUploadDraft.imageSrc,
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

  const patch = { mode };

  if (mode === 'loop' && !prop.fps) patch.fps = 6;
  if (mode === 'beat' && !prop.beatDiv) patch.beatDiv = 1;
  if (mode === 'randomFlicker') {
    if (!prop.minDelay) patch.minDelay = 120;
    if (!prop.maxDelay) patch.maxDelay = 300;
  }

  updateProp(prop.id, patch);
  refreshAllUi();
}

function setSelectedPropLoopSpeed(fps) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  updateProp(prop.id, { fps: Math.max(1, Number(fps) || 6) });
  refreshAllUi();
}

function setSelectedPropBeatDiv(value) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  updateProp(prop.id, { beatDiv: Math.max(1, Number(value) || 1) });
  refreshAllUi();
}

function setSelectedPropFlickerRange(minDelay, maxDelay) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

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
  return placed;
}

function moveSelectedProp(dx, dy) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

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
  refreshAllUi();
}

function resizeSelectedProp(scaleDelta) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;

  const nextScale = clamp(Number((prop.scale + scaleDelta).toFixed(2)), 0.25, 4);
  updateProp(prop.id, { scale: nextScale });
  refreshAllUi();
}

function flipSelectedProp() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  updateProp(prop.id, { flipX: !prop.flipX });
  refreshAllUi();
}

function copySelectedPropAction() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  const copy = duplicateProp(prop.id);
  if (!copy) return;
  selectProp(copy.id);
  refreshAllUi();
  scrollSelectedPropCardIntoView();
}

function deleteSelectedPropAction() {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  removeProp(prop.id);
  refreshAllUi();
}

function renameSelectedProp(value) {
  const prop = getSelectedPlacedProp();
  if (!prop) return;
  updateProp(prop.id, { label: value });
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
function exportPropData() {
  return getAllProps().map((prop) => ({
    id: prop.id,
    assetId: prop.assetId,
    label: prop.label || '',
    x: prop.x,
    y: prop.y,
    scale: prop.scale,
    depth: prop.depth,
    originX: prop.originX,
    originY: prop.originY,
    flipX: prop.flipX,
    mode: prop.mode,
    ...(prop.mode === 'beat' ? { beatDiv: prop.beatDiv } : {}),
    ...(prop.mode === 'loop' ? { fps: prop.fps } : {}),
    ...(prop.mode === 'randomFlicker'
      ? { minDelay: prop.minDelay, maxDelay: prop.maxDelay }
      : {})
  }));
}

function exportAssetManifest() {
  const manifest = {};
  getAllAssets().forEach((asset) => {
    manifest[asset.id] = {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      frameCount: asset.frameCount
    };
  });
  return manifest;
}

function exportAsJson() {
  return JSON.stringify(
    {
      world: { ...state.world },
      assets: exportAssetManifest(),
      props: exportPropData()
    },
    null,
    2
  );
}

function exportAsJsModule() {
  return `export const propAssets = ${JSON.stringify(exportAssetManifest(), null, 2)};\n\nexport const stageProps = ${JSON.stringify(exportPropData(), null, 2)};\n`;
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

  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      uiState.backgroundImage = image;

      setBackground({
        imageSrc: reader.result,
        fileName: file.name,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight
      });

      fitCanvasToBackground();
      renderEditor();
    };
    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

// ------------------------------------------------------------
// Canvas interactions
// ------------------------------------------------------------
function handleEditorCanvasMove(event) {
  const { canvasX, canvasY } = getCanvasPointerPosition(event);
  const { worldX, worldY } = canvasToWorld(canvasX, canvasY);

  uiState.cursorWorldX = worldX;
  uiState.cursorWorldY = worldY;
  renderEditor();
}

function handleEditorCanvasLeave() {
  uiState.cursorWorldX = null;
  uiState.cursorWorldY = null;
  renderEditor();
}

function handleEditorCanvasClick(event) {
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
  if (isTypingTarget(document.activeElement)) return;

  const key = event.key;
  const move = event.shiftKey ? 16 : getMoveAmount();

  if (key === 'ArrowUp') {
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

  dom.editorCanvas.addEventListener('mousemove', handleEditorCanvasMove);
  dom.editorCanvas.addEventListener('mouseleave', handleEditorCanvasLeave);
  dom.editorCanvas.addEventListener('click', handleEditorCanvasClick);

  document.addEventListener('keydown', handleKeyboardShortcuts);
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
