// Render the Proxy layer to PNG for visual verification.
// Use a path in the user's Downloads folder which Illustrator can always write to.
var outPath = '/Users/rahulkrishanand/Downloads/v4-proxies.png';
PROXY.locked = false;
REFERENCE.visible = false;
renderPNG(outPath, [900, -250, 2250, -2280], 40);
REFERENCE.visible = true;
PROXY.locked = true;
'done:rendered ' + outPath;
