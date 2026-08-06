import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType, computeDomainScore, computeOverallPotential } from '../db/database';
import { KatanaProgress } from '../components/ui/KatanaProgress';
import { RiverStoneSurface } from '../components/riverstone';
import { RoninMonIcon } from '../components/icons/DockIcons';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import type { Item } from '../db/types';

const PROFILE_BLUE = '#2b7ff0';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [overall, setOverall] = useState(0);
  const [domains, setDomains] = useState<Array<Item & { score: number }>>([]);

  const load = useCallback(() => {
    const areas = getItemsByType('area');
    setDomains(areas.map((area) => ({ ...area, score: computeDomainScore(area.id) })));
    setOverall(computeOverallPotential());
  }, []);

  useFocusEffect(load);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top - 14, 0) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
      >
        <RiverStoneSurface
          variant="header"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={styles.headerStone}
          contentStyle={styles.headerContent}
          background={
            <View style={styles.headerMotif} pointerEvents="none">
              <RoninMonIcon size={128} color={`${PROFILE_BLUE}1f`} />
            </View>
          }
        >
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: PROFILE_BLUE }]}>YOUR ACCOUNT</Text>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Me</Text>
            <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
              Settings & Account Info
            </Text>
          </View>
        </RiverStoneSurface>

        {/* Potential */}
        <TouchableOpacity
          style={styles.statsContainer}
          activeOpacity={0.75}
          onPress={() => (navigation as any).navigate('Potential')}
          accessibilityRole="button"
          accessibilityLabel={`Overall Potential ${Math.round(overall)}%. Open Potential`}
        >
          <Text style={[styles.sectionLabel, { color: palette.antiqueBrass }]}>POTENTIAL</Text>
          <View style={[styles.statsCard, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderRadius: 18 }]}>
            <View style={[styles.statRow, domains.length > 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.separator, paddingBottom: 16 }]}>
              <View style={styles.statHeaderRow}>
                <Text style={[styles.statLabel, { color: palette.text }]}>Overall</Text>
                <Text style={[styles.statPercent, { color: palette.vermilion }]}>{Math.round(overall)}%</Text>
              </View>
              <KatanaProgress progress={overall / 100} size={16} accessibilityLabel="Overall potential" />
            </View>
            {domains.map((domain, index) => {
              const isLast = index === domains.length - 1;
              return (
                <View key={domain.id} style={[styles.statRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.separator, paddingBottom: 16 }]}>
                  <View style={styles.statHeaderRow}>
                    <Text style={[styles.statLabel, { color: palette.text }]}>{domain.title}</Text>
                    <Text style={[styles.statPercent, { color: palette.textTertiary }]}>{Math.round(domain.score)}%</Text>
                  </View>
                  <KatanaProgress progress={domain.score / 100} size={16} accessibilityLabel={`${domain.title} potential`} />
                </View>
              );
            })}
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[2],
    gap: spacing[3],
  },
  headerStone: {
    minHeight: 94,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerMotif: {
    position: 'absolute',
    right: 8,
    top: -8,
  },
  headerCopy: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 23,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  statsContainer: {
    marginTop: spacing[2],
  },
  sectionLabel: {
    marginLeft: spacing[2],
    marginBottom: spacing[2],
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statsCard: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: 16,
  },
  statRow: { 
    gap: 8,
  },
  statHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline' 
  },
  statLabel: { 
    fontSize: 16, 
    fontFamily: 'Inter_700Bold',
    fontWeight: '700' 
  },
  statPercent: { 
    fontSize: 14, 
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600' 
  },
  statSubtext: { 
    fontSize: 13, 
    fontFamily: 'Inter_400Regular',
    fontWeight: '400' 
  },
});
