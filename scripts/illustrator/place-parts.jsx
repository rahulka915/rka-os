// Move named art groups onto the artboard and into their rig slots.
//
// Differs from the earlier place-legs.jsx on purpose. That scaled each leg
// SEPARATELY to its own proxy height, which put the two legs at different scales
// (2.718 vs 2.860) and centred each on a proxy narrower than the art, so they
// collided. Here ONE transform is derived from every part at once and applied to
// all of them, so the character's internal proportions - and every relationship
// between parts - survive exactly as assembled on the sheet.
//
// The proxies are used only to choose a target box. They are not fitted to:
// the rig's joints come from the art (see the walk cycle), not from the proxies.
// __LAYER__ / __PARTS__ / __DRY__ are substituted by place-parts.sh.
var LAYER = '__LAYER__', DRY = __DRY__;
var PARTS = __PARTS__;   // [] means "every slot name that has art on LAYER"

var ART = null;
for (var i = 0; i < DOC.layers.length; i++) if (DOC.layers[i].name == LAYER) ART = DOC.layers[i];
if (!ART) throw new Error('no layer named ' + LAYER);
if (ART.locked) throw new Error('layer ' + LAYER + ' is locked');

function findDeep(container, nm, depth) {
  for (var i = 0; i < container.pageItems.length; i++) {
    var it = container.pageItems[i];
    if (it.name == nm) return it;
    if (it.typename == 'GroupItem' && depth < 4) { var r = findDeep(it, nm, depth + 1); if (r) return r; }
  }
  return null;
}

// The slot list is the authority for what a valid part name is.
var slotNames = [];
for (var i = 0; i < RONIN.pageItems.length; i++) slotNames.push(RONIN.pageItems[i].name);
var wanted = PARTS.length ? PARTS : slotNames;

var found = [], out = ['layer=' + LAYER + ' dry=' + DRY];
for (var i = 0; i < wanted.length; i++) {
  var nm = wanted[i], g = findDeep(ART, nm, 0);
  if (!g) { if (PARTS.length) out.push('MISSING art for ' + nm); continue; }
  found.push({ name: nm, group: g, b: g.geometricBounds });
}
if (!found.length) throw new Error('no named art found on ' + LAYER);

function unionOf(list, key) {
  var b = [list[0][key][0], list[0][key][1], list[0][key][2], list[0][key][3]];
  for (var i = 1; i < list.length; i++) {
    var q = list[i][key];
    if (q[0] < b[0]) b[0] = q[0];
    if (q[1] > b[1]) b[1] = q[1];
    if (q[2] > b[2]) b[2] = q[2];
    if (q[3] < b[3]) b[3] = q[3];
  }
  return b;
}
var ab = unionOf(found, 'b');

// Target box: the whole Proxy layer's footprint - where a character belongs on
// this canvas - falling back to the artboard inset by 10%.
var pb = null;
if (PROXY && PROXY.pageItems.length) {
  var plist = [];
  for (var i = 0; i < PROXY.pageItems.length; i++) plist.push({ b: PROXY.pageItems[i].geometricBounds });
  pb = unionOf(plist, 'b');
} else {
  pb = [250, -250, 2250, -2250];
}

var artW = ab[2] - ab[0], artH = ab[1] - ab[3];
var tgtW = pb[2] - pb[0], tgtH = pb[1] - pb[3];
// Uniform: the smaller ratio, so nothing overflows the target box.
var s = Math.min(tgtW / artW, tgtH / artH);
var tx = (pb[0] + pb[2]) / 2 - ((ab[0] + ab[2]) / 2) * s;
var ty = (pb[1] + pb[3]) / 2 - ((ab[1] + ab[3]) / 2) * s;

out.push('parts=' + found.length + ' scale=' + s.toFixed(4) +
  ' art ' + artW.toFixed(0) + 'x' + artH.toFixed(0) +
  ' -> ' + (artW * s).toFixed(0) + 'x' + (artH * s).toFixed(0) +
  ' (target ' + tgtW.toFixed(0) + 'x' + tgtH.toFixed(0) + ')');

if (!DRY) {
  var m = app.getScaleMatrix(s * 100, s * 100);
  m = app.concatenateTranslationMatrix(m, tx, ty);
  var moved = 0;
  for (var i = 0; i < found.length; i++) {
    found[i].group.transform(m, true, true, true, true, true, Transformation.DOCUMENTORIGIN);
    var slot = null;
    for (var k = 0; k < RONIN.pageItems.length; k++)
      if (RONIN.pageItems[k].name == found[i].name) slot = RONIN.pageItems[k];
    if (!slot) { out.push('MISSING slot ' + found[i].name); continue; }
    found[i].group.move(slot, ElementPlacement.PLACEATEND);
    moved++;
  }
  app.selection = null;
  DOC.save();
  out.push('moved ' + moved + ' into slots; Ronin slots=' + RONIN.pageItems.length);
} else {
  for (var i = 0; i < found.length; i++) out.push('  ' + found[i].name);
  out.push('(dry run - nothing changed)');
}
out.join('\n');
