const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Native art assets used by the Ronin companion and journey runtime.
config.resolver.assetExts.push('glb', 'riv');

module.exports = config;
