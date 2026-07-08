import { useState, useEffect, useCallback } from 'react';
import { Modal, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, View as RNView, Text as RNText, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMedications } from '../hooks/useDb';
import { createMedication, updateMedication, deleteItem, getLastTakenLog, type MedicationMeta } from '../db/database';
import { LogDoseSheet } from '../components/LogDoseSheet';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';
import { Pill, Plus, X, AlertTriangle, Clock, PlayCircle } from '../icons';

function useTimeSince(timestamp: number | undefined): string {
  const [label, setLabel] = useState('—');
  useEffect(() => {
    if (!timestamp) { setLabel('Never taken'); return; }
    const update = () => {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) setLabel(`${days}d ${hrs % 24}h ago`);
      else if (hrs > 0) setLabel(`${hrs}h ${mins % 60}m ago`);
      else if (mins > 0) setLabel(`${mins}m ago`);
      else setLabel('Just now');
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [timestamp]);
  return label;
}

interface MedRowProps {
  item: Item;
  isDark: boolean;
  onTake: (startTimer?: boolean) => void;
  onLogPast: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MedRow({ item, isDark, onTake, onLogPast, onEdit, onDelete }: MedRowProps) {
  const palette = getThemeColors(isDark);
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const lastLog = getLastTakenLog(item.id);
  const timeSince = useTimeSince(lastLog?.timestamp);

  const stock = meta.stockRemaining ?? 0;
  const threshold = meta.refillThreshold ?? 5;
  const isLowStock = stock <= threshold && stock !== undefined;

  const canTake = (() => {
    if (!meta.minHoursBetweenDoses || !lastLog) return true;
    return (Date.now() - lastLog.timestamp) / 3600000 >= meta.minHoursBetweenDoses;
  })();

  const handleTake = (startTimer = false) => {
    const confirmLabel = startTimer ? 'Take & start timer' : 'Take';
    if (!canTake) {
      const minsLeft = Math.ceil(meta.minHoursBetweenDoses! * 60 - (Date.now() - lastLog!.timestamp) / 60000);
      Alert.alert('Too soon', `Next dose in ${minsLeft < 60 ? `${minsLeft}m` : `${Math.ceil(minsLeft / 60)}h`}`, [{ text: 'OK' }]);
      return;
    }
    if (stock === 0) {
      Alert.alert('Out of stock', 'No doses remaining.', [{ text: 'OK' }]);
      return;
    }
    Alert.alert(`${confirmLabel} ${item.title}`, meta.dose ?? 'Record dose?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: startTimer ? 'Take + Timer' : 'Take',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onTake(startTimer);
        },
      },
    ]);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Past Dose', onPress: onLogPast },
      { text: 'Edit', onPress: onEdit },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      delayLongPress={400}
      activeOpacity={0.5}
    >
      <RNView style={[s.medRow, { paddingHorizontal: 16, paddingVertical: 12 }]}>
        <RNView style={s.medContent}>
          <RNText style={[s.medTitle, { color: palette.text }]}>{item.title}</RNText>
          {meta.dose && <RNText style={[s.medDose, { color: palette.textSecondary }]}>{meta.dose}</RNText>}
          <RNView style={s.medTime}>
            <Clock size={10} color={palette.textMuted} strokeWidth={1.5} />
            <RNText style={[s.medTimeSince, { color: palette.textTertiary }]}>{timeSince}</RNText>
          </RNView>
        </RNView>

        <RNView style={s.medActions}>
          {meta.stockRemaining !== undefined && (
            <RNView style={[s.stockBadge, { backgroundColor: isLowStock ? 'rgba(255, 59, 48, 0.08)' : palette.fill }]}>
              {isLowStock && <AlertTriangle size={10} color="#ff3b30" />}
              <RNText style={[s.stockText, { color: isLowStock ? '#ff3b30' : palette.textSecondary }]}>
                {stock} left
              </RNText>
            </RNView>
          )}
          <TouchableOpacity
            onPress={() => handleTake(false)}
            style={[s.actionBtn, { backgroundColor: canTake ? palette.text : palette.fill, opacity: stock === 0 ? 0.35 : 1 }]}
          >
            <RNText style={[s.actionBtnText, { color: canTake ? palette.bg : palette.textSecondary }]}>
              {canTake ? 'Take' : 'Wait'}
            </RNText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTake(true)}
            style={[s.timerBtn, { opacity: stock === 0 ? 0.35 : 1 }]}
          >
            <PlayCircle size={10} color="#007aff" strokeWidth={1.5} />
            <RNText style={s.timerText}>Timer</RNText>
          </TouchableOpacity>
        </RNView>
      </RNView>
    </TouchableOpacity>
  );
}

interface MedFormSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  isDark: boolean;
  editTarget?: Item | null;
}

function MedFormSheet({ visible, onClose, onSaved, isDark, editTarget }: MedFormSheetProps) {
  const palette = getThemeColors(isDark);
  const [title, setTitle] = useState('');
  const [dose, setDose] = useState('');
  const [stock, setStock] = useState('');
  const [minHours, setMinHours] = useState('');
  const isEditing = !!editTarget;

  // Prefill from the target medication's current metadata each time the sheet opens for it —
  // stock shown here is the CURRENT remaining count, not the original initialStock, so editing
  // it directly adjusts stockRemaining rather than resetting the running total.
  useEffect(() => {
    if (!visible) return;
    if (editTarget) {
      const meta: MedicationMeta = editTarget.metadata ? JSON.parse(editTarget.metadata) : {};
      setTitle(editTarget.title);
      setDose(meta.dose ?? '');
      setStock(meta.stockRemaining !== undefined ? String(meta.stockRemaining) : '');
      setMinHours(meta.minHoursBetweenDoses !== undefined ? String(meta.minHoursBetweenDoses) : '');
    } else {
      setTitle(''); setDose(''); setStock(''); setMinHours('');
    }
  }, [visible, editTarget]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (editTarget) {
      updateMedication(editTarget.id, title.trim(), {
        dose: dose.trim() || undefined,
        stockRemaining: stock ? parseInt(stock) : undefined,
        minHoursBetweenDoses: minHours ? parseFloat(minHours) : undefined,
      });
    } else {
      createMedication(title.trim(), {
        dose: dose.trim() || undefined,
        initialStock: stock ? parseInt(stock) : undefined,
        stockRemaining: stock ? parseInt(stock) : undefined,
        refillThreshold: 5,
        minHoursBetweenDoses: minHours ? parseFloat(minHours) : undefined,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved(); onClose();
  };

  const fields = [
    { label: 'Medication name', value: title, set: setTitle, placeholder: 'e.g. Ibuprofen', auto: !isEditing, kb: 'default' as const },
    { label: 'Dose', value: dose, set: setDose, placeholder: 'e.g. 400mg', auto: false, kb: 'default' as const },
    { label: isEditing ? 'Stock remaining (units)' : 'Stock (units)', value: stock, set: setStock, placeholder: 'e.g. 30', auto: false, kb: 'numeric' as const },
    { label: 'Min hours between doses', value: minHours, set: setMinHours, placeholder: 'e.g. 6', auto: false, kb: 'numeric' as const },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RNView style={[s.addMedContainer, { backgroundColor: palette.bg }]}>
          <RNView style={s.dragHandle} />
          <RNView style={s.addMedHeader}>
            <RNText style={[s.addMedTitle, { color: palette.text }]}>{isEditing ? 'Edit Medication' : 'Add Medication'}</RNText>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </RNView>

          <RNView style={s.addMedContent}>
            {fields.map(({ label, value, set, placeholder, auto, kb }) => (
              <RNView key={label} style={s.field}>
                <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>{label}</RNText>
                <TextInput
                  style={[s.fieldInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.fill }]}
                  placeholder={placeholder}
                  placeholderTextColor={palette.textMuted}
                  value={value}
                  onChangeText={set}
                  autoFocus={auto}
                  keyboardType={kb}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
              </RNView>
            ))}
          </RNView>

          <RNView style={s.addMedActions}>
            <TouchableOpacity onPress={onClose} style={[s.cancelBtn, { backgroundColor: palette.fill }]}>
              <RNText style={[s.cancelText, { color: palette.textSecondary }]}>Cancel</RNText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={!title.trim()} style={[s.saveBtn, { opacity: title.trim() ? 1 : 0.3 }]}>
              <RNText style={s.saveText}>Save</RNText>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { medications, refresh, takeMedication } = useMedications();
  const [addOpen, setAddOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<Item | null>(null);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const handleDelete = (item: Item) => {
    Alert.alert(`Delete ${item.title}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refresh();
        },
      },
    ]);
  };

  const lowStock = medications.filter(m => {
    const meta: MedicationMeta = m.metadata ? JSON.parse(m.metadata) : {};
    return (meta.stockRemaining ?? 0) <= (meta.refillThreshold ?? 5);
  }).length;

  return (
    <RNView style={[s.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <RNView style={s.header}>
        <RNView>
          <RNText style={[s.headerSubtitle, { color: palette.textTertiary }]}>PROTOCOL</RNText>
          <RNText style={[s.headerTitle, { color: palette.text }]}>Medications</RNText>
          {lowStock > 0 && (
            <RNView style={s.lowStockAlert}>
              <AlertTriangle size={11} color="#ff8c42" strokeWidth={1.5} />
              <RNText style={s.lowStockText}>{lowStock} low stock</RNText>
            </RNView>
          )}
        </RNView>
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          style={[s.addBtn, { backgroundColor: palette.text }]}
          hitSlop={12}
        >
          <Plus size={18} color={palette.bg} strokeWidth={2.5} />
        </TouchableOpacity>
      </RNView>

      {/* Stats row */}
      <RNView style={s.statsRow}>
        {[
          { label: 'Tracked', value: medications.length, accent: false },
          { label: 'Low Stock', value: lowStock, accent: lowStock > 0 },
        ].map(({ label, value, accent }) => (
          <RNView
            key={label}
            style={[
              s.statCard,
              {
                backgroundColor: accent ? 'rgba(255, 59, 48, 0.08)' : palette.fill,
                borderColor: accent ? 'rgba(255, 59, 48, 0.12)' : palette.separator,
              },
            ]}
          >
            <RNText style={[s.statLabel, { color: accent ? '#ff3b30' : palette.textTertiary }]}>
              {label}
            </RNText>
            <RNText style={[s.statValue, { color: accent ? '#ff3b30' : palette.text }]}>
              {value}
            </RNText>
          </RNView>
        ))}
      </RNView>

      {medications.length === 0 ? (
        <RNView style={s.empty}>
          <Pill size={28} color={palette.textMuted} strokeWidth={1} />
          <RNText style={[s.emptyTitle, { color: palette.text }]}>No medications</RNText>
          <RNText style={[s.emptySub, { color: palette.textSecondary }]}>Tap + to add one</RNText>
        </RNView>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={i => i.id}
          contentContainerStyle={s.listContent}
          scrollEnabled={medications.length > 6}
          renderItem={({ item, index }) => (
            <RNView key={item.id}>
              <MedRow
                item={item}
                isDark={isDark}
                onTake={(startTimer) => takeMedication(item.id, undefined, startTimer)}
                onLogPast={() => setLogTarget(item)}
                onEdit={() => setEditTarget(item)}
                onDelete={() => handleDelete(item)}
              />
              {index < medications.length - 1 && (
                <RNView style={[s.sep, { backgroundColor: palette.separator, marginLeft: 16 }]} />
              )}
            </RNView>
          )}
        />
      )}

      <MedFormSheet visible={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} isDark={isDark} />
      <MedFormSheet
        visible={!!editTarget}
        editTarget={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={refresh}
        isDark={isDark}
      />
      {logTarget && (
        <LogDoseSheet
          visible={!!logTarget}
          medicationId={logTarget.id}
          medicationName={logTarget.title}
          onClose={() => setLogTarget(null)}
          onLog={(takenAt, startTimer) => { takeMedication(logTarget.id, takenAt, startTimer); setLogTarget(null); }}
        />
      )}
    </RNView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  lowStockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  lowStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff8c42',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  medContent: {
    flex: 1,
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  medDose: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  medTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  medTimeSince: {
    fontSize: 11,
    fontWeight: '400',
  },
  medActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007aff',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '400',
  },
  addMedContainer: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignSelf: 'center',
    marginTop: 8,
  },
  addMedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  addMedTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addMedContent: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addMedActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#007aff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
