// Trace one flat PNG into one rig slot. __SLOT__/__SRC__/__MODE__ are substituted
// by trace-part.sh. Image Trace IS scriptable here (verified: placedItems.add ->
// embed -> trace -> expandTracing all succeed), and it emits roughly one path per
// flat colour region, so the source image's region count IS the path count.
var SLOT = '__SLOT__', SRC = '__SRC__', MODE = '__MODE__';
RONIN.locked = false; RONIN.visible = true;
var target = slot(SLOT);
if (!target) throw new Error('no slot ' + SLOT);
target.locked = false; target.hidden = false;
while (target.pageItems.length > 0) { var q = target.pageItems[0]; q.locked=false; q.hidden=false; q.remove(); }

// The proxy is the authoritative coordinate reference for this part.
var px = null;
for (var k = 0; k < PROXY.pageItems.length; k++)
  if (PROXY.pageItems[k].name == SLOT + '-proxy') px = PROXY.pageItems[k];
if (!px) throw new Error('no proxy for ' + SLOT);
var pb = px.geometricBounds;

var placed = target.placedItems.add();
placed.file = new File(SRC);
if (MODE == 'canvas') {
  // Full-artboard 2500x2500 source: top-left of the artboard, no scaling.
  placed.position = [0, 0];
} else {
  // Cropped source: fit inside the proxy box preserving aspect, then centre.
  // Aspect is preserved so a slightly-off crop cannot stretch the art; gate 7
  // ("fills too little of proxy") catches a crop that is grossly wrong.
  var pw = pb[2]-pb[0], ph = pb[1]-pb[3];
  var iw = placed.width, ih = placed.height;
  var s = Math.min(pw/iw, ph/ih);
  placed.width = iw*s; placed.height = ih*s;
  placed.position = [pb[0] + (pw - placed.width)/2, pb[1] - (ph - placed.height)/2];
}
placed.embed();
var raster = target.pageItems[0];
if (raster.typename != 'RasterItem') throw new Error('expected RasterItem, got ' + raster.typename);
raster.trace();
var pit = target.pageItems[0];
var o = pit.tracing.tracingOptions;
o.ignoreWhite = true;                    // white background drops out
o.tracingMode = TracingModeType.TRACINGMODECOLOR;
o.maxColors = 6;                         // ceiling, not a target - keep sources flat
o.pathFidelity = 50; o.cornerFidelity = 50; o.noiseFidelity = 25;
var art = pit.tracing.expandTracing();
art.name = SLOT + '-art';
art.move(target, ElementPlacement.PLACEATEND);
DOC.save();
var b = art.geometricBounds;
'traced ' + SLOT + ' -> ' + leaves(target) + ' paths, bbox [' +
  b[0].toFixed(0) + ',' + b[1].toFixed(0) + ' ' + b[2].toFixed(0) + ',' + b[3].toFixed(0) +
  '] vs proxy [' + pb[0].toFixed(0) + ',' + pb[1].toFixed(0) + ' ' + pb[2].toFixed(0) + ',' + pb[3].toFixed(0) + ']';
