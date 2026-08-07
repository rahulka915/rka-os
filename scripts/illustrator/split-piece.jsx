// Sub-divide one already-grouped piece into its genuinely separate sub-pieces.
//
// group-pieces.jsx clusters with a +2 pad, so bounding boxes that merely TOUCH
// join the same cluster. That chained the middle hair, the right hair and the
// headband strip into one 83-path group, and an arm into the same group as both
// swords - none of which are actually connected. Requiring real OVERLAP (a
// negative pad) separates them without cutting any geometry.
// __GROUP__ / __PAD__ / __DRY__ are substituted by split-piece.sh.
var GROUP = '__GROUP__', PAD = __PAD__, DRY = __DRY__;

var ART = null;
for (var i = 0; i < DOC.layers.length; i++) if (DOC.layers[i].name == 'Generated') ART = DOC.layers[i];
if (!ART) throw new Error('no layer named Generated');

var target = null;
for (var i = 0; i < ART.pageItems.length; i++) if (ART.pageItems[i].name == GROUP) target = ART.pageItems[i];
if (!target) throw new Error('no group named ' + GROUP + ' at the top level of Generated');
if (target.typename != 'GroupItem') throw new Error(GROUP + ' is a ' + target.typename + ', not a group');

var items = [];
for (var i = 0; i < target.pageItems.length; i++) {
  var it = target.pageItems[i], b = it.geometricBounds;
  items.push({ item: it, x0: b[0], y0: b[1], x1: b[2], y1: b[3], z: i });
}
var n = items.length;
var parent = [];
for (var i = 0; i < n; i++) parent.push(i);
function find(a) { while (parent[a] != a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
function union(a, b) { a = find(a); b = find(b); if (a != b) parent[a] = b; }

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
order.sort(function (a, b) { return buckets[b].length - buckets[a].length; });

var taken = {};
for (var i = 0; i < ART.pageItems.length; i++) if (ART.pageItems[i].name) taken[ART.pageItems[i].name] = true;
var counter = 0;
function nextLabel() {
  var lbl;
  do { counter++; lbl = GROUP + '-' + counter; } while (taken[lbl]);
  taken[lbl] = true;
  return lbl;
}

var out = ['group=' + GROUP + ' children=' + n + ' pad=' + PAD + ' -> subgroups=' + order.length];
function leafCount(x) { return leaves(x); }
for (var c = 0; c < order.length; c++) {
  var idx = buckets[order[c]];
  idx.sort(function (a, b) { return items[a].z - items[b].z; });
  var x0 = items[idx[0]].x0, y0 = items[idx[0]].y0, x1 = items[idx[0]].x1, y1 = items[idx[0]].y1, lv = 0;
  for (var k = 0; k < idx.length; k++) {
    var m = items[idx[k]];
    if (m.x0 < x0) x0 = m.x0;
    if (m.y0 > y0) y0 = m.y0;
    if (m.x1 > x1) x1 = m.x1;
    if (m.y1 < y1) y1 = m.y1;
    lv += leafCount(m.item);
  }
  var label = nextLabel();
  out.push('  ' + label + ' items=' + idx.length + ' paths=' + lv +
    ' bbox=[' + x0.toFixed(0) + ',' + y0.toFixed(0) + ' ' + x1.toFixed(0) + ',' + y1.toFixed(0) + ']' +
    ' w=' + (x1 - x0).toFixed(0) + ' h=' + (y0 - y1).toFixed(0));
  if (DRY || order.length < 2) continue;
  // Promote to the layer so each sub-piece is independently nameable/placeable.
  var g = ART.groupItems.add();
  g.name = label;
  for (var k = 0; k < idx.length; k++) items[idx[k]].item.move(g, ElementPlacement.PLACEATEND);
}

if (!DRY && order.length > 1) {
  app.selection = null;
  DOC.save();
  out.push('promoted ' + order.length + ' subgroups to the Generated layer, document saved');
} else if (order.length < 2) {
  out.push('SINGLE connected piece at this pad - genuinely one shape cluster, a cut would be needed to divide it');
} else {
  out.push('(dry run - nothing changed)');
}
out.join('\n');
