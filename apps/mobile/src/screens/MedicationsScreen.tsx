import { useState, useEffect, useCallback } from 'react';
import { Modal, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, Input, View } from 'tamagui';
import { useMedications } from '../hooks/useDb';
import { createMedication, getLastTakenLog, type MedicationMeta } from '../db/database';
import { LogDoseSheet } from '../components/LogDoseSheet';
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

function MedRow({ item, onTake, onLogPast }: {
  item: Item; onTake: (startTimer?: boolean) => void; onLogPast: () => void;
}) {
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

  return (
    <TouchableOpacity
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onLogPast(); }}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      <XStack
        backgroundColor="$surface" borderRadius="$3" padding="$4"
        shadowColor="black" shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.04} shadowRadius={6} elevation={1}
        alignItems="center" gap="$3"
      >
        {/* Left: stock ring */}
        <View
          width={44} height={44} borderRadius="$6"
          backgroundColor={isLowStock ? '$redSoft' : '$fill'}
          alignItems="center" justifyContent="center"
        >
          <Pill size={19} color={isLowStock ? '#ff3b30' : 'rgba(13,13,13,0.5)'} strokeWidth={1.5} />
        </View>

        {/* Middle */}
        <YStack flex={1} gap={2}>
          <Text fontSize="$3" fontWeight="700" color="$text">{item.title}</Text>
          {meta.dose && <Text fontSize="$2" color="$textSecondary">{meta.dose}</Text>}
          <XStack alignItems="center" gap="$1" marginTop={2}>
            <Clock size={10} color="rgba(13,13,13,0.3)" />
            <Text fontSize={11} color="$textTertiary">{timeSince}</Text>
          </XStack>
        </YStack>

        {/* Right */}
        <YStack alignItems="flex-end" gap="$2">
          {meta.stockRemaining !== undefined && (
            <XStack alignItems="center" gap={3}
              backgroundColor={isLowStock ? '$redSoft' : '$fill'}
              paddingHorizontal="$2" paddingVertical={3} borderRadius="$2"
            >
              {isLowStock && <AlertTriangle size={10} color="#ff3b30" />}
              <Text fontSize={11} fontWeight="700" color={isLowStock ? '$red' : '$textSecondary'}>
                {stock} left
              </Text>
            </XStack>
          )}
          <TouchableOpacity
            onPress={() => handleTake(false)}
            style={{
              height: 32, paddingHorizontal: 14, borderRadius: 8,
              backgroundColor: canTake ? '#0d0d0d' : 'rgba(13,13,13,0.08)',
              alignItems: 'center', justifyContent: 'center',
              opacity: stock === 0 ? 0.35 : 1,
            }}
          >
            <Text fontSize={12} fontWeight="700" color={canTake ? 'white' : '$textSecondary'}>
              {canTake ? 'Take' : 'Wait'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTake(true)}
            style={{
              height: 28, paddingHorizontal: 12, borderRadius: 8,
              backgroundColor: 'rgba(0,122,255,0.10)',
              alignItems: 'center', justifyContent: 'center',
              opacity: stock === 0 ? 0.35 : 1,
              flexDirection: 'row',
              gap: 4,
            }}
          >
            <PlayCircle size={12} color="#007aff" />
            <Text fontSize={11} fontWeight="700" color="$blue">Timer</Text>
          </TouchableOpacity>
        </YStack>
      </XStack>
    </TouchableOpacity>
  );
}

function AddMedSheet({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dose, setDose] = useState('');
  const [stock, setStock] = useState('');
  const [minHours, setMinHours] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    createMedication(title.trim(), {
      dose: dose.trim() || undefined,
      initialStock: stock ? parseInt(stock) : undefined,
      stockRemaining: stock ? parseInt(stock) : undefined,
      refillThreshold: 5,
      minHoursBetweenDoses: minHours ? parseFloat(minHours) : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTitle(''); setDose(''); setStock(''); setMinHours('');
    onSaved(); onClose();
  };

  const fields = [
    { label: 'Medication name', value: title, set: setTitle, placeholder: 'e.g. Ibuprofen', auto: true, kb: 'default' },
    { label: 'Dose', value: dose, set: setDose, placeholder: 'e.g. 400mg', auto: false, kb: 'default' },
    { label: 'Stock (units)', value: stock, set: setStock, placeholder: 'e.g. 30', auto: false, kb: 'numeric' },
    { label: 'Min hours between doses', value: minHours, set: setMinHours, placeholder: 'e.g. 6', auto: false, kb: 'numeric' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <YStack flex={1} backgroundColor="$bg">
          <View width={36} height={4} borderRadius="$6" backgroundColor="$separator" alignSelf="center" marginTop="$3" />
          <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
            <Text fontSize="$6" fontWeight="800" color="$text" style={{ letterSpacing: -0.3 }}>Add Medication</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: 'rgba(13,13,13,0.08)', alignItems: 'center', justifyContent: 'center' }} hitSlop={12}>
              <X size={16} color="rgba(13,13,13,0.5)" strokeWidth={2.5} />
            </TouchableOpacity>
          </XStack>

          <YStack flex={1} paddingHorizontal="$4" paddingTop="$3" gap="$4">
            {fields.map(({ label, value, set, placeholder, auto, kb }) => (
              <YStack key={label} gap="$1">
                <Text fontSize={11} fontWeight="700" color="$textTertiary" style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {label}
                </Text>
                <View backgroundColor="$surface" borderRadius="$3" paddingHorizontal="$3" borderWidth={1} borderColor="$separator">
                  <Input
                    unstyled fontSize="$3" color="$text" paddingVertical="$3"
                    placeholder={placeholder} placeholderTextColor="rgba(13,13,13,0.28)"
                    value={value} onChangeText={set}
                    autoFocus={auto} keyboardType={kb as any}
                  />
                </View>
              </YStack>
            ))}
          </YStack>

          <XStack gap="$3" padding="$4" paddingBottom="$8">
            <TouchableOpacity onPress={onClose} style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,13,13,0.06)', borderRadius: 14 }}>
              <Text fontSize="$3" fontWeight="600" color="$textSecondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={!title.trim()} style={{ flex: 2, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d', borderRadius: 14, opacity: title.trim() ? 1 : 0.3 }}>
              <Text fontSize="$3" fontWeight="700" color="white">Save</Text>
            </TouchableOpacity>
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { medications, refresh, takeMedication } = useMedications();
  const [addOpen, setAddOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<Item | null>(null);

  const lowStock = medications.filter(m => {
    const meta: MedicationMeta = m.metadata ? JSON.parse(m.metadata) : {};
    return (meta.stockRemaining ?? 0) <= (meta.refillThreshold ?? 5);
  }).length;

  return (
    <YStack flex={1} backgroundColor="$bg" paddingTop={insets.top + 16}>

      {/* Header */}
      <XStack paddingHorizontal="$4" marginBottom="$5" alignItems="flex-end" justifyContent="space-between">
        <YStack>
          <Text fontSize={11} fontWeight="700" color="$textTertiary" style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            Protocol
          </Text>
          <Text fontSize="$7" fontWeight="800" color="$text" style={{ letterSpacing: -0.5 }}>Medications</Text>
          {lowStock > 0 && (
            <XStack alignItems="center" gap="$1" marginTop={4}>
              <AlertTriangle size={12} color="#ff8c42" />
              <Text fontSize="$2" color="#ff8c42" fontWeight="600">{lowStock} low stock</Text>
            </XStack>
          )}
        </YStack>
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={20} color="white" strokeWidth={2.5} />
        </TouchableOpacity>
      </XStack>

      {/* Stats row */}
      <XStack paddingHorizontal="$4" gap="$3" marginBottom="$5">
        {[
          { label: 'Tracked', value: medications.length, accent: false },
          { label: 'Low Stock', value: lowStock, accent: lowStock > 0 },
        ].map(({ label, value, accent }) => (
          <YStack
            key={label} flex={1} backgroundColor={accent ? '$redSoft' : '$surface'}
            borderRadius="$3" padding="$4"
            shadowColor="black" shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.04} shadowRadius={6} elevation={1}
          >
            <Text fontSize={11} fontWeight="700" color={accent ? '$red' : '$textTertiary'} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {label}
            </Text>
            <Text fontSize={32} fontWeight="800" color={accent ? '$red' : '$text'} marginTop={2}>
              {value}
            </Text>
          </YStack>
        ))}
      </XStack>

      {medications.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingBottom="$8">
          <View width={64} height={64} borderRadius="$6" backgroundColor="$fill" alignItems="center" justifyContent="center">
            <Pill size={28} color="rgba(13,13,13,0.2)" strokeWidth={1} />
          </View>
          <Text fontSize="$5" fontWeight="800" color="$text">No medications</Text>
          <Text fontSize="$2" color="$textSecondary">Tap + to add one</Text>
        </YStack>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 10 }}
          renderItem={({ item }) => (
            <MedRow
              item={item}
              onTake={(startTimer) => takeMedication(item.id, undefined, startTimer)}
              onLogPast={() => setLogTarget(item)}
            />
          )}
        />
      )}

      <AddMedSheet visible={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      {logTarget && (
        <LogDoseSheet
          visible={!!logTarget}
          medicationId={logTarget.id}
          medicationName={logTarget.title}
          onClose={() => setLogTarget(null)}
          onLog={(takenAt, startTimer) => { takeMedication(logTarget.id, takenAt, startTimer); setLogTarget(null); }}
        />
      )}
    </YStack>
  );
}
