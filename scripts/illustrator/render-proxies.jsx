// Render the Proxy layer to PNG for visual verification.
// Temporarily unlocks PROXY (locked after build step), hides REFERENCE, exports, restores.
PROXY.locked = false;
REFERENCE.visible = false;
renderPNG('/tmp/v4-proxies.png', [900, -250, 2250, -2280], 40);
REFERENCE.visible = true;
PROXY.locked = true;
'done:rendered /tmp/v4-proxies.png';
