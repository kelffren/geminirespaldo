(function () {
  // DISABLED_PROCEDURAL_ART
  // This file is intentionally retained as a tombstone because earlier parallel commits
  // repeatedly re-loaded it. The procedural kiosk/path/water composition was rejected by
  // visual-direction review: final environment art must come from authored raster/tile assets,
  // not Canvas fillRect/arc/ellipse primitives. Loading this file must therefore be a no-op.
  window.KELO_LUXE_COMPOSE = Object.freeze({
    disabled: true,
    reason: 'procedural-art-rejected',
    replacementRequirement: 'authored-raster-or-tile-atlas'
  });
})();
