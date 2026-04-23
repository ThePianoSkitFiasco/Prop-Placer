export const dom = {
  appRoot: document.getElementById('appRoot'),
  mobileModeToggle: document.getElementById('mobileModeToggle'),

  backgroundUpload: document.getElementById('backgroundUpload'),
  backgroundDropArea: document.getElementById('backgroundDropArea'),
  worldWidthInput: document.getElementById('worldWidthInput'),
  worldHeightInput: document.getElementById('worldHeightInput'),

  propImageUpload: document.getElementById('propImageUpload'),
  propImageDropArea: document.getElementById('propImageDropArea'),
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

  resetViewButton: document.getElementById('resetViewButton'),
  canvasSizeReadout: document.getElementById('canvasSizeReadout'),
  worldSizeReadout: document.getElementById('worldSizeReadout'),
  cursorWorldReadout: document.getElementById('cursorWorldReadout'),
  lastClickReadout: document.getElementById('lastClickReadout'),

  editorCanvas: document.getElementById('editorCanvas')
};

export const ctx = dom.editorCanvas.getContext('2d');
export const assetPreviewCtx = dom.assetPreviewCanvas.getContext('2d');
