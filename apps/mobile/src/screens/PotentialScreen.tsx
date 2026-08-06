import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType, computeDomainScore, computeOverallPotential, getFocus } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { RiverStoneSurface } from '../components/ui/RiverStoneSurface';
import { KatanaProgress } from '../components/ui/KatanaProgress';
import { HaradaWheel } from '../components/potential/HaradaWheel';
import { getDomainIcon } from '../utils/domainIcons';
import type { Item } from '../db/types';
import type { FocusData } from '../db/database';

export function PotentialScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [overall, setOverall] = useState(0);
  const [domains, setDomains] = useState<Array<Item & { score: number }>>([]);
  const [focus, setFocus] = useState<FocusData | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);

  const load = useCallback(() => {
    const areas = getItemsByType('area');
    setDomains(areas.map((area) => ({ ...area, score: computeDomainScore(area.id) })));
    setOverall(computeOverallPotential());
    setFocus(getFocus());
  }, []);

  useFocusEffect(load);

  const focusDomainId = focus ? Object.keys(focus.weights).find((id) => focus.weights[id] > 1) ?? null : null;
  const goToDomain = (areaId: string) => {
    const domain = domains.find((d) => d.id === areaId);
    (navigation as any).navigate('AreaDetail', { areaId, title: domain?.title ?? '' });
  };

  return (
    <LensSurface title="Potential">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RiverStoneSurface variant="card" isDark={isDark} style={styles.heroCard}>
          <View style={styles.heroInner}>
            <Text style={[styles.heroEyebrow, { color: palette.antiqueBrass }]}>YOUR LIFE IN BALANCE</Text>
            <Text style={[styles.heroTitle, { color: palette.ivory }]}>Potential</Text>
            {domains.length === 0 ? (
              <View style={styles.heroOverallRow}>
                <Text style={[styles.overallPercent, { color: palette.ivory }]}>{Math.round(overall)}%</Text>
                <KatanaProgress progress={overall / 100} size={20} accessibilityLabel="Overall potential" style={styles.heroProgress} />
              </View>
            ) : (
              <HaradaWheel
                domains={domains}
                overallPercent={overall}
                focusDomainId={focusDomainId}
                focusLabel={focus?.label}
                onSelectDomain={goToDomain}
                size="compact"
              />
            )}
            <Text style={[styles.overallSubtext, { color: palette.greige }]}>
              A live reflection of how well your Domains are currently being maintained — not a level or XP total.
            </Text>
            {domains.length > 1 && (
              <TouchableOpacity onPress={() => setWheelOpen((v) => !v)} hitSlop={10} accessibilityRole="button">
                <Text style={[styles.wheelLink, { color: palette.vermilion }]}>{wheelOpen ? 'Hide Harada Map' : 'View Harada Map'}</Text>
              </TouchableOpacity>
            )}
            {wheelOpen && (
              <View style={styles.fullWheelWrap}>
                <HaradaWheel
                  domains={domains}
                  overallPercent={overall}
                  focusDomainId={focusDomainId}
                  focusLabel={focus?.label}
                  onSelectDomain={goToDomain}
                  size="full"
                />
              </View>
            )}
          </View>
        </RiverStoneSurface>

        <TouchableOpacity
          style={[styles.focusRow, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: palette.separatorStrong }]}
          onPress={() => (navigation as any).navigate('Focus')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={focus ? `Current Focus: ${focus.label}. Edit` : 'No Focus set. Tap to set one'}
        >
          <View style={styles.focusCopy}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>CURRENT FOCUS</Text>
            <Text style={[styles.focusLabel, { color: palette.text }]}>{focus?.label ?? 'No focus set'}</Text>
          </View>
          <Text style={[styles.focusLink, { color: palette.vermilion }]}>{focus ? 'Edit' : 'Set'}</Text>
        </TouchableOpacity>

        <View style={styles.domainsSection}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DOMAINS</Text>
          {domains.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No Domains yet — create one from the Domains screen.</Text>
          ) : (
            <View style={styles.rows}>
              {domains.map((domain) => {
                const DomainIcon = getDomainIcon(domain.title);
                return (
                  <TouchableOpacity
                    key={domain.id}
                    style={[styles.domainRow, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: domain.id === focusDomainId ? palette.vermilion : palette.separatorStrong }]}
                    activeOpacity={0.75}
                    onPress={() => goToDomain(domain.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${domain.title}, ${Math.round(domain.score)}% potential${domain.id === focusDomainId ? ', current focus' : ''}`}
                  >
                    <DomainIcon size={28} color={palette.antiqueBrass} strokeWidth={1.6} />
                    <View style={styles.domainCopy}>
                      <Text style={[styles.domainTitle, { color: palette.text }]} numberOfLines={1}>{domain.title}</Text>
                      <KatanaProgress progress={domain.score / 100} size={16} accessibilityLabel={`${domain.title} score`} />
                    </View>
                    <Text style={[styles.domainPercent, { color: palette.textTertiary }]}>{Math.round(domain.score)}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.focusRow, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: palette.separatorStrong }]}
          onPress={() => (navigation as any).navigate('Achievements')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="View Achievements"
        >
          <Text style={[styles.focusLabel, { color: palette.text }]}>Achievements</Text>
          <Text style={[styles.focusLink, { color: palette.vermilion }]}>View</Text>
        </TouchableOpacity>
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  heroCard: { marginTop: 4 },
  heroInner: { paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', gap: 12 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 1.2, alignSelf: 'flex-start' },
  heroTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, alignSelf: 'flex-start', marginBottom: 4 },
  heroOverallRow: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  heroProgress: { alignSelf: 'stretch' },
  overallPercent: { fontSize: 32, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  overallSubtext: { fontFamily: 'Inter_400Regular', fontSize: 13, fontWeight: '400', textAlign: 'center', lineHeight: 19 },
  wheelLink: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', minHeight: 44, textAlignVertical: 'center' },
  fullWheelWrap: { paddingTop: 8 },
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
