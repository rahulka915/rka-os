import 'react-native-get-random-values';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useColorScheme, TouchableOpacity, View, StyleSheet, AppState, Text as RNText, LogBox } from 'react-native';

// Home and Tasks nest reorderable lists inside react-native-reorderable-list's
// ScrollViewContainer, which is an Animated.ScrollView rather than a
// VirtualizedList-backed container — so React Native emits this warning even
// though it is the library's own supported nesting pattern and it coordinates
// the scrolling itself. The previous drag library suppressed the identical log
// internally, which is why it only started appearing after the migration.
// Suppressed here so it stops burying real errors in the console.
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews',
]);
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  TorriHomeIcon, SunDialCalendarIcon, EnsoMoreIcon, RoninMonIcon,
} from './src/components/icons/DockIcons';
import { FabControl } from './src/components/fab/FabControl';
import { TabBarTray } from './src/components/ui/TabBarTray';
import { riverStoneMaterial, TRAY_BOTTOM_OFFSET_REDUCTION } from './src/theme';

import config from './tamagui.config';
import { ThemeContext } from './src/hooks/useThemeContext';
import { UIModeContext, useUIModeContext } from './src/hooks/useUIModeContext';
import { FabHoldContext } from './src/hooks/useFabHoldAction';
import { HomeScreen } from './src/screens/HomeScreen';
import { HomeScreenExperimental } from './src/screens/HomeScreenExperimental';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { MenuStack } from './src/navigation/MenuStack';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { InboxScreenV2 } from './src/screens/InboxScreenV2';
import { ItemComposerProvider, useItemComposer } from './src/components/item-composer';
import { OverlayHostProvider } from './src/hooks/useOverlayHost';
import { PersistentTimerBanner } from './src/components/PersistentTimerBanner';
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
import { requestNotificationPermission, setBadgeCount } from './src/hooks/useNotifications';
import { getInboxItems, getDb } from './src/db/database';
import { registerBackgroundSync } from './src/services/backgroundSync';
import { requestLocationPermission } from './src/services/locationReminders';
import { auth, hasFirebaseConfig } from './src/lib/firebase';
import { pushBackup } from './src/services/backupSync';
import { reconcileMedicationTimers } from './src/services/medicationTimerController';
import { BackupProvider } from './src/hooks/useBackup';

getDb();

// Held until the Inter font weights finish loading, so the app never
// flashes with the system fallback font on cold start.
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// Icon-only dock. First generation (simple stroke silhouettes) came from a
// design session per ~/.codex/visualizations/.../RKA_OS_ICON_MOCKUP_HANDOFF.md
// — that handoff's "persistent section color" option (every icon always
// colored) was tried on-device and replaced with the doc's other option,
// "selected-color state": icons stay neutral at rest, section color only
// shows on the focused tab (unchanged by the redraw below). Second
// generation (bolder filled-path redraw, commissioned asset packs) swapped
// Menu's "layers" concept for an ensō (Zen circle) and Profile's "personal
// seal" hexagon for a ronin mon/portrait silhouette.
const TAB_ITEMS = [
  { name: 'Home',     Icon: TorriHomeIcon,        color: '#C44545' },
  { name: 'Calendar', Icon: SunDialCalendarIcon,  color: '#D4B078' },
  { name: 'Menu',     Icon: EnsoMoreIcon,         color: '#4E9E86' },
  { name: 'Profile',  Icon: RoninMonIcon,         color: '#2b7ff0' },
];

function AppleTabBar({ state, navigation, isDark, onFabPress, onFabHold }: any) {
  const insets = useSafeAreaInsets();
  const inactiveColor = isDark ? 'rgba(242,237,230,0.55)' : 'rgba(23,23,28,0.45)';

  // The tray uses the shared graphite/pale-stone base at near-opaque alpha;
  // its shape, light model, and depth come from TabBarTray.
  const bgColor = isDark
    ? `${riverStoneMaterial.dark.base}fa`
    : `${riverStoneMaterial.light.base}fa`;

  return (
    <View style={[styles.tabBarOuter, { bottom: Math.max(insets.bottom - TRAY_BOTTOM_OFFSET_REDUCTION, 0) }]}>
      <TabBarTray isDark={isDark} backgroundColor={bgColor}>
        <View style={styles.tabBarInner}>
        {/* Tabs */}
        <View style={styles.tabsRow}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const { Icon, color } = TAB_ITEMS.find(t => t.name === route.name)!;

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Menu wraps a nested stack (MenuStack) — the custom tab bar
                  // bypasses React Navigation's built-in "tap active tab again to
                  // pop to root" behavior, so replicate it here by explicitly
                  // navigating to the stack's root screen when already on Menu.
                  if (isFocused && route.name === 'Menu') {
                    navigation.navigate('Menu', { screen: 'MenuHome' });
                  } else {
                    navigation.navigate(route.name);
                  }
                }}
                style={styles.tabItem}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={route.name}
              >
                <View style={[styles.tabIconBadge, isFocused && { backgroundColor: color + '22' }]}>
                  <Icon size={25} color={isFocused ? color : inactiveColor} strokeWidth={isFocused ? 2 : 1.6} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FAB — lives above tab bar, right-aligned. Tap is always generic
            Create with route-aware defaults; a
            long-press runs the current screen's distinct create action, if
            it registered one (see useRegisterFabHoldAction) — this replaces
            what used to be a separate top-right "+" per lens screen. */}
        <FabControl
          size={52}
          onPress={() => {
            onFabPress();
          }}
          onLongPress={() => {
            return onFabHold();
          }}
          delayLongPress={400}
          accessibilityLabel="Create"
          style={styles.fab}
        />
        </View>
      </TabBarTray>
    </View>
  );
}

// Global default so any <Text> without an explicit fontFamily (i.e. no
// custom weight override) picks up Inter_400Regular instead of the system
// font. This does NOT fix bold/semibold text elsewhere — RN doesn't
// synthesize weight variants for custom fonts, so every fontWeight: '500'/
// '600'/'700'/'800' in a StyleSheet still needs its own matching
// Inter_*Weight fontFamily set explicitly (see DESIGN_CHECKLIST.md
// "Typography" section for the full pass that did this).
// defaultProps exists on the RN Text component at runtime even though its
// official type doesn't declare it — cast once to avoid repeated ts-ignores.
const RNTextAny = RNText as unknown as { defaultProps?: { style?: unknown } };
RNTextAny.defaultProps = {
  ...RNTextAny.defaultProps,
  style: [{ fontFamily: 'Inter_400Regular' }, RNTextAny.defaultProps?.style],
};

function NavigationLayer({
  isDark,
  inboxOpen,
  setInboxOpen,
  onFabHold,
}: {
  isDark: boolean;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
  onFabHold: () => boolean;
}) {
  const navigationRef = useNavigationContainerRef();
  const { openCapture } = useItemComposer();
  const { isExperimentalHome } = useUIModeContext();

  const openQuickCapture = () => {
    const route = navigationRef.getCurrentRoute();
    if (route?.name === 'ProjectDetail') {
      const params = route.params as { projectId?: string; title?: string } | undefined;
      openCapture({
        context: {
          status: 'active',
          projectId: params?.projectId,
          projectTitle: params?.title,
        },
      });
      return;
    }
    openCapture({ context: { status: route?.name === 'Tasks' ? 'active' : 'inbox' } });
  };

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main">
            {() => (
              <Tab.Navigator
                tabBar={(props) => (
                  <AppleTabBar
                    {...props}
                    isDark={isDark}
                    onFabPress={openQuickCapture}
                    onFabHold={onFabHold}
                  />
                )}
                screenOptions={{ headerShown: false }}
              >
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    isExperimentalHome ? (
                      <HomeScreenExperimental />
                    ) : (
                      <HomeScreen
                        onInboxPress={() => setInboxOpen(true)}
                        inboxOpen={inboxOpen}
                        onHeroPress={() => navigation.navigate('Profile')}
                        onSettingsPress={() => (navigation.getParent() as any)?.navigate('Settings')}
                      />
                    )
                  )}
                </Tab.Screen>
                <Tab.Screen name="Calendar" component={CalendarScreen} />
                <Tab.Screen name="Menu">{() => <MenuStack />}</Tab.Screen>
                <Tab.Screen name="Profile" component={ProfileScreen} />
              </Tab.Navigator>
            )}
          </RootStack.Screen>
          <RootStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </RootStack.Navigator>
      </NavigationContainer>

      <InboxScreenV2 visible={inboxOpen} onClose={() => setInboxOpen(false)} />
      <PersistentTimerBanner />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const systemScheme = useColorScheme();
  const [manualDark, setManualDark] = useState<boolean | null>(true);
  const isDark = manualDark !== null ? manualDark : systemScheme === 'dark';

  const [inboxOpen, setInboxOpen] = useState(false);
  const holdActionRef = useRef<(() => void) | null>(null);
  const setHoldAction = useCallback((action: (() => void) | null) => {
    holdActionRef.current = action;
  }, []);
  const fabHoldCtx = useMemo(() => ({ setHoldAction }), [setHoldAction]);

  // Returns whether a hold action actually ran, so the FAB only fires
  // haptics when the long-press did something.
  const runFabHold = () => {
    const action = holdActionRef.current;
    if (!action) return false;
    action();
    return true;
  };

  const themeCtx = useMemo(() => ({
    isDark,
    toggle: () => setManualDark(d => d === null ? !(systemScheme === 'dark') : !d),
  }), [isDark, systemScheme]);

  const [isExperimentalHome, setIsExperimentalHome] = useState(false);
  const uiModeCtx = useMemo(() => ({
    isExperimentalHome,
    toggle: () => setIsExperimentalHome((v) => !v),
  }), [isExperimentalHome]);

  useEffect(() => {
    async function init() {
      await reconcileMedicationTimers().catch(() => {});
      const granted = await requestNotificationPermission();
      if (granted) setBadgeCount(getInboxItems().length);
      await registerBackgroundSync();
      await requestLocationPermission().catch(() => {});
    }
    init();
  }, []);

  useEffect(() => {
    if (!inboxOpen) setBadgeCount(getInboxItems().length);
  }, [inboxOpen]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        await reconcileMedicationTimers().catch(() => {});
        return;
      }
      if (nextState !== 'background' && nextState !== 'inactive') return;
      if (!hasFirebaseConfig || !auth) return;

      try {
        const user = auth.currentUser;
        if (user) {
          await pushBackup(user.uid);
        }
      } catch (err) {
        console.warn('[backup] background push failed', err);
      }
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return <AppLoadingScreen />;
  }

  return (
    <ThemeContext.Provider value={themeCtx}>
      <UIModeContext.Provider value={uiModeCtx}>
      <BackupProvider>
      <FabHoldContext.Provider value={fabHoldCtx}>
      <TamaguiProvider config={config as any} defaultTheme={isDark ? 'dark' : 'light'}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            {/* Overlay host — BottomSheet teleports here as a sibling rendered after
                NavigationLayer, the same position InboxScreenV2/CaptureSheet use, so it
                always paints above the tab bar regardless of which tab it's opened from. */}
            <OverlayHostProvider>
              <ItemComposerProvider>
                <NavigationLayer
                  isDark={isDark}
                  inboxOpen={inboxOpen}
                  setInboxOpen={setInboxOpen}
                  onFabHold={runFabHold}
                />
              </ItemComposerProvider>
            </OverlayHostProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </TamaguiProvider>
      </FabHoldContext.Provider>
      </BackupProvider>
      </UIModeContext.Provider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Floating tray (River Stone signature nav shape) — margins on the sides,
  // flush to the true bottom edge; TabBarTray's broad curved recess exposes
  // the real system home indicator instead of covering it.
  tabBarOuter: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    // Slightly taller tray body per the paint-over review — gives the notch
    // more stone around it instead of feeling paper-thin.
    paddingBottom: 14,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  tabIconBadge: {
    width: 46,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    marginBottom: 2,
    marginLeft: 2,
    marginRight: 8,
  },
});
