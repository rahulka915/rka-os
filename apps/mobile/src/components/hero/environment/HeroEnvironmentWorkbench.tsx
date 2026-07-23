import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { HeroEnvironment, type HeroInboxState, type HeroTimeOfDay, type HeroWeather } from './HeroEnvironment';
import {
  HERO_LAYER_ORDER,
  HERO_LAYER_REGISTRATION,
  HERO_MASTER_VIEWPORT,
  type HeroLayerId,
  type HeroLayerRegistration,
} from './heroEnvironmentRegistration';

const STORAGE_KEY = 'rka.heroEnvironment.registrationOverrides.v1';
const TIME_OPTIONS: HeroTimeOfDay[] = ['morning', 'day', 'evening', 'night'];
const WEATHER_OPTIONS: HeroWeather[] = ['clear', 'rain', 'snow', 'fireflies', 'fallingPetals'];
const INBOX_OPTIONS: HeroInboxState[] = ['empty', 'partial', 'full'];

type RegistrationOverrides = Partial<Record<HeroLayerId, Partial<HeroLayerRegistration>>>;

interface StepperProps {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  digits?: number;
}

function Stepper({ label, value, step, onChange, digits = 0 }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(Number((value - step).toFixed(digits)))}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value.toFixed(digits)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(Number((value + step).toFixed(digits)))}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionSection}>
      <Text style={styles.optionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [styles.optionChip, value === option && styles.optionChipSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.optionChipText, value === option && styles.optionChipTextSelected]}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function HeroEnvironmentWorkbench() {
  const { width: windowWidth } = useWindowDimensions();
  const previewWidth = Math.max(280, windowWidth - 32);
  const previewHeight = previewWidth * HERO_MASTER_VIEWPORT.crop.height / HERO_MASTER_VIEWPORT.crop.width;
  const [selectedLayer, setSelectedLayer] = useState<HeroLayerId>('hero_fuji');
  const [overrides, setOverrides] = useState<RegistrationOverrides>({});
  const [visibility, setVisibility] = useState<Partial<Record<HeroLayerId, boolean>>>({});
  const [showGuides, setShowGuides] = useState(true);
  const [solo, setSolo] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<HeroTimeOfDay>('day');
  const [weather, setWeather] = useState<HeroWeather>('clear');
  const [inboxState, setInboxState] = useState<HeroInboxState>('partial');
  const [status, setStatus] = useState('Production registration loaded');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        setOverrides(JSON.parse(stored) as RegistrationOverrides);
        setStatus('Saved device overrides loaded');
      } catch {
        setStatus('Saved overrides could not be read');
      }
    });
  }, []);

  const effective = { ...HERO_LAYER_REGISTRATION[selectedLayer], ...overrides[selectedLayer] };
  const effectiveVisibility = useMemo(() => {
    if (!solo) return visibility;
    return Object.fromEntries(HERO_LAYER_ORDER.map((id) => [id, id === selectedLayer])) as Partial<Record<HeroLayerId, boolean>>;
  }, [selectedLayer, solo, visibility]);
  const previewInboxState = solo && selectedLayer.startsWith('hero_inbox_tray_')
    ? selectedLayer.replace('hero_inbox_tray_', '') as HeroInboxState
    : inboxState;
  const previewTimeOfDay = solo && selectedLayer === 'hero_morning_mist'
    ? 'morning'
    : solo && selectedLayer === 'hero_evening_haze'
      ? 'evening'
      : timeOfDay;
  const previewWeather = solo && selectedLayer.startsWith('hero_')
    && ['hero_rain', 'hero_snow', 'hero_fireflies', 'hero_falling_petals'].includes(selectedLayer)
    ? selectedLayer.replace('hero_', '') as HeroWeather
    : weather;
  const previewFocusState = solo && selectedLayer === 'hero_scroll' ? 'idle' : 'active';

  const update = (key: keyof HeroLayerRegistration, value: number) => {
    setOverrides((current) => ({
      ...current,
      [selectedLayer]: { ...current[selectedLayer], [key]: value },
    }));
  };

  const exportRegistration = () => {
    const merged = Object.fromEntries(HERO_LAYER_ORDER.map((id) => [
      id,
      { ...HERO_LAYER_REGISTRATION[id], ...overrides[id] },
    ]));
    Clipboard.setStringAsync(JSON.stringify(merged, null, 2));
    setStatus('Merged registration copied to clipboard');
  };

  const persist = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    setStatus('Device overrides saved');
  };

  const reset = async () => {
    setOverrides({});
    setVisibility({});
    await AsyncStorage.removeItem(STORAGE_KEY);
    setStatus('Production registration restored');
  };

  return (
    <View style={styles.workbench}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Hero registration</Text>
          <Text style={styles.subtitle}>1536 × 864 · Riverstone crop locked</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showGuides }}
          onPress={() => setShowGuides((value) => !value)}
          style={({ pressed }) => [styles.headerButton, showGuides && styles.headerButtonSelected, pressed && styles.pressed]}
        >
          <Text style={styles.headerButtonText}>Guides</Text>
        </Pressable>
      </View>

      <HeroEnvironment
        timeOfDay={previewTimeOfDay}
        weather={previewWeather}
        inboxState={previewInboxState}
        focusState={previewFocusState}
        parallaxEnabled={false}
        viewportWidth={previewWidth}
        viewportHeight={previewHeight}
        showGuides={showGuides}
        layerVisibility={effectiveVisibility}
        registrationOverrides={overrides}
        style={styles.preview}
        testID="hero-environment-workbench-preview"
      />

      <OptionRow label="Time" value={timeOfDay} options={TIME_OPTIONS} onChange={setTimeOfDay} />
      <OptionRow label="Weather" value={weather} options={WEATHER_OPTIONS} onChange={setWeather} />
      <OptionRow label="Inbox" value={inboxState} options={INBOX_OPTIONS} onChange={setInboxState} />

      <Text style={styles.optionLabel}>Layers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
        {HERO_LAYER_ORDER.map((id) => {
          const enabled = visibility[id] !== false;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: id === selectedLayer, disabled: !enabled }}
              onPress={() => setSelectedLayer(id)}
              onLongPress={() => setVisibility((current) => ({ ...current, [id]: !enabled }))}
              style={({ pressed }) => [
                styles.layerChip,
                id === selectedLayer && styles.layerChipSelected,
                !enabled && styles.layerChipDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.layerChipText}>{id.replace('hero_', '')}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.selectedRow}>
        <View>
          <Text style={styles.selectedTitle}>{selectedLayer}</Text>
          <Text style={styles.selectedGroup}>{effective.group}</Text>
        </View>
        <View style={styles.selectedActions}>
          <Pressable onPress={() => setSolo((value) => !value)} style={[styles.smallButton, solo && styles.headerButtonSelected]}>
            <Text style={styles.smallButtonText}>Solo</Text>
          </Pressable>
          <Pressable
            onPress={() => setVisibility((current) => ({ ...current, [selectedLayer]: current[selectedLayer] === false }))}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{visibility[selectedLayer] === false ? 'Show' : 'Hide'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.controlsGrid}>
        <Stepper label="X" value={effective.x} step={4} onChange={(value) => update('x', value)} />
        <Stepper label="Y" value={effective.y} step={4} onChange={(value) => update('y', value)} />
        <Stepper label="Scale" value={effective.scale} step={0.01} digits={3} onChange={(value) => update('scale', Math.max(0.01, value))} />
        <Stepper label="Opacity" value={effective.opacity ?? 1} step={0.05} digits={2} onChange={(value) => update('opacity', Math.max(0, Math.min(1, value)))} />
        <Stepper label="Rotation" value={effective.rotation ?? 0} step={1} onChange={(value) => update('rotation', value)} />
      </View>

      <View style={styles.footerActions}>
        <Pressable onPress={persist} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Text style={styles.actionButtonText}>Save</Text>
        </Pressable>
        <Pressable onPress={exportRegistration} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Text style={styles.actionButtonText}>Copy JSON</Text>
        </Pressable>
        <Pressable onPress={reset} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Text style={styles.actionButtonText}>Reset</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  workbench: {
    width: '100%',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: '#0d1017',
    borderRadius: 18,
    overflow: 'hidden',
  },
  headerRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#f2ede6', fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { color: '#9298a5', fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  headerButton: { minWidth: 64, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1e28' },
  headerButtonSelected: { backgroundColor: '#273c57', borderColor: '#65b9ff', borderWidth: 1 },
  headerButtonText: { color: '#d8dce4', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  preview: { alignSelf: 'center', borderWidth: 1, borderColor: '#2c3341' },
  optionSection: { gap: 6 },
  optionLabel: { paddingHorizontal: 16, color: '#8f96a5', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Inter_700Bold' },
  optionRow: { paddingHorizontal: 16, gap: 8 },
  optionChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#181c25', alignItems: 'center', justifyContent: 'center' },
  optionChipSelected: { backgroundColor: '#3d3226', borderWidth: 1, borderColor: '#d4b078' },
  optionChipText: { color: '#9ca2ad', fontSize: 12, fontFamily: 'Inter_500Medium' },
  optionChipTextSelected: { color: '#f1d39a' },
  layerRow: { paddingHorizontal: 16, gap: 8 },
  layerChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#181c25', justifyContent: 'center' },
  layerChipSelected: { backgroundColor: '#273c57', borderWidth: 1, borderColor: '#65b9ff' },
  layerChipDisabled: { opacity: 0.35 },
  layerChipText: { color: '#d8dce4', fontSize: 11, fontFamily: 'Inter_500Medium' },
  selectedRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedTitle: { color: '#f2ede6', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  selectedGroup: { color: '#858c99', fontSize: 11, marginTop: 2 },
  selectedActions: { flexDirection: 'row', gap: 8 },
  smallButton: { minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#1a1e28', alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#d8dce4', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  controlsGrid: { paddingHorizontal: 16, gap: 8 },
  stepper: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2e38' },
  stepperLabel: { color: '#aeb3bd', fontSize: 13, fontFamily: 'Inter_500Medium' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1b202a', alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { color: '#f2ede6', fontSize: 22, fontFamily: 'Inter_400Regular' },
  stepValue: { minWidth: 72, color: '#8ec8ff', textAlign: 'center', fontVariant: ['tabular-nums'], fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  footerActions: { paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#202631', alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#f2ede6', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  status: { paddingHorizontal: 16, color: '#7f8794', fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
