function hex(it) {
  try {
    if (!it.filled) return 'none';
    var c = it.fillColor;
    if (c.typename != 'RGBColor') return 'other';
    return ((1<<24) + (Math.round(c.red)<<16) + (Math.round(c.green)<<8) + Math.round(c.blue)).toString(16).substr(1);
  } catch (e) { return 'err'; }
}
var rows = [], id = 0;
for (var s = 0; s < RONIN.pageItems.length; s++) {
  var g = RONIN.pageItems[s], nm = g.name;
  (function walk(gr) {
    for (var i = 0; i < gr.pageItems.length; i++) {
      var it = gr.pageItems[i];
      if (it.typename == 'GroupItem') { walk(it); continue; }
      var b = it.geometricBounds, pts = [];
      if (it.typename == 'PathItem') {
        var n = it.pathPoints.length, step = (n > 40) ? Math.ceil(n/40) : 1;
        for (var p = 0; p < n; p += step) {
          var a = it.pathPoints[p].anchor;
          pts.push('[' + a[0].toFixed(0) + ',' + a[1].toFixed(0) + ']');
        }
      }
      rows.push('{"i":' + (id++) + ',"slot":"' + nm + '","c":"' + hex(it) +
        '","b":[' + b[0].toFixed(0) + ',' + b[1].toFixed(0) + ',' + b[2].toFixed(0) + ',' + b[3].toFixed(0) +
        '],"pts":[' + pts.join(',') + ']}');
    }
  })(g);
}
// Emit proxy POLYGONS, not just bboxes. Bbox overlap cannot tell a legitimately
// nested part (head-face sits wholly inside head-hair-back's box) from a path
// genuinely shared between two rig parts - which is the thing the gates exist to catch.
var px = [];
for (var k = 0; k < PROXY.pageItems.length; k++) {
  var g = PROXY.pageItems[k], b = g.geometricBounds, polys = [];
  (function walk(x) {
    if (x.typename == 'GroupItem') { for (var i=0;i<x.pageItems.length;i++) walk(x.pageItems[i]); return; }
    if (x.typename != 'PathItem') return;
    var pts = [];
    for (var p = 0; p < x.pathPoints.length; p++) {
      var a = x.pathPoints[p].anchor;
      pts.push('[' + a[0].toFixed(0) + ',' + a[1].toFixed(0) + ']');
    }
    if (pts.length >= 3) polys.push('[' + pts.join(',') + ']');
  })(g);
  px.push('"' + g.name.replace('-proxy','') + '":{"b":[' +
    b[0].toFixed(0) + ',' + b[1].toFixed(0) + ',' + b[2].toFixed(0) + ',' + b[3].toFixed(0) +
    '],"polys":[' + polys.join(',') + ']}');
}
var f = new File(TMP + 'v4-parts.json');
f.open('w'); f.write('{"proxies":{' + px.join(',') + '},"paths":[' + rows.join(',\n') + ']}'); f.close();
'dumped ' + rows.length + ' paths, ' + PROXY.pageItems.length + ' proxies';
