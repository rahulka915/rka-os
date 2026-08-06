// Export a full-artboard 2500x2500 PNG containing only one slot's proxy, filled
// flat, with the reference art dimmed underneath. This is the positioning guide
// for producing that part's art: paint inside the silhouette, keep the canvas size.
var SLOT = '__SLOT__';
PROXY.locked = false;
var refWasVisible = REFERENCE.visible;
REFERENCE.visible = __REF__; RONIN.visible = false; PROXY.visible = true;
var saved = [];
for (var k = 0; k < PROXY.pageItems.length; k++) {
  var g = PROXY.pageItems[k];
  saved.push([g, g.hidden]);
  g.hidden = (g.name != SLOT + '-proxy');
}
var target = null;
for (var k = 0; k < PROXY.pageItems.length; k++)
  if (PROXY.pageItems[k].name == SLOT + '-proxy') target = PROXY.pageItems[k];
if (!target) throw new Error('no proxy for ' + SLOT);
var paths = [], oldFill = [], oldOp = target.opacity;
(function walk(x){
  if (x.typename == 'GroupItem') { for (var i=0;i<x.pageItems.length;i++) walk(x.pageItems[i]); return; }
  if (x.typename == 'PathItem') { paths.push(x); oldFill.push(x.fillColor); }
})(target);
for (var i = 0; i < paths.length; i++) { paths[i].fillColor = rgb('FF00FF'); paths[i].opacity = 40; }
target.opacity = 100;
renderPNG(TMP + 'tmpl-' + SLOT + (__REF__ ? '-guide' : '-mask') + '.png', [0, 0, 2500, -2500], 100);
for (var i = 0; i < paths.length; i++) { paths[i].fillColor = oldFill[i]; paths[i].opacity = 35; }
target.opacity = oldOp;
for (var i = 0; i < saved.length; i++) saved[i][0].hidden = saved[i][1];
RONIN.visible = true; REFERENCE.visible = refWasVisible; PROXY.locked = true;
var b = target.geometricBounds;
'template .rig-tmp/tmpl-' + SLOT + (__REF__ ? '-guide' : '-mask') + '.png (2500x2500), proxy at [' +
  b[0].toFixed(0) + ',' + b[1].toFixed(0) + ' ' + b[2].toFixed(0) + ',' + b[3].toFixed(0) + ']';
