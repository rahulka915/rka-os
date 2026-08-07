// Move the assembled leg art onto the artboard and into its rig slots.
// The art keeps its OWN proportions - it is scaled uniformly by leg length and
// aligned to the proxy's top centre, NOT stretched to fill the proxy box. The
// proxies are being re-derived from this art later; forcing the art to today's
// proxies would bake in a mismatch we already measured (knee 27-37% vs 52%).
// __DRY__ is substituted by place-legs.sh.
var DRY = __DRY__;

var ART = null;
for (var i = 0; i < DOC.layers.length; i++) if (DOC.layers[i].name == 'Generated') ART = DOC.layers[i];
if (!ART) throw new Error('no layer named Generated');

function findDeep(container, nm, depth) {
  for (var i = 0; i < container.pageItems.length; i++) {
    var it = container.pageItems[i];
    if (it.name == nm) return it;
    if (it.typename == 'GroupItem' && depth < 3) { var r = findDeep(it, nm, depth + 1); if (r) return r; }
  }
  return null;
}
function proxyOf(nm) {
  for (var i = 0; i < PROXY.pageItems.length; i++) if (PROXY.pageItems[i].name == nm + '-proxy') return PROXY.pageItems[i];
  return null;
}
function union(boxes) {
  var b = [boxes[0][0], boxes[0][1], boxes[0][2], boxes[0][3]];
  for (var i = 1; i < boxes.length; i++) {
    if (boxes[i][0] < b[0]) b[0] = boxes[i][0];
    if (boxes[i][1] > b[1]) b[1] = boxes[i][1];
    if (boxes[i][2] > b[2]) b[2] = boxes[i][2];
    if (boxes[i][3] < b[3]) b[3] = boxes[i][3];
  }
  return b;
}

var LEGS = [['leg-L-thigh', 'leg-L-shin', 'leg-L-foot'], ['leg-R-thigh', 'leg-R-shin', 'leg-R-foot']];
var out = ['dry=' + DRY], moved = 0;

for (var g = 0; g < LEGS.length; g++) {
  var names = LEGS[g], groups = [], artBoxes = [], proxBoxes = [], bad = false;
  for (var n = 0; n < names.length; n++) {
    var a = findDeep(ART, names[n], 0), p = proxyOf(names[n]);
    if (!a) { out.push('MISSING art ' + names[n]); bad = true; break; }
    if (!p) { out.push('MISSING proxy ' + names[n]); bad = true; break; }
    groups.push(a); artBoxes.push(a.geometricBounds); proxBoxes.push(p.geometricBounds);
  }
  if (bad) continue;

  var ab = union(artBoxes), pb = union(proxBoxes);
  var artH = ab[1] - ab[3], proxH = pb[1] - pb[3];
  // Scale on LENGTH: a leg that is the right length reads correctly even if it is
  // chunkier than the proxy. Scaling on width would leave it visibly too short.
  var s = proxH / artH;
  var srcCx = (ab[0] + ab[2]) / 2, srcTop = ab[1];
  var dstCx = (pb[0] + pb[2]) / 2, dstTop = pb[1];
  var tx = dstCx - srcCx * s, ty = dstTop - srcTop * s;

  out.push(names[0].substr(0, 5) + ' scale=' + s.toFixed(3) +
    ' art=' + (ab[2] - ab[0]).toFixed(0) + 'x' + artH.toFixed(0) +
    ' -> ' + ((ab[2] - ab[0]) * s).toFixed(0) + 'x' + (artH * s).toFixed(0) +
    ' (proxy ' + (pb[2] - pb[0]).toFixed(0) + 'x' + proxH.toFixed(0) + ')');

  if (DRY) continue;

  var m = app.getScaleMatrix(s * 100, s * 100);
  m = app.concatenateTranslationMatrix(m, tx, ty);
  for (var n = 0; n < groups.length; n++) {
    groups[n].transform(m, true, true, true, true, true, Transformation.DOCUMENTORIGIN);
    var slot = null;
    for (var k = 0; k < RONIN.pageItems.length; k++) if (RONIN.pageItems[k].name == names[n]) slot = RONIN.pageItems[k];
    if (!slot) { out.push('MISSING slot ' + names[n]); continue; }
    groups[n].move(slot, ElementPlacement.PLACEATEND);
    moved++;
  }
}

if (!DRY) {
  app.selection = null;
  DOC.save();
  // Slots are groups: Illustrator deletes a group when its last child leaves, and
  // moving art IN can never do that - but re-assert anyway, the count is cheap.
  out.push('Ronin slots now=' + RONIN.pageItems.length);
}
out.push(DRY ? '(dry run - nothing changed)' : 'moved ' + moved + ' groups into slots, document saved');
out.join('\n');
