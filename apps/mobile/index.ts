import 'expo-dev-client';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in a dev client or native build,
// the environment is set up appropriately
registerRootComponent(App);
