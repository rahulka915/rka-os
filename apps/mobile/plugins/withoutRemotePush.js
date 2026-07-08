const { withEntitlementsPlist } = require('@expo/config-plugins');

// expo-notifications' config plugin unconditionally adds the `aps-environment`
// entitlement (see node_modules/expo-notifications/plugin/build/withNotificationsIOS.js),
// which requires the app's provisioning profile to have the Push Notifications
// capability. This app only ever uses local scheduled notifications (reminders,
// background sync) — never registers for or receives remote push — so the
// capability isn't functionally needed. Stripping it removes the dependency on
// Apple's provisioning-profile/capability propagation entirely, which has been
// an unreliable, slow-to-regenerate blocker for builds.
//
// Registered FIRST in app.json's plugins array (counterintuitively) — Expo's
// mod composition for withEntitlementsPlist runs in the REVERSE of plugin
// registration order, so registering this before expo-notifications makes it
// execute after expo-notifications' own mod has added the entitlement.
// Verified empirically with console.log: this mod saw `{}` (empty) when
// registered last, and saw the entitlement already present (and correctly
// stripped it) when registered first.
module.exports = function withoutRemotePush(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
