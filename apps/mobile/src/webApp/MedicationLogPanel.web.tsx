import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pause, Play, PlayCircle, Pencil, RotateCcw, Square, Trash2 } from 'lucide-react-native';
import {
  getMedicationLogs,
  getPersistentMedicationTimers,
  logMedicationTaken,
  pauseMedicationTimer,
  resumeMedicationTimer,
  resetMedicationTimer,
  stopMedicationTimer,
  startTimerFromLoggedDose,
  editMedicationLog,
  deleteMedicationLog,
  formatDate,
} from '../db/database';
import { presentMedicationTimer } from '../utils/timerPresentation';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export interface MedicationLogPanelProps {
  item: Item;
  onChanged: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateTimeParts(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function fromDateTimeParts(date: string, time: string): number | null {
  const parsed = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function relativeLabel(ts: number, now: number): string {
  const diffMs = now - ts;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

export function MedicationLogPanel({ item, onChanged }: MedicationLogPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [useExactTime, setUseExactTime] = useState(false);
  const [hoursAgoText, setHoursAgoText] = useState('0');
  const [minutesAgoText, setMinutesAgoText] = useState('0');
  const [exactDate, setExactDate] = useState(() => formatDate(new Date()));
  const [exactTime, setExactTime] = useState(() => toDateTimeParts(Date.now()).time);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const logs = getMedicationLogs(item.id, 200);
  const timer = getPersistentMedicationTimers().find((t) => t.med.id === item.id) ?? null;
  const presented = timer ? presentMedicationTimer(timer, now) : null;

  const resolveTakenAt = (): number => {
    if (useExactTime) {
      return fromDateTimeParts(exactDate, exactTime) ?? Date.now();
    }
    const hours = Number(hoursAgoText) || 0;
    const minutes = Number(minutesAgoText) || 0;
    return Date.now() - (hours * 3600000 + minutes * 60000);
  };

  const submitLog = (withTimer: boolean) => {
    logMedicationTaken(item.id, resolveTakenAt(), withTimer);
    setHoursAgoText('0');
    setMinutesAgoText('0');
    onChanged();
  };

  const startEdit = (logId: string, ts: number) => {
    const parts = toDateTimeParts(ts);
    setEditingLogId(logId);
    setEditDate(parts.date);
    setEditTime(parts.time);
  };

  const saveEdit = () => {
    if (!editingLogId) return;
    const ts = fromDateTimeParts(editDate, editTime);
    if (ts !== null) editMedicationLog(editingLogId, item.id, ts);
    setEditingLogId(null);
    onChanged();
  };

  const removeLog = (logId: string) => {
    if (!window.confirm('Delete this dose log?')) return;
    deleteMedicationLog(logId, item.id);
    onChanged();
  };

  return (
    <View style={styles.container}>
      <View>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setUseExactTime(false)} style={[styles.modeChip, !useExactTime && styles.modeChipActive]}>
            <Text style={[styles.modeChipText, !useExactTime && styles.modeChipTextActive]}>How long ago</Text>
          </Pressable>
          <Pressable onPress={() => setUseExactTime(true)} style={[styles.modeChip, useExactTime && styles.modeChipActive]}>
            <Text style={[styles.modeChipText, useExactTime && styles.modeChipTextActive]}>Exact time</Text>
          </Pressable>
        </View>

        {useExactTime ? (
          <View style={styles.row}>
            <TextInput value={exactDate} onChangeText={setExactDate} placeholder="YYYY-MM-DD" placeholderTextColor={webColors.mutedForeground} style={[styles.input, styles.flex1]} />
            <TextInput value={exactTime} onChangeText={setExactTime} placeholder="HH:MM" placeholderTextColor={webColors.mutedForeground} style={[styles.input, styles.timeInput]} />
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.microLabel}>Hours ago</Text>
              <TextInput value={hoursAgoText} onChangeText={setHoursAgoText} style={styles.input} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.microLabel}>Minutes ago</Text>
              <TextInput value={minutesAgoText} onChangeText={setMinutesAgoText} style={styles.input} />
            </View>
          </View>
        )}

        <View style={styles.logButtonRow}>
          <Pressable onPress={() => submitLog(false)} style={[styles.logButton, styles.logButtonSecondary]}>
            <Text style={styles.logButtonSecondaryText}>Log only</Text>
          </Pressable>
          <Pressable onPress={() => submitLog(true)} style={styles.logButton}>
            <Text style={styles.logButtonText}>Log + Timer</Text>
          </Pressable>
        </View>
      </View>

      {presented ? (
        <View style={styles.timerCard}>
          <Text style={styles.timerElapsed}>{presented.compactElapsedLabel}</Text>
          <Text style={styles.timerStatus}>{presented.subtitle}</Text>
          <View style={styles.timerButtonRow}>
            {presented.isRunning ? (
              <Pressable onPress={() => { pauseMedicationTimer(presented.log.id, item.id); onChanged(); }} style={styles.timerButton}>
                <Pause size={14} color={webColors.foreground} strokeWidth={2} />
                <Text style={styles.timerButtonText}>Pause</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => { resumeMedicationTimer(presented.log.id, item.id); onChanged(); }} style={styles.timerButton}>
                <Play size={14} color={webColors.foreground} strokeWidth={2} />
                <Text style={styles.timerButtonText}>Resume</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { resetMedicationTimer(presented.log.id, item.id); onChanged(); }} style={styles.timerButton}>
              <RotateCcw size={14} color={webColors.foreground} strokeWidth={2} />
              <Text style={styles.timerButtonText}>Reset</Text>
            </Pressable>
            <Pressable onPress={() => { stopMedicationTimer(presented.log.id, item.id); onChanged(); }} style={styles.timerButton}>
              <Square size={14} color={webColors.destructive} strokeWidth={2} />
              <Text style={[styles.timerButtonText, { color: webColors.destructive }]}>Stop</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionLabel}>DOSE HISTORY</Text>
        {logs.length === 0 ? (
          <Text style={styles.empty}>No doses logged yet.</Text>
        ) : (
          logs.map((log) => {
            const isEditing = editingLogId === log.id;
            const hasTimerState = timer?.log.id === log.id;
            return (
              <View key={log.id} style={styles.logRow}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput value={editDate} onChangeText={setEditDate} style={[styles.input, styles.flex1]} />
                    <TextInput value={editTime} onChangeText={setEditTime} style={[styles.input, styles.timeInput]} />
                    <Pressable onPress={saveEdit} style={styles.saveEditButton}>
                      <Text style={styles.saveEditText}>Save</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.logRowText}>
                      <Text style={styles.logTime}>
                        {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.logRelative}>{relativeLabel(log.timestamp, now)}</Text>
                    </View>
                    <View style={styles.logActions}>
                      {!hasTimerState ? (
                        <Pressable onPress={() => { startTimerFromLoggedDose(log.id, item.id); onChanged(); }} style={styles.iconButton}>
                          <PlayCircle size={15} color={webColors.mutedForeground} strokeWidth={1.75} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => startEdit(log.id, log.timestamp)} style={styles.iconButton}>
                        <Pencil size={14} color={webColors.mutedForeground} strokeWidth={1.75} />
                      </Pressable>
                      <Pressable onPress={() => removeLog(log.id)} style={styles.iconButton}>
                        <Trash2 size={14} color={webColors.destructive} strokeWidth={1.75} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  modeRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  modeChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  modeChipActive: {
    backgroundColor: webColors.accent,
  },
  modeChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  modeChipTextActive: {
    color: webColors.card,
  },
  row: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  flex1: {
    flex: 1,
  },
  microLabel: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[1],
  },
  input: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  timeInput: {
    width: 90,
  },
  logButtonRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginTop: webSpacing[3],
  },
  logButton: {
    flex: 1,
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
  },
  logButtonSecondary: {
    backgroundColor: webColors.muted,
  },
  logButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  logButtonSecondaryText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  timerCard: {
    backgroundColor: webColors.muted,
    borderRadius: webRadius.md,
    padding: webSpacing[4],
    alignItems: 'center',
    gap: webSpacing[1],
  },
  timerElapsed: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
    fontVariant: ['tabular-nums'],
  },
  timerStatus: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  timerButtonRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginTop: webSpacing[2],
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.card,
    borderWidth: 1,
    borderColor: webColors.border,
  },
  timerButtonText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.foreground,
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.foreground,
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: webSpacing[2],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  logRowText: {
    gap: 2,
  },
  logTime: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  logRelative: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  logActions: {
    flexDirection: 'row',
    gap: webSpacing[1],
  },
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    flex: 1,
    alignItems: 'center',
  },
  saveEditButton: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  saveEditText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.card,
  },
});
