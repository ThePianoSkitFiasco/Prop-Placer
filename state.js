export const DEFAULTS = {
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

export const STORAGE_KEY = 'prop_placer_save_data';

export const counters = {
  asset: 1,
  prop: 1
};

export function makeAssetId(base = 'asset') {
  const id = `${base}_${String(counters.asset).padStart(3, '0')}`;
  counters.asset += 1;
  return id;
}

export function makePropId() {
  const id = `prop_${String(counters.prop).padStart(3, '0')}`;
  counters.prop += 1;
  return id;
}

export function createAsset({
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

export function createPlacedProp({
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

export const state = {
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

export const uiState = {
  backgroundImage: null,
  pendingBackgroundUrl: '',
  view: {
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    spacePanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartViewX: 0,
    panStartViewY: 0,
    didPan: false
  },
  cursorWorldX: null,
  cursorWorldY: null,
  lastClickWorldX: null,
  lastClickWorldY: null
};

export const previewState = {
  playing: false,
  bpm: DEFAULTS.preview.bpm,
  animationFrameId: null,
  lastTickTime: 0,
  beatAccumulatorMs: 0,
  beatCount: 0,
  props: {}
};

export const assetUploadDraft = {
  file: null,
  imageSrc: '',
  image: null
};

export const assetImageCache = {};

export const HISTORY_LIMIT = 50;

export const editHistory = {
  undo: [],
  redo: []
};
