import { createNavigationContainerRef } from '@react-navigation/native';

// Module-level (not a hook) so screens rendered outside the NavigationContainer's
// own tree — InboxScreenV2, overlays hosted by useOverlayHost — can still push a
// screen. useNavigation() only works for components mounted inside
// NavigationContainer; this ref works from anywhere once the container mounts.
export const navigationRef = createNavigationContainerRef();

export function navigateTo(name: string, params?: object) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  }
}
