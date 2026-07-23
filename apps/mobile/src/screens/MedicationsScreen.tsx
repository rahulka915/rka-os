import { useCallback, useState, useEffect } from 'react';
import { Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, View as RNView, Text as RNText, StyleSheet, TextInput, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMedications } from '../hooks/useDb';
import { createMedication, updateMedication, deleteItem, getLastTakenLog, getMedicationDoseHistory, getMedicationLogs, getTotalStock, getStockBreakdown, restockMedication, startTimerFromLoggedDose, type MedicationMeta } from '../db/database';
import { LogDoseSheet } from '../components/LogDoseSheet';
import { LensSurface } from '../components/LensSurface';
import { MedicationStockMeter } from '../components/MedicationStockMeter';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { startMedicationLiveActivity } from '../services/medicationLiveActivity';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';
import { Pill, X, AlertTriangle, Clock, PlayCircle, Check } from '../icons';
import { showActionSheet } from '../utils/actionSheet';

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

function useMedState(item: Item) {
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const lastLog = getLastTakenLog(item.id);
  const isTrackingStock = meta.containers !== undefined || meta.stockRemaining !== undefined;
  const stock = getTotalStock(meta);
  const threshold = meta.refillThreshold ?? 5;
  const isLowStock = isTrackingStock && stock <= threshold;
  const canTake = (() => {
    if (!meta.minHoursBetweenDoses || !lastLog) return true;
    return (Date.now() - lastLog.timestamp) / 3600000 >= meta.minHoursBetweenDoses;
  })();
  return { meta, lastLog, stock, isTrackingStock, isLowStock, canTake };
}

interface NeedsAttentionRowProps {
  item: Item;
  isDark: boolean;
  onRestock: () => void;
}

function NeedsAttentionRow({ item, isDark, onRestock }: NeedsAttentionRowProps) {
  const palette = getThemeColors(isDark);
  const { meta, stock } = useMedState(item);
  const breakdown = getStockBreakdown(meta);

  return (
    <RNView style={[s.attentionRow, { backgroundColor: palette.orangeSoft, borderColor: palette.orange + '2a' }]}>
      <AlertTriangle size={16} color={palette.orange} strokeWidth={1.5} />
      <RNView style={s.attentionContent}>
        <RNText style={[s.attentionTitle, { color: palette.text }]}>{item.title}{meta.dose ? ` ${meta.dose}` : ''}</RNText>
        <RNText style={[s.attentionSub, { color: palette.textSecondary }]}>
          {stock === 0 ? 'No doses remaining' : `${stock} left — running low`}
        </RNText>
        {breakdown && <RNView style={{ marginTop: 6 }}><MedicationStockMeter breakdown={breakdown} /></RNView>}
      </RNView>
      <TouchableOpacity onPress={onRestock} hitSlop={8}>
        <RNText style={[s.attentionAction, { color: palette.orange }]}>Restock →</RNText>
      </TouchableOpacity>
    </RNView>
  );
}

interface TodayRowProps {
  item: Item;
  isDark: boolean;
  onTake: (startTimer?: boolean) => void;
  onLogPast: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestock: () => void;
  onStartTimer: () => void;
}

function TodayRow({ item, isDark, onTake, onLogPast, onEdit, onDelete, onRestock, onStartTimer }: TodayRowProps) {
  const palette = getThemeColors(isDark);
  const { meta, lastLog, stock, isTrackingStock, canTake } = useMedState(item);
  const timeSince = useTimeSince(lastLog?.timestamp);
  const breakdown = getStockBreakdown(meta);

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
    showActionSheet(item.title, [
      { label: 'Take + Start Timer', onPress: () => handleTake(true) },
      // Forgot to start the timer when you took it? Attach one now to the dose
      // you already logged, instead of logging a second (fake) dose.
      ...(lastLog ? [{ label: 'Start Timer for Last Dose', onPress: onStartTimer }] : []),
      { label: 'Log Past Dose', onPress: onLogPast },
      ...(isTrackingStock ? [{ label: 'Restock', onPress: onRestock }] : []),
      { label: 'Edit', onPress: onEdit },
      { label: 'Delete', onPress: onDelete, destructive: true },
    ]);
  };

  // Dark mode: silvery-blue "Take" action (same accent as the rest of the
  // app) instead of a plain white pill; light mode keeps the original.
  const takeBg = isDark ? (canTake ? palette.blue : palette.fillStrong) : (canTake ? palette.text : palette.fill);
  const takeTextColor = isDark ? (canTake ? '#182229' : palette.textSecondary) : (canTake ? palette.bg : palette.textSecondary);

  return (
    <TouchableOpacity onLongPress={handleLongPress} delayLongPress={400} activeOpacity={0.5}>
      <RNView
        style={[
          s.todayRow,
          isDark
            ? { backgroundColor: palette.fillStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.separatorStrong }
            : null,
        ]}
      >
        <RNView style={s.medContent}>
          <RNText style={[s.medTitle, { color: palette.text }]}>{item.title}</RNText>
          {meta.dose && <RNText style={[s.medDose, { color: palette.textSecondary }]}>{meta.dose}</RNText>}
          <RNView style={s.medTime}>
            <Clock size={10} color={palette.textMuted} strokeWidth={1.5} />
            <RNText style={[s.medTimeSince, { color: palette.textTertiary }]}>{timeSince}</RNText>
          </RNView>
          {breakdown && (
            <RNView style={{ marginTop: 6, gap: 4 }}>
              <RNText style={[s.medSummary, { color: palette.textTertiary }]}>
                {breakdown.current} left of {breakdown.capacity}
              </RNText>
              <MedicationStockMeter breakdown={breakdown} />
            </RNView>
          )}
        </RNView>
        <TouchableOpacity
          onPress={() => handleTake(false)}
          style={[s.actionBtn, { backgroundColor: takeBg, opacity: stock === 0 ? 0.35 : 1 }]}
        >
          <RNText style={[s.actionBtnText, { color: takeTextColor }]}>
            {canTake ? 'Take' : 'Wait'}
          </RNText>
        </TouchableOpacity>
      </RNView>
    </TouchableOpacity>
  );
}

function HistoryRow({ item, isDark }: { item: Item; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const history = getMedicationDoseHistory(item.id, 5);

  return (
    <RNView
      style={[
        s.historyRow,
        isDark
          ? { backgroundColor: palette.fillStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.separatorStrong }
          : null,
      ]}
    >
      <RNText style={[s.historyLabel, { color: palette.text }]} numberOfLines={1}>{item.title}</RNText>
      <RNView style={s.historyDays}>
        {history.map(({ date, taken }) => (
          <RNView
            key={date}
            style={[s.historyDot, { backgroundColor: taken ? palette.green : palette.fill }]}
          >
            {taken && <Check size={10} color="#ffffff" strokeWidth={3} />}
          </RNView>
        ))}
      </RNView>
    </RNView>
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
  const [containerLabel, setContainerLabel] = useState('');
  const [containerSize, setContainerSize] = useState('');
  const [containersPerRestock, setContainersPerRestock] = useState('');
  const [sheetsPerContainer, setSheetsPerContainer] = useState('');
  const [pillsPerSheet, setPillsPerSheet] = useState('');
  const [packagingNote, setPackagingNote] = useState('');
  const isEditing = !!editTarget;

  useEffect(() => {
    if (!visible) return;
    if (editTarget) {
      const meta: MedicationMeta = editTarget.metadata ? JSON.parse(editTarget.metadata) : {};
      setTitle(editTarget.title);
      setDose(meta.dose ?? '');
      setStock(String(getTotalStock(meta)));
      setMinHours(meta.minHoursBetweenDoses !== undefined ? String(meta.minHoursBetweenDoses) : '');
      setContainerLabel(meta.containerLabel ?? '');
      setContainerSize(meta.containerSize !== undefined ? String(meta.containerSize) : '');
      setContainersPerRestock(meta.containersPerRestock !== undefined ? String(meta.containersPerRestock) : '');
      setSheetsPerContainer(meta.sheetsPerContainer !== undefined ? String(meta.sheetsPerContainer) : '');
      setPillsPerSheet(meta.pillsPerSheet !== undefined ? String(meta.pillsPerSheet) : '');
      setPackagingNote(meta.packagingNote ?? '');
    } else {
      setTitle(''); setDose(''); setStock(''); setMinHours('');
      setContainerLabel(''); setContainerSize(''); setContainersPerRestock('');
      setSheetsPerContainer(''); setPillsPerSheet(''); setPackagingNote('');
    }
  }, [visible, editTarget]);

  const handleSave = () => {
    if (!title.trim()) return;
    const packaging: MedicationMeta = {
      dose: dose.trim() || undefined,
      minHoursBetweenDoses: minHours ? parseFloat(minHours) : undefined,
      containerLabel: containerLabel.trim() || undefined,
      containerSize: containerSize ? parseInt(containerSize) : undefined,
      containersPerRestock: containersPerRestock ? parseInt(containersPerRestock) : undefined,
      sheetsPerContainer: sheetsPerContainer ? parseInt(sheetsPerContainer) : undefined,
      pillsPerSheet: pillsPerSheet ? parseInt(pillsPerSheet) : undefined,
      packagingNote: packagingNote.trim() || undefined,
    };
    if (editTarget) {
      updateMedication(editTarget.id, title.trim(), packaging);
    } else {
      createMedication(title.trim(), {
        ...packaging,
        initialStock: stock ? parseInt(stock) : undefined,
        stockRemaining: stock ? parseInt(stock) : undefined,
        refillThreshold: 5,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved(); onClose();
  };

  const fields = [
    { label: 'Medication name', value: title, set: setTitle, placeholder: 'e.g. Ibuprofen', auto: !isEditing, kb: 'default' as const, disabled: false },
    { label: 'Dose', value: dose, set: setDose, placeholder: 'e.g. 400mg', auto: false, kb: 'default' as const, disabled: false },
    { label: isEditing ? 'Stock remaining (units) — read-only, use Restock' : 'Initial stock (units)', value: stock, set: setStock, placeholder: 'e.g. 30', auto: false, kb: 'numeric' as const, disabled: isEditing },
    { label: 'Min hours between doses', value: minHours, set: setMinHours, placeholder: 'e.g. 6', auto: false, kb: 'numeric' as const, disabled: false },
    { label: 'Container label', value: containerLabel, set: setContainerLabel, placeholder: 'e.g. box, container', auto: false, kb: 'default' as const, disabled: false },
    { label: 'Pills per container', value: containerSize, set: setContainerSize, placeholder: 'e.g. 30', auto: false, kb: 'numeric' as const, disabled: false },
    { label: 'Containers per restock', value: containersPerRestock, set: setContainersPerRestock, placeholder: 'e.g. 2', auto: false, kb: 'numeric' as const, disabled: false },
    { label: 'Sheets per container (optional)', value: sheetsPerContainer, set: setSheetsPerContainer, placeholder: 'e.g. 3', auto: false, kb: 'numeric' as const, disabled: false },
    { label: 'Pills per sheet (optional)', value: pillsPerSheet, set: setPillsPerSheet, placeholder: 'e.g. 10', auto: false, kb: 'numeric' as const, disabled: false },
    { label: 'Packaging note (optional)', value: packagingNote, set: setPackagingNote, placeholder: 'e.g. 28 + 2 topper blister', auto: false, kb: 'default' as const, disabled: false },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RNView style={[s.addMedContainer, { backgroundColor: palette.bg }]}>
          <RNView style={[s.dragHandle, { backgroundColor: palette.handle }]} />
          <RNView style={s.addMedHeader}>
            <RNText style={[s.addMedTitle, { color: palette.text }]}>{isEditing ? 'Edit Medication' : 'Add Medication'}</RNText>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </RNView>

          <ScrollView style={s.addMedContent} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
            {fields.map(({ label, value, set, placeholder, auto, kb, disabled }) => (
              <RNView key={label} style={s.field}>
                <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>{label}</RNText>
                <TextInput
                  style={[s.fieldInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.fill, opacity: disabled ? 0.5 : 1 }]}
                  placeholder={placeholder}
                  placeholderTextColor={palette.textMuted}
                  value={value}
                  onChangeText={set}
                  autoFocus={auto}
                  keyboardType={kb}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  editable={!disabled}
                />
              </RNView>
            ))}
          </ScrollView>

          <RNView style={s.addMedActions}>
            <TouchableOpacity onPress={onClose} style={[s.cancelBtn, { backgroundColor: palette.fill }]}>
              <RNText style={[s.cancelText, { color: palette.textSecondary }]}>Cancel</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!title.trim()}
              style={[s.saveBtn, { backgroundColor: palette.deeperBlue, opacity: title.trim() ? 1 : 0.3 }]}
            >
              <RNText style={[s.saveText, { color: isDark ? '#182229' : '#ffffff' }]}>Save</RNText>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SeeAllHistorySheet({ visible, item, onClose, isDark }: { visible: boolean; item: Item | null; onClose: () => void; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const logs = item ? getMedicationLogs(item.id, 30) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNView style={[s.addMedContainer, { backgroundColor: palette.bg }]}>
        <RNView style={s.dragHandle} />
        <RNView style={s.addMedHeader}>
          <RNText style={[s.addMedTitle, { color: palette.text }]}>{item?.title ?? ''} history</RNText>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={16} color={palette.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </RNView>
        <FlatList
          data={logs}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item: log }) => (
            <RNText style={[s.historyLogRow, { color: palette.text, borderBottomColor: palette.separator }]}>
              {new Date(log.timestamp).toLocaleString()}
            </RNText>
          )}
          ListEmptyComponent={<RNText style={{ color: palette.textSecondary, padding: 16 }}>No doses logged yet.</RNText>}
        />
      </RNView>
    </Modal>
  );
}

// No header "+" — holding the dock FAB while this screen is focused opens
// New Medication instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function MedicationsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { medications, refresh, takeMedication } = useMedications();
  const [addOpen, setAddOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<Item | null>(null);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Item | null>(null);

  useRegisterFabHoldAction(useCallback(() => setAddOpen(true), []));

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

  const needsAttention = medications.filter(m => {
    const meta: MedicationMeta = m.metadata ? JSON.parse(m.metadata) : {};
    const tracking = meta.containers !== undefined || meta.stockRemaining !== undefined;
    return tracking && getTotalStock(meta) <= (meta.refillThreshold ?? 5);
  });

  // Additive restock — adds new containers (or a flat pill count for meds without configured
  // packaging) on top of whatever's currently left, rather than overwriting the total.
  const handleRestock = (item: Item) => {
    const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
    const defaultCount = meta.containerSize ? (meta.containersPerRestock ?? 1) : 30;
    const promptLabel = meta.containerSize
      ? `How many ${meta.containerLabel || 'containers'} (${meta.containerSize} each)?`
      : 'How many pills?';
    Alert.prompt(
      `Restock ${item.title}`,
      promptLabel,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (value?: string) => {
            const count = value ? parseInt(value, 10) : defaultCount;
            if (!count || count <= 0) return;
            restockMedication(item.id, count);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refresh();
          },
        },
      ],
      'plain-text',
      String(defaultCount),
      'numeric'
    );
  };

  const handleStartTimer = (item: Item) => {
    const log = getLastTakenLog(item.id);
    if (!log) return;
    startTimerFromLoggedDose(log.id, item.id);
    const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
    startMedicationLiveActivity(log.id, {
      medicationName: item.title,
      dose: meta.dose,
      displayStartedAt: log.timestamp,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  return (
    <LensSurface title="Medications">
      {medications.length === 0 ? (
        <RNView style={s.empty}>
          <Pill size={28} color={palette.textMuted} strokeWidth={1} />
          <RNText style={[s.emptyTitle, { color: palette.text }]}>No medications</RNText>
          <RNText style={[s.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to add one</RNText>
        </RNView>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {needsAttention.length > 0 && (
            <RNView style={s.section}>
              <RNText style={[s.sectionLabel, { color: palette.textTertiary }]}>NEEDS ATTENTION</RNText>
              <RNView style={s.sectionRows}>
                {needsAttention.map(item => (
                  <NeedsAttentionRow key={item.id} item={item} isDark={isDark} onRestock={() => handleRestock(item)} />
                ))}
              </RNView>
            </RNView>
          )}

          <RNView style={s.section}>
            <RNText style={[s.sectionLabel, { color: palette.textTertiary }]}>TODAY</RNText>
            <RNView style={s.sectionRows}>
              {medications.map(item => (
                <TodayRow
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  onTake={(startTimer) => takeMedication(item.id, undefined, startTimer)}
                  onLogPast={() => setLogTarget(item)}
                  onEdit={() => setEditTarget(item)}
                  onDelete={() => handleDelete(item)}
                  onRestock={() => handleRestock(item)}
                  onStartTimer={() => handleStartTimer(item)}
                />
              ))}
            </RNView>
          </RNView>

          <RNView style={s.section}>
            <RNView style={s.historyHeader}>
              <RNText style={[s.sectionLabel, { color: palette.textTertiary }]}>HISTORY</RNText>
              <TouchableOpacity onPress={() => setHistoryTarget(medications[0] ?? null)} hitSlop={8}>
                <RNText style={[s.seeAll, { color: palette.blue }]}>See all</RNText>
              </TouchableOpacity>
            </RNView>
            <RNView style={s.sectionRows}>
              {medications.map(item => (
                <HistoryRow key={item.id} item={item} isDark={isDark} />
              ))}
            </RNView>
          </RNView>
        </ScrollView>
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
      <SeeAllHistorySheet visible={!!historyTarget} item={historyTarget} onClose={() => setHistoryTarget(null)} isDark={isDark} />
    </LensSurface>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionRows: {
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  attentionContent: {
    flex: 1,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  attentionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  attentionAction: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  medContent: {
    flex: 1,
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
  medSummary: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  historyDays: {
    flexDirection: 'row',
    gap: 6,
  },
  historyDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLogRow: {
    fontSize: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontFamily: 'Inter_700Bold',
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
    fontFamily: 'Inter_800ExtraBold',
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
    fontFamily: 'Inter_700Bold',
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
    fontFamily: 'Inter_600SemiBold',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
