import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getActiveMedicationTimers, stopMedicationTimer } from '../db/database';
import type { MedicationMeta } from '../db/database';
import { ChevronDown, ChevronUp, Pill, PlayCircle, StopCircle } from '../icons';
import { FloatingSurface } from './ui/FloatingSurface';
import { DragHandle } from './ui/DragHandle';
import { ActionRow } from './ui/ActionRow';
import { SurfaceCard, SurfaceIconButton } from './ui/SurfaceCard';
import { getThemeColors } from '../theme';

function formatElapsed(startedAt: number, now: number) {
  const elapsedMs = Math.max(0, now - startedAt);
  const elapsedMins = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(elapsedMins / 60);
  const mins = elapsedMins % 60;
  return hours > 0 ? `${hours}h ${mins}m elapsed` : `${mins}m elapsed`;
}

export function PersistentTimerBanner() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeTimers = useMemo(() => getActiveMedicationTimers(), [now]);

  useEffect(() => {
    if (activeTimers.length === 0) setIsCollapsed(true);
  }, [activeTimers.length]);

  const firstTimer = activeTimers[0];
  if (!firstTimer) return null;

  const firstElapsed = formatElapsed(firstTimer.details.startedAt ?? firstTimer.log.timestamp, now);
  const firstMeta = (firstTimer.med.metadata ? JSON.parse(firstTimer.med.metadata) : {}) as MedicationMeta;
  const minHours = firstMeta.minHoursBetweenDoses;
  const readyAt = minHours ? (firstTimer.details.startedAt ?? firstTimer.log.timestamp) + (minHours * 60 * 60 * 1000) : null;
  const isReady = readyAt !== null && now >= readyAt;

  const stopTimer = (logId: string, itemId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    stopMedicationTimer(logId, itemId);
    setNow(Date.now());
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 152, zIndex: 80 }]}>
      <FloatingSurface isDark={isDark}>
        {isCollapsed ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setIsCollapsed(false)}>
            <ActionRow
              isDark={isDark}
              style={styles.compactRow}
              leading={
                <View style={[styles.pillIcon, { backgroundColor: isReady ? palette.greenSoft : palette.blueSoft }]}>
                  <Pill size={16} color={isReady ? palette.green : palette.blue} strokeWidth={1.8} />
                </View>
              }
              title={<Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{firstTimer.med.title}</Text>}
              subtitle={`${isReady ? 'Ready for next dose' : firstElapsed}${activeTimers.length > 1 ? ` · +${activeTimers.length - 1} more` : ''}`}
              trailing={
                <SurfaceIconButton isDark={isDark} onPress={() => setIsCollapsed(false)} size={30}>
                  <ChevronUp size={16} color={palette.textSecondary} strokeWidth={2} />
                </SurfaceIconButton>
              }
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.fullBody}>
            <View style={styles.headerLine}>
              <DragHandle isDark={isDark} width={44} />
              <SurfaceIconButton isDark={isDark} onPress={() => setIsCollapsed(true)} size={30}>
                <ChevronDown size={16} color={palette.textSecondary} strokeWidth={2} />
              </SurfaceIconButton>
            </View>

            {activeTimers.length > 1 && (
              <View style={[styles.headerLine, styles.headerMetaLine]}>
                <PlayCircle size={14} color={palette.textMuted} />
                <Text style={[styles.headerText, { color: palette.textMuted }]}>
                  {activeTimers.length} active medications
                </Text>
              </View>
            )}

            <View style={styles.rows}>
              {activeTimers.map(({ log, med, details }) => {
                const startedAt = details.startedAt ?? log.timestamp;
                const elapsed = formatElapsed(startedAt, now);
                const meta = (med.metadata ? JSON.parse(med.metadata) : {}) as MedicationMeta;
                const readyAtTime = meta.minHoursBetweenDoses ? startedAt + (meta.minHoursBetweenDoses * 60 * 60 * 1000) : null;
                const ready = readyAtTime !== null && now >= readyAtTime;

                return (
                  <SurfaceCard key={log.id} isDark={isDark} tone={ready ? 'success' : 'subtle'} style={styles.timerRow}>
                    <ActionRow
                      isDark={isDark}
                      title={<Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{med.title}</Text>}
                      subtitle={ready ? 'Ready for next dose' : elapsed}
                      trailing={
                        <SurfaceIconButton isDark={isDark} onPress={() => stopTimer(log.id, med.id)} tone="danger" size={32}>
                          <StopCircle size={18} color={palette.red} strokeWidth={1.8} />
                        </SurfaceIconButton>
                      }
                    />
                  </SurfaceCard>
                );
              })}
            </View>
          </View>
        )}
      </FloatingSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  compactRow: {
    gap: 10,
  },
  pillIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  fullBody: {
    gap: 10,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(118,118,128,0.20)',
  },
  headerMetaLine: {
    justifyContent: 'flex-start',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  rows: {
    gap: 10,
  },
  timerRow: {
    padding: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
});
