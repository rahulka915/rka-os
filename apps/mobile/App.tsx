import 'react-native-get-random-values';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useColorScheme, TouchableOpacity, View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  TorriHomeIcon, SunDialCalendarIcon, LayersMoreIcon, PersonalSealMeIcon, CalligraphyBrushIcon,
} from './src/components/icons/DockIcons';

import config from './tamagui.config';
import { ThemeContext } from './src/hooks/useThemeContext';
import { FabHoldContext } from './src/hooks/useFabHoldAction';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { MenuStack } from './src/navigation/MenuStack';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { InboxScreenV2 } from './src/screens/InboxScreenV2';
import { QuickAddScreen, type QuickAddContext } from './src/screens/QuickAddScreen';
import { PersistentTimerBanner } from './src/components/PersistentTimerBanner';
import { requestNotificationPermission, setBadgeCount } from './src/hooks/useNotifications';
import { getInboxItems, getDb } from './src/db/database';
import { registerBackgroundSync } from './src/services/backgroundSync';
import { requestLocationPermission } from './src/services/locationReminders';
import { supabase, hasSupabaseConfig } from './src/lib/supabase';
import { pushBackup } from './src/services/backupSync';

getDb();

const Tab = createBottomTabNavigator();

// Icon-only dock with persistent per-section colors — approved design
// direction, see ~/.codex/visualizations/.../RKA_OS_ICON_MOCKUP_HANDOFF.md.
// Each icon keeps its assigned color at rest (not just when focused); the
// focused tab additionally gets a soft rounded badge in that same color so
// there's still a clear "you are here" signal without a text label.
const TAB_ITEMS = [
  { name: 'Home',     Icon: TorriHomeIcon,        color: '#C44545' },
  { name: 'Calendar', Icon: SunDialCalendarIcon,  color: '#D4B078' },
  { name: 'Menu',     Icon: LayersMoreIcon,       color: '#4E9E86' },
  { name: 'Profile',  Icon: PersonalSealMeIcon,   color: '#2b7ff0' },
];

function AppleTabBar({ state, navigation, isDark, onFabPress, onFabHold }: any) {
  const insets = useSafeAreaInsets();
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,20,30,0.08)';

  // Derived from the theme bg tokens (#0f0f1a / #f6f5f1) instead of the old
  // near-black/near-white pair.
  const bgColor = isDark ? 'rgba(15,15,26,0.96)' : 'rgba(246,245,241,0.97)';

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom, borderTopColor: borderColor, backgroundColor: bgColor }]}>

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
                  navigation.navigate(route.name);
                }}
                style={styles.tabItem}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={route.name}
              >
                <View style={[styles.tabIconBadge, isFocused && { backgroundColor: color + '22' }]}>
                  <Icon size={22} color={color} strokeWidth={isFocused ? 2 : 1.6} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FAB — lives above tab bar, right-aligned. Tap is always generic
            Create (context-aware defaults, see App.tsx openQuickAdd); a
            long-press runs the current screen's distinct create action, if
            it registered one (see useRegisterFabHoldAction) — this replaces
            what used to be a separate top-right "+" per lens screen. */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onFabPress();
          }}
          onLongPress={() => {
            if (!onFabHold()) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel="Create"
          // RKA blue in both modes — Create is the one dock element that
          // doesn't follow persistent section color, it's the primary action.
          style={[styles.fab, { backgroundColor: '#2b7ff0' }, isDark && styles.fabGlow]}
          activeOpacity={0.85}
        >
          <CalligraphyBrushIcon size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const systemScheme = useColorScheme();
  const [manualDark, setManualDark] = useState<boolean | null>(true);
  const isDark = manualDark !== null ? manualDark : systemScheme === 'dark';

  const [inboxOpen, setInboxOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddContext, setQuickAddContext] = useState<QuickAddContext>({});
  const navigationRef = useNavigationContainerRef();
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

  // The dock FAB is always "Create" — this reads the currently focused route
  // (across nested navigators) to supply sensible defaults instead of
  // maintaining a second, differently-styled "+" per screen. Extend this
  // switch as more lenses gain their own contextual defaults (Areas, a
  // Today/time-block view, etc.) — currently only Tasks and ProjectDetail
  // have real context to offer.
  const openQuickAdd = () => {
    const route = navigationRef.getCurrentRoute();
    if (route?.name === 'ProjectDetail') {
      const params = route.params as { projectId?: string; title?: string } | undefined;
      setQuickAddContext({
        status: 'active',
        projectId: params?.projectId,
        projectTitle: params?.title,
      });
    } else if (route?.name === 'Tasks') {
      setQuickAddContext({ status: 'active' });
    } else {
      setQuickAddContext({});
    }
    setQuickAddOpen(true);
  };

  const themeCtx = useMemo(() => ({
    isDark,
    toggle: () => setManualDark(d => d === null ? !(systemScheme === 'dark') : !d),
  }), [isDark, systemScheme]);

  useEffect(() => {
    async function init() {
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
      if (nextState !== 'background' && nextState !== 'inactive') return;
      if (!hasSupabaseConfig || !supabase) return;

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await pushBackup(data.session.user.id);
        }
      } catch (err) {
        console.warn('[backup] background push failed', err);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={themeCtx}>
      <FabHoldContext.Provider value={fabHoldCtx}>
      <TamaguiProvider config={config as any} defaultTheme={isDark ? 'dark' : 'light'}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <NavigationContainer ref={navigationRef}>
              <Tab.Navigator
                tabBar={(props) => (
                  <AppleTabBar
                    {...props}
                    isDark={isDark}
                    onFabPress={openQuickAdd}
                    onFabHold={runFabHold}
                  />
                )}
                screenOptions={{ headerShown: false }}
              >
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    <HomeScreen
                      onInboxPress={() => setInboxOpen(true)}
                      inboxOpen={inboxOpen}
                      onHeroPress={() => navigation.navigate('Profile')}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen name="Calendar" component={CalendarScreen} />
                <Tab.Screen name="Menu">
                  {() => <MenuStack />}
                </Tab.Screen>
                <Tab.Screen name="Profile" component={ProfileScreen} />
              </Tab.Navigator>
            </NavigationContainer>

            {/* Sheets — rendered above navigation, inside GestureHandlerRootView */}
            <InboxScreenV2 visible={inboxOpen} onClose={() => setInboxOpen(false)} />
            <QuickAddScreen visible={quickAddOpen} onClose={() => setQuickAddOpen(false)} context={quickAddContext} />
          </GestureHandlerRootView>

          {/* Timer always on top of everything */}
          <PersistentTimerBanner />
        </SafeAreaProvider>
      </TamaguiProvider>
      </FabHoldContext.Provider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabIconBadge: {
    width: 40,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    marginLeft: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGlow: {
    shadowColor: '#2b7ff0',
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
});
