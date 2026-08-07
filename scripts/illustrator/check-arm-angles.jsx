// Compute approximate axis angle for each arm/leg upper segment.
// Uses the centroid of the top half vs centroid of the bottom half of geometricBounds.
function pslot(nm){ for(var k=0;k<PROXY.pageItems.length;k++) if(PROXY.pageItems[k].name==nm+'-proxy') return PROXY.pageItems[k]; return null; }
PROXY.locked = false;
var parts = ['arm-R-upper','arm-L-upper','leg-R-thigh','leg-L-thigh'];
var out = [];
for (var i=0; i<parts.length; i++) {
  var it = pslot(parts[i]);
  if (!it) { out.push(parts[i] + ': NOT FOUND'); continue; }
  var b = it.geometricBounds; // [left, top, right, bottom]
  var dx = b[2] - b[0];
  var dy = b[1] - b[3]; // top - bottom = height (positive since top > bottom in AI coords)
  // angle from vertical: atan2(horizontal_span, vertical_span)
  var angleDeg = Math.atan2(Math.abs(dx), dy) * 180 / Math.PI;
  // sign: if right edge center is to the right of left edge, positive
  var cx_top = b[0] + dx * 0.5;
  var cx_bot = b[0] + dx * 0.5;
  // For a rough axis angle, use midpoint horizontal offset vs height
  // Actually: measure the path's actual point range
  var path = it.pathItems[0];
  var pts = path.pathPoints;
  var topY = b[1], botY = b[3];
  var midY = (topY + botY) / 2;
  var topX = 0, topN = 0, botX = 0, botN = 0;
  for (var j=0; j<pts.length; j++) {
    var a = pts[j].anchor;
    if (a[1] >= midY) { topX += a[0]; topN++; }
    else { botX += a[0]; botN++; }
  }
  if (topN) topX /= topN;
  if (botN) botX /= botN;
  var axisAngle = Math.atan2(botX - topX, topY - botY) * 180 / Math.PI;
  out.push(parts[i] + ': bounds=[' + b[0].toFixed(0)+','+b[1].toFixed(0)+' '+b[2].toFixed(0)+','+b[3].toFixed(0)+'] axisAngle≈' + axisAngle.toFixed(1) + 'deg');
}
PROXY.locked = true;
out.join('\n');
