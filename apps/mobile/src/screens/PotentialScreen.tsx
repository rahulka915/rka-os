import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType, computeDomainScore, computeOverallPotential, getFocus } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { KatanaProgress } from '../components/ui/KatanaProgress';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import type { Item } from '../db/types';
import type { FocusData } from '../db/database';

export function PotentialScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [overall, setOverall] = useState(0);
  const [domains, setDomains] = useState<Array<Item & { score: number }>>([]);
  const [focus, setFocus] = useState<FocusData | null>(null);

  const load = useCallback(() => {
    const areas = getItemsByType('area');
    setDomains(areas.map((area) => ({ ...area, score: computeDomainScore(area.id) })));
    setOverall(computeOverallPotential());
    setFocus(getFocus());
  }, []);

  useFocusEffect(load);

  return (
    <LensSurface title="Potential">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.overallSection}>
          <View style={styles.overallHeaderRow}>
            <Text style={[styles.overallLabel, { color: palette.textTertiary }]}>OVERALL POTENTIAL</Text>
            <Text style={[styles.overallPercent, { color: palette.text }]}>{Math.round(overall)}%</Text>
          </View>
          <KatanaProgress progress={overall / 100} size={20} accessibilityLabel="Overall potential" />
          <Text style={[styles.overallSubtext, { color: palette.textSecondary }]}>
            A live reflection of how well your Domains are currently being maintained — not a level or XP total.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.focusRow, { borderColor: palette.separator }]}
          onPress={() => (navigation as any).navigate('Focus')}
          activeOpacity={0.75}
        >
          <View style={styles.focusCopy}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>CURRENT FOCUS</Text>
            <Text style={[styles.focusLabel, { color: palette.text }]}>{focus?.label ?? 'No focus set'}</Text>
          </View>
          <Text style={[styles.focusLink, { color: palette.red }]}>{focus ? 'Edit' : 'Set'}</Text>
        </TouchableOpacity>

        <View style={styles.domainsSection}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DOMAINS</Text>
          {domains.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No Domains yet — create one from the Domains screen.</Text>
          ) : (
            <View style={styles.rows}>
              {domains.map((domain) => (
                <TouchableOpacity
                  key={domain.id}
                  style={[styles.domainRow, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: isDark ? palette.separatorStrong : palette.separator }]}
                  activeOpacity={0.75}
                  onPress={() => (navigation as any).navigate('AreaDetail', { areaId: domain.id, title: domain.title })}
                >
                  <AreaBonsaiIcon size={28} />
                  <View style={styles.domainCopy}>
                    <Text style={[styles.domainTitle, { color: palette.text }]} numberOfLines={1}>{domain.title}</Text>
                    <KatanaProgress progress={domain.score / 100} size={16} accessibilityLabel={`${domain.title} score`} />
                  </View>
                  <Text style={[styles.domainPercent, { color: palette.textTertiary }]}>{Math.round(domain.score)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.focusRow, { borderColor: palette.separator }]}
          onPress={() => (navigation as any).navigate('Achievements')}
          activeOpacity={0.75}
        >
          <Text style={[styles.focusLabel, { color: palette.text }]}>Achievements</Text>
          <Text style={[styles.focusLink, { color: palette.red }]}>View</Text>
        </TouchableOpacity>
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  overallSection: { gap: 8 },
  overallHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overallLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  overallPercent: { fontSize: 26, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  overallSubtext: { fontFamily: 'Inter_400Regular', fontSize: 13, fontWeight: '400' },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  focusCopy: { gap: 4 },
  focusLabel: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  focusLink: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  domainsSection: { gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  rows: { gap: 8 },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  domainCopy: { flex: 1, gap: 6 },
  domainTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  domainPercent: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400' },
});
