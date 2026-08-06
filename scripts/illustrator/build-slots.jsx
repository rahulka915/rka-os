RONIN.locked = false; RONIN.visible = true;
// front -> back. R is the NEAR side (back of head and pack sit at viewer-left).
// pelvis (sash) sits in FRONT of torso (gi) or it disappears entirely.
// Within a limb: thigh->shin->foot, upper->fore->hand, because boot tucks under
// the trouser cuff and hand under the sleeve (brief 3.3).
var ORDER = ['arm-R-upper','arm-R-fore','arm-R-hand',
 'head-bandana','head-hair-front','head-face','head-ear','head-hair-back',
 'streamers','sword','pelvis','torso','neck','backpack',
 'leg-R-thigh','leg-R-shin','leg-R-foot',
 'arm-L-upper','arm-L-fore','arm-L-hand',
 'leg-L-thigh','leg-L-shin','leg-L-foot'];
for (var i = 0; i < ORDER.length; i++)
  if (!slot(ORDER[i])) { var g = RONIN.groupItems.add(); g.name = ORDER[i]; }
for (var o = ORDER.length - 1; o >= 0; o--) {
  var it = slot(ORDER[o]);
  if (it) it.zOrder(ZOrderMethod.BRINGTOFRONT);
}
DOC.save();
var out = ['slots=' + RONIN.pageItems.length];
for (var k = 0; k < RONIN.pageItems.length; k++)
  out.push('  ' + k + ' ' + RONIN.pageItems[k].name + ' kids=' + RONIN.pageItems[k].pageItems.length);
out.join('\n');
