const { withXcodeProject } = require('@expo/config-plugins');

// Apple's IPA export validation requires every embedded app extension's
// CFBundleVersion/MARKETING_VERSION to exactly match the containing app's.
// expo-widgets' own config plugin sometimes resolves the widget target's
// MARKETING_VERSION to a stale "1.0" fallback instead of app.json's real
// version, which fails export with "lost connection to worker" on EAS
// (the underlying fastlane/export process crashes rather than reporting
// the Apple validation error cleanly). This forces every build
// configuration in the Xcode project (all targets) to the same version,
// so the app and the widget extension can never drift apart.
module.exports = function withWidgetVersionSync(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const marketingVersion = config.version ?? '1.0.0';
    const buildNumber = config.ios?.buildNumber ?? '1';
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in configurations) {
      const entry = configurations[key];
      if (entry && entry.buildSettings) {
        entry.buildSettings.MARKETING_VERSION = `"${marketingVersion}"`;
        entry.buildSettings.CURRENT_PROJECT_VERSION = `"${buildNumber}"`;
      }
    }

    return config;
  });
};
