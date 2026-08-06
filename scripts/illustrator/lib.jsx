var DOC = app.activeDocument;
if (DOC.name != 'ronin_rig_v4.ai') throw new Error('Wrong document: expected ronin_rig_v4.ai, got ' + DOC.name);
var RONIN = null, PROXY = null, REFERENCE = null;
for (var i = 0; i < DOC.layers.length; i++) {
  var n = DOC.layers[i].name;
  if (n == 'Ronin') RONIN = DOC.layers[i];
  if (n == 'Proxy') PROXY = DOC.layers[i];
  if (n == 'Reference') REFERENCE = DOC.layers[i];
}
function slot(nm) {
  if (!RONIN) return null;
  for (var k = 0; k < RONIN.pageItems.length; k++)
    if (RONIN.pageItems[k].name == nm) return RONIN.pageItems[k];
  return null;
}
function leaves(g) {
  if (g.typename != 'GroupItem') return 1;
  var n = 0;
  for (var i = 0; i < g.pageItems.length; i++) n += leaves(g.pageItems[i]);
  return n;
}
function rgb(h) {
  var c = new RGBColor();
  c.red = parseInt(h.substr(0,2),16); c.green = parseInt(h.substr(2,2),16); c.blue = parseInt(h.substr(4,2),16);
  return c;
}
// Illustrator's exportFile silently no-ops when writing to /tmp under this
// configuration - no file, no error - which let a previous run report an image as
// "viewed" when none existed. Always write inside the repo, and always assert.
var TMP = '/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/.rig-tmp/';
// Renders a temporary artboard to PNG, then removes it. box = [left, top, right, bottom].
function renderPNG(path, box, scale) {
  var f = new File(path);
  if (f.exists) f.remove();
  var ab = DOC.artboards.add(box);
  DOC.artboards.setActiveArtboardIndex(DOC.artboards.length - 1);
  var o = new ExportOptionsPNG24();
  o.artBoardClipping = true; o.transparency = false;
  o.horizontalScale = scale; o.verticalScale = scale;
  DOC.exportFile(f, ExportType.PNG24, o);
  ab.remove();
  DOC.artboards.setActiveArtboardIndex(0);
  var check = new File(path);
  if (!check.exists) throw new Error('renderPNG wrote nothing to ' + path +
    ' - exportFile no-opped. Never report an image as viewed without this check.');
  return path;
}
