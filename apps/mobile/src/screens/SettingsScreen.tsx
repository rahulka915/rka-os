import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { HeaderStoneButton } from '../components/header/HeaderStoneButton';
import { ThemeStoneButton } from '../components/header/ThemeStoneButton';
import { DefaultDepartureSheet } from '../components/DefaultDepartureSheet';
import { useThemeContext } from '../hooks/useThemeContext';
import { useBackup } from '../hooks/useBackup';
import { getDefaultDeparturePoint, setDefaultDeparturePoint } from '../db/database';
import { Archive, ChevronLeft, CheckCircle2, Upload, Compass, MapPin } from '../icons';
import { getThemeColors, spacing } from '../theme';
import { HeroEnvironmentWorkbench } from '../components/hero/environment';

const SETTINGS_GOLD = '#D4B078';

function DevToolsSection() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [heroWorkbenchOpen, setHeroWorkbenchOpen] = useState(false);

  return (
    <>
      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DEV TOOLS</Text>
      <View style={devStyles.heroWorkbenchSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: heroWorkbenchOpen }}
          onPress={() => setHeroWorkbenchOpen((open) => !open)}
          style={[devStyles.heroWorkbenchToggle, { backgroundColor: palette.fill }]}
        >
          <Text style={[devStyles.heroWorkbenchToggleText, { color: palette.text }]}>Hero environment registration</Text>
          <Text style={[devStyles.heroWorkbenchToggleState, { color: palette.textSecondary }]}>
            {heroWorkbenchOpen ? 'Hide' : 'Open'}
          </Text>
        </Pressable>
        {heroWorkbenchOpen && <HeroEnvironmentWorkbench />}
      </View>
    </>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
  const [defaultDeparture, setDefaultDepartureState] = useState(() => getDefaultDeparturePoint());
  const [departureSheetOpen, setDepartureSheetOpen] = useState(false);
  const syncTitle = backup.isSignedIn ? 'Backup and sync' : 'Sign in to sync';
  const syncDetail = backup.error
    ? 'Backup needs attention'
    : backup.busy
      ? 'Saving your RKA OS data…'
      : backup.lastBackupAt
        ? 'Your latest backup is available'
        : backup.isSignedIn
          ? 'Create an encrypted cloud backup'
          : 'Continue from Profile to connect your account';

  const handleSyncPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (backup.isSignedIn) backup.backUpNow();
    else (navigation as any).navigate('Main', { screen: 'Profile' });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.navigationRow}>
        <HeaderStoneButton
          isDark={isDark}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            navigation.goBack();
          }}
          accessibilityLabel="Back"
          accessibilityHint="Return to Home"
        >
          <ChevronLeft size={21} color={palette.textSecondary} strokeWidth={1.9} />
        </HeaderStoneButton>
        <View style={styles.navigationTitleBlock}>
          <Text style={[styles.eyebrow, { color: SETTINGS_GOLD }]}>RKA OS</Text>
          <Text style={[styles.navigationTitle, { color: palette.text }]}>Settings</Text>
        </View>
        <View style={styles.navigationSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
      >
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>APPEARANCE</Text>
        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.settingRow}
        >
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: palette.text }]}>{isDark ? 'Dark appearance' : 'Light appearance'}</Text>
            <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>Tap the stone to change the whole app</Text>
          </View>
          <ThemeStoneButton isDark={isDark} onToggle={toggle} />
        </RiverStoneSurface>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DATA</Text>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={handleSyncPress}
          disabled={backup.busy}
          accessibilityRole="button"
          accessibilityLabel={syncTitle}
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.settingRow}
            disabled={backup.busy}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.greenSoft }]}>
              {backup.busy
                ? <ActivityIndicator size="small" color={palette.green} />
                : backup.lastBackupAt
                  ? <CheckCircle2 size={21} color={palette.green} strokeWidth={1.9} />
                  : <Upload size={21} color={palette.green} strokeWidth={1.9} />}
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>{syncTitle}</Text>
              <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>{syncDetail}</Text>
            </View>
          </RiverStoneSurface>
        </TouchableOpacity>

        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.settingRow}
        >
          <View style={[styles.iconFrame, { backgroundColor: palette.blueSoft }]}>
            <Archive size={21} color={palette.blue} strokeWidth={1.9} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: palette.text }]}>Local-first storage</Text>
            <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>Your working data remains available on this iPhone</Text>
          </View>
        </RiverStoneSurface>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>SETUP</Text>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => (navigation as any).navigate('Onboarding')}
          accessibilityRole="button"
          accessibilityLabel="Redo Setup"
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.settingRow}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.redSoft }]}>
              <Compass size={21} color={palette.red} strokeWidth={1.9} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>Redo Setup</Text>
              <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>
                Walk through Domains, Missions, Potential Stats and Focus again
              </Text>
            </View>
          </RiverStoneSurface>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PLAN BACKWARDS</Text>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setDepartureSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Default departure location"
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.settingRow}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.purpleSoft }]}>
              <MapPin size={21} color={palette.purple} strokeWidth={1.9} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>Default departure location</Text>
              <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>
                {defaultDeparture || 'Not set — prefills Travel’s "From" field'}
              </Text>
            </View>
          </RiverStoneSurface>
        </TouchableOpacity>

        {__DEV__ && <DevToolsSection />}

        <Text style={[styles.version, { color: palette.textTertiary }]}>RKA OS · Personal operating system</Text>
      </ScrollView>

      <DefaultDepartureSheet
        visible={departureSheetOpen}
        initialValue={defaultDeparture}
        onClose={() => setDepartureSheetOpen(false)}
        onSubmit={(location) => {
          setDefaultDeparturePoint(location);
          setDefaultDepartureState(location);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navigationRow: {
    minHeight: 56,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationTitleBlock: {
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  navigationTitle: {
    marginTop: 1,
    fontSize: 23,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  navigationSpacer: {
    width: 44,
    height: 44,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  sectionLabel: {
    marginTop: spacing[2],
    marginLeft: spacing[2],
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  settingRow: {
    minHeight: 76,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconFrame: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
    gap: 3,
  },
  settingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  settingDetail: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  version: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
});

const devStyles = StyleSheet.create({
  heroWorkbenchSection: {
    width: '100%',
    gap: 10,
  },
  heroWorkbenchToggle: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWorkbenchToggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  heroWorkbenchToggleState: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
