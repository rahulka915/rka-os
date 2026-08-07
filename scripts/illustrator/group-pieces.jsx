// Cluster the loose, unnamed items on a layer into one group per connected piece.
// Two items join the same cluster when their bounding boxes touch or overlap.
// Named items are left completely alone - they are work the user did deliberately.
// __LAYER__ / __DRY__ are substituted by group-pieces.sh.
var LAYER = '__LAYER__', DRY = __DRY__;

var L = null;
for (var i = 0; i < DOC.layers.length; i++) if (DOC.layers[i].name == LAYER) L = DOC.layers[i];
if (!L) throw new Error('no layer named ' + LAYER);
if (L.locked) throw new Error('layer ' + LAYER + ' is locked');

// A single oversized item (a backing rectangle, a full-sheet raster) overlaps every
// other item and would collapse the whole layer into one cluster. Measured: the
// Generative Object's white backing rect is 1254x1254 against parts of ~100-400.
var MAX = 800;

// Snapshot first: creating groups mutates L.pageItems while we iterate it.
var items = [], skipped = { named: 0, oversized: 0, raster: 0 };
for (var i = 0; i < L.pageItems.length; i++) {
  var it = L.pageItems[i];
  if (it.name && it.name.replace(/^\s+|\s+$/g, '') !== '') { skipped.named++; continue; }
  if (it.typename == 'RasterItem' || it.typename == 'PlacedItem') { skipped.raster++; continue; }
  var b = it.geometricBounds;
  var w = b[2] - b[0], h = b[1] - b[3];
  if (w > MAX || h > MAX) { skipped.oversized++; continue; }
  items.push({ item: it, x0: b[0], y0: b[1], x1: b[2], y1: b[3], z: i });
}

var n = items.length;
var parent = [];
for (var i = 0; i < n; i++) parent.push(i);
function find(a) { while (parent[a] != a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
function union(a, b) { a = find(a); b = find(b); if (a != b) parent[a] = b; }

var PAD = 2;
for (var i = 0; i < n; i++) {
  for (var j = i + 1; j < n; j++) {
    var p = items[i], q = items[j];
    if (p.x0 - PAD <= q.x1 && q.x0 - PAD <= p.x1 && p.y1 - PAD <= q.y0 && q.y1 - PAD <= p.y0) union(i, j);
  }
}

var buckets = {}, order = [];
for (var i = 0; i < n; i++) {
  var r = find(i);
  if (!buckets[r]) { buckets[r] = []; order.push(r); }
  buckets[r].push(i);
}

// Largest pieces first, so piece-01 is the most substantial thing on the layer.
order.sort(function (a, b) { return buckets[b].length - buckets[a].length; });

var out = ['layer=' + LAYER + ' dry=' + DRY,
           'considered=' + n + ' clusters=' + order.length +
           ' skipped: named=' + skipped.named + ' oversized=' + skipped.oversized +
           ' raster=' + skipped.raster];

var made = 0;
for (var c = 0; c < order.length; c++) {
  var idx = buckets[order[c]];
  // Preserve z-order: move members in their existing stacking order.
  idx.sort(function (a, b) { return items[a].z - items[b].z; });
  var x0 = items[idx[0]].x0, y0 = items[idx[0]].y0, x1 = items[idx[0]].x1, y1 = items[idx[0]].y1;
  for (var k = 1; k < idx.length; k++) {
    var m = items[idx[k]];
    if (m.x0 < x0) x0 = m.x0;
    if (m.y0 > y0) y0 = m.y0;
    if (m.x1 > x1) x1 = m.x1;
    if (m.y1 < y1) y1 = m.y1;
  }
  var label = 'piece-' + (c + 1 < 10 ? '0' : '') + (c + 1);
  // items != paths: a cluster member can itself be a group, so count leaves too.
  var lv = 0;
  for (var k = 0; k < idx.length; k++) lv += leaves(items[idx[k]].item);
  out.push(label + ' items=' + idx.length + ' paths=' + lv +
    ' bbox=[' + x0.toFixed(0) + ',' + y0.toFixed(0) + ' ' + x1.toFixed(0) + ',' + y1.toFixed(0) + ']' +
    ' w=' + (x1 - x0).toFixed(0) + ' h=' + (y0 - y1).toFixed(0));
  if (DRY) continue;
  if (idx.length < 2) continue;   // a lone path needs no group
  var g = L.groupItems.add();
  g.name = label;
  for (var k = 0; k < idx.length; k++) items[idx[k]].item.move(g, ElementPlacement.PLACEATEND);
  made++;
}

if (!DRY) {
  app.selection = null;
  DOC.save();
}
out.push(DRY ? '(dry run - nothing changed)' : 'created ' + made + ' groups, document saved');
out.join('\n');
