// Render a zoomed crop of just the arm/torso region for verification.
var outPath = '/Users/rahulkrishanand/Downloads/v4-proxies-arms.png';
PROXY.locked = false;
REFERENCE.visible = false;
// Crop to torso+arms region: x 1250-2000, y -900 to -1600
renderPNG(outPath, [1250, -900, 2000, -1600], 80);
REFERENCE.visible = true;
PROXY.locked = true;
'done:rendered ' + outPath;
