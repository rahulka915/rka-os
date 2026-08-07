// Export the rig as SVG. Scripted export crops to ARTWORK, not artboard
// (ExportOptionsSVG has no artBoardClipping), so without a full-artboard rect
// every export lands at a different size and all shared coordinates are lost.
PROXY.locked = false; PROXY.visible = false;
REFERENCE.visible = false;
RONIN.locked = false;
// Art parked OFF the artboard still exports: the frame rect fixes the viewBox
// but not the markup. A first export carried 547 paths when only 30 were in
// slots, the rest being the working sheet at x~4500-6400. Hide non-rig layers.
var restore = [];
for (var li = 0; li < DOC.layers.length; li++) {
  var lyr = DOC.layers[li];
  if (lyr == RONIN || lyr == PROXY || lyr == REFERENCE) continue;
  restore.push([lyr, lyr.visible]);
  lyr.visible = false;
}
// Creating art fails with "Target layer cannot be modified" if the active layer
// is one we just hid. Make the rig layer the target before adding the frame.
RONIN.visible = true;
DOC.activeLayer = RONIN;
var frame = RONIN.pathItems.rectangle(0, 0, 2500, 2500);
frame.name = 'canvas-frame';
frame.stroked = false; frame.filled = true; frame.fillColor = rgb('FFFFFF');
frame.opacity = 0;
frame.zOrder(ZOrderMethod.SENDTOBACK);
var opts = new ExportOptionsSVG();
opts.embedRasterImages = false;
opts.fontType = SVGFontType.OUTLINEFONT;
opts.coordinatePrecision = 3;
DOC.exportFile(new File('/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/assets/ronin/for-rive/ronin-rig-v4.svg'), ExportType.SVG, opts);
frame.remove();
for (var li = 0; li < restore.length; li++) restore[li][0].visible = restore[li][1];
REFERENCE.visible = true; PROXY.visible = true; PROXY.locked = true;
var f = new File('/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/assets/ronin/for-rive/ronin-rig-v4.svg');
if (!f.exists) throw new Error('exportFile wrote nothing to /Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/assets/ronin/for-rive/ronin-rig-v4.svg');
'exported, ' + f.length + ' bytes';
