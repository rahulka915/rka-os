import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { LocationSearchField } from './LocationSearchField';

interface DefaultDepartureSheetProps {
  visible: boolean;
  initialValue: string;
  onClose: () => void;
  onSubmit: (location: string) => void;
}

// A user's "usual departure point" (spec section 13) — set once here instead
// of retyped on every new Travel block. AddPlanBlockSheet's From field still
// prefills from this (getDefaultDeparturePoint) and silently re-saves it
// whenever a Travel block is added with a different From, so this setting
// and "whatever you last typed" stay the same value either way.
export function DefaultDepartureSheet({ visible, initialValue, onClose, onSubmit }: DefaultDepartureSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(value.trim());
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title="Default Departure"
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      <Text style={[styles.helperText, { color: palette.textSecondary }]}>
        Prefills the "From" field whenever you add a Travel block in Plan Backwards — e.g. your home or usual station.
      </Text>
      <View style={styles.fieldWrap}>
        <LocationSearchField placeholder="e.g. Home, or an address" value={value} onChangeText={setValue} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16 },
  content: { paddingBottom: spacing[6], gap: 10 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular', fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  helperText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  fieldWrap: { marginTop: 4 },
});
