import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, TouchableOpacity, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { upsertPlanBlockTravel, deletePlanBlock, getDefaultDeparturePoint, setDefaultDeparturePoint } from '../db/database';
import { parseTravelConfig, type TravelMode } from '../utils/backwardPlanMeta';
import { estimateTravel, type GeocodedPlace } from '../services/appleMaps';
import { buildAppleMapsDirectionsUrl } from '../utils/appleMapsLink';
import { LocationSearchField } from './LocationSearchField';
import { Navigation, MapPin } from '../icons';
import type { PlanBlockWithSteps } from '../db/database';

interface TravelToggleCardProps {
  planId: string;
  travelBlock: PlanBlockWithSteps | null;
  anchorLocation?: string;
  onChange: () => void;
}

const TRAVEL_MODES: TravelMode[] = ['driving', 'walking', 'transit'];
const SAVE_DEBOUNCE_MS = 500;

// Travel as a single toggleable feature per plan, not a repeatable "Add"
// item (you travel once to the anchor event) — lives directly in the anchor
// area of PlanBackwardsDetailScreen. Off = no travel block exists for this
// plan; on = one does, and its fields are edited inline here with debounced
// auto-save (no separate Save button — same low-friction feel as the plan's
// Notes field). Toggling off deletes the block outright; the ordered
// backwards-plan list below still picks it up like any other block once on,
// since it's a real timed block with its own Leave By.
export function TravelToggleCard({ planId, travelBlock, anchorLocation, onChange }: TravelToggleCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const isOn = travelBlock !== null;

  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<TravelMode>('driving');
  const [duration, setDuration] = useState('20');
  const [buffer, setBuffer] = useState('10');
  const [estimateStatus, setEstimateStatus] = useState<'idle' | 'loading' | 'live' | 'failed'>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | undefined>(undefined);
  const [startCoords, setStartCoords] = useState<GeocodedPlace | null>(null);

  // Seeds local state once per block id — deliberately NOT re-run on every
  // travelBlock update (which happens after our own debounced saves below),
  // or a save-triggered refresh would clobber whatever the user just typed.
  const seededForId = useRef<string | null>(null);
  useEffect(() => {
    if (!travelBlock) {
      seededForId.current = null;
      return;
    }
    if (seededForId.current === travelBlock.id) return;
    seededForId.current = travelBlock.id;
    const cfg = parseTravelConfig(travelBlock.travelConfig);
    setStart(cfg.startLocation ?? '');
    setDestination(cfg.destination ?? '');
    setMode(cfg.mode);
    setDuration(String(cfg.durationMinutes));
    setBuffer(String(cfg.bufferMinutes ?? 0));
    setEstimateStatus(cfg.source === 'live' ? 'live' : 'idle');
    setDistanceMeters(cfg.distanceMeters);
  }, [travelBlock]);

  // Debounced auto-save whenever a field changes while on.
  useEffect(() => {
    if (!isOn) return;
    const t = setTimeout(() => {
      if (start.trim()) setDefaultDeparturePoint(start.trim());
      const title = destination.trim() ? `Travel to ${destination.trim()}` : 'Travel';
      upsertPlanBlockTravel(planId, title, {
        startLocation: start.trim() || undefined,
        destination: destination.trim() || undefined,
        mode,
        durationMinutes: Math.max(1, parseInt(duration, 10) || 20),
        bufferMinutes: Math.max(0, parseInt(buffer, 10) || 0),
        source: estimateStatus === 'live' ? 'live' : 'manual',
        distanceMeters: estimateStatus === 'live' ? distanceMeters : undefined,
        estimatedAt: estimateStatus === 'live' ? Date.now() : undefined,
      });
      onChange();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, destination, mode, duration, buffer, estimateStatus, isOn]);

  const handleToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!value) {
      if (travelBlock) deletePlanBlock(travelBlock.id);
      onChange();
      return;
    }
    const defaultStart = getDefaultDeparturePoint();
    const defaultDest = anchorLocation ?? '';
    const title = defaultDest ? `Travel to ${defaultDest}` : 'Travel';
    upsertPlanBlockTravel(planId, title, {
      startLocation: defaultStart || undefined,
      destination: defaultDest || undefined,
      mode: 'driving',
      durationMinutes: 20,
      bufferMinutes: 10,
      source: 'manual',
    });
    onChange();
  };

  const editStart = (value: string) => {
    setStart(value);
    setEstimateStatus('idle');
    setDistanceMeters(undefined);
    setStartCoords(null);
  };
  const editField = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setEstimateStatus('idle');
    setDistanceMeters(undefined);
  };

  const handleGetLiveEstimate = async () => {
    if (!start.trim() || !destination.trim()) return;
    Haptics.selectionAsync();
    setEstimateStatus('loading');
    const result = await estimateTravel(start, destination, mode);
    if (result) {
      setDuration(String(Math.max(1, Math.round(result.durationSeconds / 60))));
      setDistanceMeters(result.distanceMeters);
      setEstimateStatus('live');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setEstimateStatus('failed');
    }
  };

  const handleOpenInMaps = () => {
    const url = buildAppleMapsDirectionsUrl(start, destination, mode);
    if (!url) return;
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Navigation size={16} color={isOn ? palette.deeperBlue : palette.textTertiary} strokeWidth={1.8} />
          <Text style={[styles.title, { color: palette.text }]}>Travel</Text>
        </View>
        <Switch value={isOn} onValueChange={handleToggle} trackColor={{ false: palette.fill, true: palette.deeperBlue }} />
      </View>

      {isOn && (
        <View style={styles.fields}>
          <Text style={[styles.label, { color: palette.textTertiary }]}>FROM</Text>
          <LocationSearchField
            placeholder="Start location"
            value={start}
            onChangeText={editStart}
            onSelectPlace={(place) => setStartCoords({ latitude: place.latitude, longitude: place.longitude })}
          />
          <Text style={[styles.label, { color: palette.textTertiary, marginTop: 12 }]}>TO</Text>
          <LocationSearchField
            placeholder="Destination"
            value={destination}
            onChangeText={editField(setDestination)}
            etaOrigin={startCoords}
            etaMode={mode}
          />
          <Text style={[styles.label, { color: palette.textTertiary, marginTop: 12 }]}>MODE</Text>
          <View style={styles.chipRow}>
            {TRAVEL_MODES.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.chip,
                  { borderColor: mode === m ? palette.deeperBlue : palette.separator, backgroundColor: mode === m ? palette.deeperBlueSoft : 'transparent' },
                ]}
                onPress={() => editField(setMode)(m)}
              >
                <Text style={[styles.chipText, { color: mode === m ? palette.deeperBlue : palette.textSecondary }]}>
                  {m[0].toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: palette.deeperBlue, opacity: start.trim() && destination.trim() ? 1 : 0.4 }]}
              disabled={!start.trim() || !destination.trim() || estimateStatus === 'loading'}
              onPress={handleGetLiveEstimate}
            >
              <Navigation size={13} color={palette.deeperBlue} strokeWidth={2} />
              <Text style={[styles.actionText, { color: palette.deeperBlue }]} numberOfLines={1}>
                {estimateStatus === 'loading' ? 'Getting ETA…' : 'Get live ETA'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: palette.separator, opacity: destination.trim() ? 1 : 0.4 }]}
              disabled={!destination.trim()}
              onPress={handleOpenInMaps}
            >
              <MapPin size={13} color={palette.textSecondary} strokeWidth={2} />
              <Text style={[styles.actionText, { color: palette.textSecondary }]}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
          {estimateStatus === 'live' && (
            <Text style={[styles.statusText, { color: palette.green }]}>
              Live estimate{distanceMeters ? ` · ${(distanceMeters / 1000).toFixed(1)} km` : ''}
            </Text>
          )}
          {estimateStatus === 'failed' && (
            <Text style={[styles.statusText, { color: palette.textTertiary }]}>Couldn't get a live estimate — duration below is manual.</Text>
          )}

          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <Text style={[styles.label, { color: palette.textTertiary }]}>DURATION (MIN)</Text>
              <TextInput
                style={[styles.fieldInput, { color: palette.text, borderColor: palette.separator }]}
                value={duration}
                onChangeText={editField(setDuration)}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.durationField}>
              <Text style={[styles.label, { color: palette.textTertiary }]}>BUFFER (MIN)</Text>
              <TextInput
                style={[styles.fieldInput, { color: palette.text, borderColor: palette.separator }]}
                value={buffer}
                onChangeText={setBuffer}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  fields: { marginTop: 14, gap: 2 },
  label: { fontSize: 10, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6 },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  statusText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
  durationRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  durationField: { flex: 1 },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
});
