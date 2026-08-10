import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors } from '../theme';
import { searchLocations, getEtasBatch, type LocationSearchResult, type GeocodedPlace, type EtaResult } from '../services/appleMaps';
import { getApproximateLocation } from '../services/deviceLocation';
import { formatDurationMinutes } from '../utils/backwardPlanCalc';
import type { TravelMode } from '../utils/backwardPlanMeta';
import { MapPin } from '../icons';

interface LocationSearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace?: (place: LocationSearchResult) => void;
  placeholder?: string;
  // When both are supplied (AddPlanBlockSheet's Travel "To" field, once
  // "From" has a resolved location), each dropdown row also shows a live
  // ETA batched in one /v1/etas call — never a requirement, just an extra
  // signal while picking between candidates, same as native Maps search.
  etaOrigin?: GeocodedPlace | null;
  etaMode?: TravelMode;
}

const DEBOUNCE_MS = 300;

// Text field with an Apple Maps-backed "search as you type" dropdown — used
// for the anchor event's Location field and Travel's From/To fields. Typing
// still works as free text with no results (fails soft, same as the rest of
// the Apple Maps integration); picking a suggestion just fills the text and,
// where the caller cares, hands back the coordinate directly so a later
// geocode() call isn't needed for that value.
export function LocationSearchField({ value, onChangeText, onSelectPlace, placeholder, etaOrigin, etaMode }: LocationSearchFieldProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [etas, setEtas] = useState<Array<EtaResult | null>>([]);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const nearRef = useRef<GeocodedPlace | null>(null);
  const nearRequestedRef = useRef(false);

  // Fetched lazily on first focus (not on mount) — no permission prompt
  // until the user actually starts using this field. Cached module-wide in
  // deviceLocation.ts, so multiple fields (Location, Travel From/To) on the
  // same screen only prompt/fetch once.
  useEffect(() => {
    if (!focused || nearRequestedRef.current) return;
    nearRequestedRef.current = true;
    getApproximateLocation().then((coords) => {
      nearRef.current = coords;
    });
  }, [focused]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!focused || value.trim().length < 3) {
      setResults([]);
      setEtas([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const found = await searchLocations(value, nearRef.current ?? undefined);
      // A slower earlier request can resolve after a newer one — ignore it
      // rather than flashing stale results over the current query.
      if (requestIdRef.current !== requestId) return;
      setResults(found);
      setEtas([]);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value, focused]);

  // Separate from the search debounce above — fires once results settle,
  // one batched call for the whole visible list rather than per-row.
  useEffect(() => {
    if (!etaOrigin || !etaMode || results.length === 0) return;
    const requestId = requestIdRef.current;
    getEtasBatch(etaOrigin, results.map((r) => ({ latitude: r.latitude, longitude: r.longitude })), etaMode).then((found) => {
      if (requestIdRef.current === requestId) setEtas(found);
    });
  }, [results, etaOrigin, etaMode]);

  const handleSelect = (place: LocationSearchResult) => {
    Haptics.selectionAsync();
    onChangeText(place.title);
    onSelectPlace?.(place);
    setResults([]);
    setFocused(false);
  };

  return (
    <View>
      <TextInput
        style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
        placeholder={placeholder ?? 'Search for a place or address'}
        placeholderTextColor={palette.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: material.surfaceRaised, borderColor: material.rim }]}>
          {results.map((place, index) => (
            <TouchableOpacity
              key={`${place.title}-${index}`}
              style={[styles.row, index < results.length - 1 && { borderBottomColor: material.rim, borderBottomWidth: StyleSheet.hairlineWidth }]}
              onPress={() => handleSelect(place)}
            >
              <MapPin size={14} color={palette.textTertiary} strokeWidth={1.8} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{place.title}</Text>
                {place.subtitle ? (
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>{place.subtitle}</Text>
                ) : null}
              </View>
              {etas[index] ? (
                <Text style={[styles.rowEta, { color: material.accent }]}>
                  {formatDurationMinutes(etas[index]!.durationSeconds / 60)}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  dropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  rowSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowEta: { fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700' },
});
