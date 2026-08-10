module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Tamagui's static extractor currently tries to require React Native's
    // untranspiled Pressability internals under Node during Metro transforms,
    // which spams parse errors and slows cold starts. Runtime Tamagui works
    // without the optional extractor.
    plugins: ['react-native-reanimated/plugin'],
  };
};
