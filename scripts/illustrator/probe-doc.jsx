var out = [];
out.push('doc=' + DOC.name);
out.push('artboard=' + DOC.artboards[0].artboardRect.join(','));
for (var L = 0; L < DOC.layers.length; L++)
  out.push('layer ' + DOC.layers[L].name + ' items=' + DOC.layers[L].pageItems.length + ' locked=' + DOC.layers[L].locked);
out.join('\n');
