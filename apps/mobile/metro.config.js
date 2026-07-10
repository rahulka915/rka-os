const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D model assets (Ronin companion GLB) — not in Metro's default asset list.
config.resolver.assetExts.push('glb');

module.exports = config;
