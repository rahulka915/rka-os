import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDate,
  getCompletedOccurrenceDates,
  getItemsByType,
  getPotentialStatsForArea,
} from '../db/database';
import { FocusEditor } from './FocusEditor.web';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import { overallPotential, domainMaintenance } from '../utils/domainScoring';
import { computePotentialStats } from '../utils/potential';
import type { Item } from '../db/types';

interface DomainWithScore extends Item {
  score: number;
}

interface FocusInfo {
  label: string;
  weights: Record<string, number>;
}

// Shared with DomainMissionDetailForm.web.tsx so Domain score reads the same
// everywhere on web. This mirrors native's maintenance baseline from linked
// Potential Stats and their assigned habits; web still omits the separate
// achievement/mission decay lift because domainContributions are not mirrored.
export function computeDomainScoreApprox(areaId: string): number {
  const stats = getPotentialStatsForArea(areaId);
  // No linked Pillars → neutral maintenance baseline (not 0). Pillars are
  // optional; a Domain without them isn't "failing". Matches native's
  // computeDomainMaintenance via the shared domainMaintenance helper.
  if (stats.length === 0) return domainMaintenance([]);
  const habits = getItemsByType('habit');
  const completedDates = Object.fromEntries(
    habits.map((habit) => [habit.id, getCompletedOccurrenceDates(habit.id)])
  );
  const results = computePotentialStats(habits, stats, completedDates, formatDate(new Date()));
  return domainMaintenance(stats.map((stat) => results[stat.id]?.percent ?? 0));
}

// Exported so Home's condensed progression strip computes overall/focus the
// same way as the full Potential screen, instead of a second approximation.
export function computeDomains(): { domains: DomainWithScore[]; overall: number } {
  const areas = getItemsByType('area');
  const domains = areas.map((area) => ({ ...area, score: computeDomainScoreApprox(area.id) }));
  const focus = readFocus();
  const overall = overallPotential(Object.fromEntries(domains.map((d) => [d.id, d.score])), focus?.weights ?? {});
  return { domains, overall };
}

export function readFocus(): FocusInfo | null {
  const rows = getItemsByType('focus');
  const focus = rows[0];
  if (!focus) return null;
  const meta = focus.metadata ? JSON.parse(focus.metadata) : {};
  return { label: focus.title, weights: meta.weights ?? {} };
}

interface PotentialOverviewProps {
  showAchievementsLink?: boolean;
  onNavigateToAchievements?: () => void;
}

// Extracted so Home's condensed progression strip can reuse the exact same
// ring visual (border-rotate approximation, not a real SVG arc) at a smaller
// size, instead of re-deriving a second ring implementation.
export function PotentialRing({ value, size = 140, valueFontSize, labelFontSize }: { value: number; size?: number; valueFontSize?: number; labelFontSize?: number }) {
  const borderWidth = Math.max(4, Math.round(size * 0.07));
  const innerSize = size - borderWidth * 2 - 12;
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={[
          styles.ringFill,
          { width: size, height: size, borderRadius: size / 2, borderWidth, transform: [{ rotate: `${Math.min(value, 100) * 3.6}deg` }] },
        ]}
      />
      <View style={[styles.ringInner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
        <Text style={[styles.ringValue, valueFontSize ? { fontSize: valueFontSize } : undefined]}>{Math.round(value)}%</Text>
        {labelFontSize !== 0 ? (
          <Text style={[styles.ringLabel, labelFontSize ? { fontSize: labelFontSize } : undefined]}>Overall</Text>
        ) : null}
      </View>
    </View>
  );
}

export function PotentialOverview({ showAchievementsLink = true, onNavigateToAchievements }: PotentialOverviewProps) {
  const [domains, setDomains] = useState<DomainWithScore[]>([]);
  const [overall, setOverall] = useState(0);
  const [focus, setFocus] = useState<FocusInfo | null>(null);
  const [focusEditorOpen, setFocusEditorOpen] = useState(false);

  const load = useCallback(() => {
    const { domains: nextDomains, overall: nextOverall } = computeDomains();
    setDomains(nextDomains);
    setOverall(nextOverall);
    setFocus(readFocus());
  }, []);

  useEffect(() => { load(); }, [load]);

  const focusDomainId = focus ? Object.keys(focus.weights).find((id) => focus.weights[id] > 1) ?? null : null;
  const thrivingCount = domains.filter((d) => d.score >= 70).length;

  return (
    <View style={styles.stack}>
      <View style={[styles.heroCard, webDepth.card]}>
        <Text style={styles.heroEyebrow}>YOUR LIFE IN BALANCE</Text>
        <PotentialRing value={overall} size={140} />
        <Text style={styles.heroSubtext}>
          A live reflection of how well your Domains are currently being maintained — not a level or XP total.
        </Text>
        {domains.length > 0 && (
          <Text style={styles.thrivingText}>{thrivingCount} of {domains.length} Domains thriving</Text>
        )}
      </View>

      <View style={[styles.focusSection, webDepth.list]}>
        <Pressable style={styles.row} onPress={() => setFocusEditorOpen((v) => !v)}>
          <View style={styles.focusCopy}>
            <Text style={styles.sectionLabel}>CURRENT FOCUS</Text>
            <Text style={styles.focusLabel}>{focus?.label ?? 'No focus set'}</Text>
          </View>
          <Text style={styles.focusLink}>{focusEditorOpen ? 'Close' : 'Edit'}</Text>
        </Pressable>
        {focusEditorOpen ? (
          <View style={styles.focusEditorWrap}>
            <FocusEditor onSaved={load} />
          </View>
        ) : null}
      </View>

      <View style={styles.domainsSection}>
        <Text style={styles.sectionLabel}>DOMAINS</Text>
        {domains.length === 0 ? (
          <Text style={styles.emptySub}>No Domains yet — create one from the Domains screen.</Text>
        ) : (
          <View style={styles.rows}>
            {domains.map((domain) => {
              const isFocus = domain.id === focusDomainId;
              return (
                <View
                  key={domain.id}
                  style={[styles.domainRow, webDepth.list, isFocus ? styles.domainRowFocus : undefined]}
                >
                  <View style={styles.domainCopy}>
                    <Text style={styles.domainTitle} numberOfLines={1}>{domain.title}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(domain.score, 100)}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.domainPercent}>{Math.round(domain.score)}%</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showAchievementsLink && (
        <View onTouchEnd={onNavigateToAchievements} style={[styles.row, webDepth.list]}>
          <Text style={styles.focusLabel}>Achievements</Text>
          <Text style={styles.focusLink}>View</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: webSpacing[6] },
  heroCard: {
    backgroundColor: webColors.card,
    padding: webSpacing[6],
    alignItems: 'center',
    gap: webSpacing[3],
  },
  heroEyebrow: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: webColors.primary,
    alignSelf: 'flex-start',
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: webColors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringFill: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    borderColor: webColors.accent,
  },
  ringInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: webColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontSize: webFontSize.xl, fontWeight: '700', color: webColors.foreground },
  ringLabel: { fontSize: webFontSize.xs, color: webColors.mutedForeground, marginTop: 2 },
  heroSubtext: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
  },
  thrivingText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  focusSection: {
    backgroundColor: webColors.card,
  },
  focusEditorWrap: {
    paddingHorizontal: webSpacing[4],
    paddingBottom: webSpacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[4],
  },
  focusCopy: { gap: 4 },
  sectionLabel: { fontSize: webFontSize.xs, fontWeight: '800', letterSpacing: 1, color: webColors.mutedForeground },
  focusLabel: { fontSize: webFontSize.base, fontWeight: '700', color: webColors.foreground },
  focusLink: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.accent, cursor: 'pointer' },
  domainsSection: { gap: webSpacing[2] },
  emptySub: { fontSize: webFontSize.sm, color: webColors.mutedForeground },
  rows: { gap: webSpacing[2] },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  domainRowFocus: {
    borderWidth: 1.5,
    borderColor: webColors.accent,
  },
  domainCopy: { flex: 1, gap: 6 },
  domainTitle: { fontSize: webFontSize.base, fontWeight: '600', color: webColors.foreground },
  domainPercent: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.mutedForeground },
  progressTrack: {
    height: 8,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
  },
});
