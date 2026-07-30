import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  // expo-dev-client is native-only (dev-client/EAS builds) — it has no web
  // implementation, and importing it unconditionally breaks the web bundle
  // before registerRootComponent ever runs.
  require('expo-dev-client');
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in a dev client or native build,
// the environment is set up appropriately
registerRootComponent(App);
