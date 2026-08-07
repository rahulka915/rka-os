// Rename top-level groups on a layer, matching by exact current name.
// Slot names become SVG ids and then Rive shape names verbatim, so this refuses
// anything that is not already a valid slot name - a typo here ships to runtime.
// __LAYER__ / __PAIRS__ / __DRY__ are substituted by rename-parts.sh.
var LAYER = '__LAYER__', DRY = __DRY__;
var PAIRS = __PAIRS__;   // [["current name", "slot-name"], ...]

var L = null;
for (var i = 0; i < DOC.layers.length; i++) if (DOC.layers[i].name == LAYER) L = DOC.layers[i];
if (!L) throw new Error('no layer named ' + LAYER);

// The slot list is the authority: read it from the Ronin layer rather than
// hardcoding, so this cannot drift from the document.
var VALID = {};
for (var i = 0; i < RONIN.pageItems.length; i++) VALID[RONIN.pageItems[i].name] = true;

var out = ['layer=' + LAYER + ' dry=' + DRY], applied = 0, problems = 0;

for (var p = 0; p < PAIRS.length; p++) {
  var from = PAIRS[p][0], to = PAIRS[p][1];
  if (!VALID[to]) { out.push('REFUSED "' + from + '" -> "' + to + '" : not a slot name'); problems++; continue; }
  var hits = [];
  for (var i = 0; i < L.pageItems.length; i++) if (L.pageItems[i].name == from) hits.push(L.pageItems[i]);
  if (hits.length === 0) { out.push('MISSING "' + from + '" : no item with that name'); problems++; continue; }
  if (hits.length > 1) { out.push('AMBIGUOUS "' + from + '" : ' + hits.length + ' items share it'); problems++; continue; }
  // Renaming onto a name another item already holds would make the next run ambiguous.
  var clash = false;
  for (var i = 0; i < L.pageItems.length; i++)
    if (L.pageItems[i].name == to && L.pageItems[i] != hits[0]) clash = true;
  if (clash) { out.push('CLASH "' + from + '" -> "' + to + '" : name already taken'); problems++; continue; }
  var b = hits[0].geometricBounds;
  out.push('"' + from + '" -> "' + to + '" (' + leaves(hits[0]) + ' paths, ' +
    (b[2] - b[0]).toFixed(0) + 'x' + (b[1] - b[3]).toFixed(0) + ')');
  if (!DRY) { hits[0].name = to; applied++; }
}

if (!DRY && applied > 0) { app.selection = null; DOC.save(); }
out.push(DRY ? '(dry run - nothing changed)' : 'renamed ' + applied + ', problems ' + problems);
out.join('\n');
