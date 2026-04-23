export function exportPropData(props) {
  return props.map((prop) => ({
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

export function exportAssetManifest(assets) {
  const manifest = {};
  assets.forEach((asset) => {
    manifest[asset.id] = {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      frameCount: asset.frameCount
    };
  });
  return manifest;
}

export function exportAsJson({ world, assets, props }) {
  return JSON.stringify(
    {
      world: { ...world },
      assets: exportAssetManifest(assets),
      props: exportPropData(props)
    },
    null,
    2
  );
}

export function exportAsJsModule({ assets, props }) {
  return `export const propAssets = ${JSON.stringify(exportAssetManifest(assets), null, 2)};\n\nexport const stageProps = ${JSON.stringify(exportPropData(props), null, 2)};\n`;
}
