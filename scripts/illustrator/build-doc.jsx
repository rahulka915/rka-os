if (!RONIN) throw new Error('no Ronin layer');
if (!REFERENCE) throw new Error('no Reference layer - the copy is wrong');
RONIN.locked = false; RONIN.visible = true;
while (RONIN.pageItems.length > 0) {
  var it = RONIN.pageItems[0];
  it.locked = false; it.hidden = false; it.remove();
}
REFERENCE.locked = true; REFERENCE.visible = true;
DOC.save();
var out = ['artboard=' + DOC.artboards[0].artboardRect.join(',')];
for (var L = 0; L < DOC.layers.length; L++)
  out.push('layer ' + DOC.layers[L].name + ' items=' + DOC.layers[L].pageItems.length +
           ' locked=' + DOC.layers[L].locked);
out.join('\n');
