import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType, computeAllDomainScores, getFocus } from '../../db/database';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';
import { RiverStoneSurface } from '../riverstone';
import { RiverStoneProgress } from '../ui/RiverStoneProgress';
import { EnsoMeter } from '../ui/EnsoMeter';
import { SteppingStones } from '../ui/SteppingStones';
import { HaradaWheel } from './HaradaWheel';
import { getDomainIcon } from '../../utils/domainIcons';
import type { Item } from '../../db/types';
import type { FocusData } from '../../db/database';

interface PotentialOverviewProps {
  /** Hides the "Achievements" link row — Profile embeds this without it since its own account section covers that ground differently. */
  showAchievementsLink?: boolean;
}

// The actual Potential content (hero Overall/Harada card, Current Focus row,
// per-Domain list, Achievements link) — a single source of truth so
// PotentialScreen and ProfileScreen's "Me is the Potential" section render
// identically instead of drifting into two bespoke UIs. Renders its own
// vertical stack of sections (no ScrollView) so a parent screen's own
// ScrollView can host it directly, alongside other content above/below.
export function PotentialOverview({ showAchievementsLink = true }: PotentialOverviewProps) {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [overall, setOverall] = useState(0);
  const [domains, setDomains] = useState<Array<Item & { score: number }>>([]);
  const [focus, setFocus] = useState<FocusData | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);

  const load = useCallback(() => {
    const areas = getItemsByType('area');
    const { scores, overall: nextOverall } = computeAllDomainScores();
    setDomains(areas.map((area) => ({ ...area, score: scores[area.id] ?? 0 })));
    setOverall(nextOverall);
    setFocus(getFocus());
  }, []);

  useFocusEffect(load);

  const focusDomainId = focus ? Object.keys(focus.weights).find((id) => focus.weights[id] > 1) ?? null : null;
  const goToDomain = (areaId: string) => {
    const domain = domains.find((d) => d.id === areaId);
    (navigation as any).navigate('AreaDetail', { areaId, title: domain?.title ?? '' });
  };

  return (
    <View style={styles.stack}>
      <RiverStoneSurface variant="hero" mode={isDark ? 'dark' : 'light'} style={styles.heroCard} contentStyle={styles.heroInner}>
          <Text style={[styles.heroEyebrow, { color: palette.antiqueBrass }]}>YOUR LIFE IN BALANCE</Text>
          <Text style={[styles.heroTitle, { color: palette.ivory }]}>Potential</Text>
          {domains.length === 0 ? (
            <View style={styles.heroOverallRow}>
              <EnsoMeter progress={overall / 100} isDark={isDark} accessibilityLabel="Overall potential" />
            </View>
          ) : (
            <>
              <HaradaWheel
                domains={domains}
                overallPercent={overall}
                focusDomainId={focusDomainId}
                focusLabel={focus?.label}
                onSelectDomain={goToDomain}
                size="compact"
              />
              <SteppingStones
                stones={domains.map((d) => ({ id: d.id, filled: d.score >= 70 }))}
                isDark={isDark}
                currentId={focusDomainId}
                label={`${domains.filter((d) => d.score >= 70).length} of ${domains.length} Domains thriving`}
                accessibilityLabel="Domains thriving"
                style={styles.steppingStones}
              />
            </>
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
      </RiverStoneSurface>

      <TouchableOpacity
        onPress={() => (navigation as any).navigate('Focus')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={focus ? `Current Focus: ${focus.label}. Edit` : 'No Focus set. Tap to set one'}
      >
        <RiverStoneSurface variant="list" mode={isDark ? 'dark' : 'light'} contentStyle={styles.focusRow}>
          <View style={styles.focusCopy}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>CURRENT FOCUS</Text>
            <Text style={[styles.focusLabel, { color: palette.text }]}>{focus?.label ?? 'No focus set'}</Text>
          </View>
          <Text style={[styles.focusLink, { color: palette.vermilion }]}>{focus ? 'Edit' : 'Set'}</Text>
        </RiverStoneSurface>
      </TouchableOpacity>

      <View style={styles.domainsSection}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DOMAINS</Text>
        {domains.length === 0 ? (
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No Domains yet — create one from the Domains screen.</Text>
        ) : (
          <View style={styles.rows}>
            {domains.map((domain) => {
              const DomainIcon = getDomainIcon(domain.title);
              const isFocus = domain.id === focusDomainId;
              return (
                <TouchableOpacity
                  key={domain.id}
                  activeOpacity={0.75}
                  onPress={() => goToDomain(domain.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${domain.title}, ${Math.round(domain.score)}% potential${isFocus ? ', current focus' : ''}`}
                >
                  <RiverStoneSurface
                    variant="list"
                    mode={isDark ? 'dark' : 'light'}
                    contentStyle={styles.domainRow}
                    style={isFocus ? { borderRadius: 14, borderWidth: 1.5, borderColor: palette.vermilion } : undefined}
                  >
                    <DomainIcon size={28} color={palette.antiqueBrass} strokeWidth={1.6} />
                    <View style={styles.domainCopy}>
                      <Text style={[styles.domainTitle, { color: palette.text }]} numberOfLines={1}>{domain.title}</Text>
                      <RiverStoneProgress progress={domain.score / 100} isDark={isDark} height={10} showLabel={false} accessibilityLabel={`${domain.title} score`} />
                    </View>
                    <Text style={[styles.domainPercent, { color: palette.textTertiary }]}>{Math.round(domain.score)}%</Text>
                  </RiverStoneSurface>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {showAchievementsLink && (
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('Achievements')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="View Achievements"
        >
          <RiverStoneSurface variant="list" mode={isDark ? 'dark' : 'light'} contentStyle={styles.focusRow}>
            <Text style={[styles.focusLabel, { color: palette.text }]}>Achievements</Text>
            <Text style={[styles.focusLink, { color: palette.vermilion }]}>View</Text>
          </RiverStoneSurface>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  heroCard: { marginTop: 4 },
  heroInner: { paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', gap: 12 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 1.2, alignSelf: 'flex-start' },
  heroTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, alignSelf: 'flex-start', marginBottom: 4 },
  heroOverallRow: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  steppingStones: { alignSelf: 'stretch', marginTop: 4 },
  overallSubtext: { fontFamily: 'Inter_400Regular', fontSize: 13, fontWeight: '400', textAlign: 'center', lineHeight: 19 },
  wheelLink: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', minHeight: 44, textAlignVertical: 'center' },
  fullWheelWrap: { paddingTop: 8 },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  domainCopy: { flex: 1, gap: 6 },
  domainTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  domainPercent: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400' },
});
