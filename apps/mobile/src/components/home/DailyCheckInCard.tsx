import { Text, TouchableOpacity, View } from 'react-native';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';
import type { DailyCheckInPromptState } from '../../utils/dailyCheckIn';

interface DailyCheckInCardProps {
  isDark: boolean;
  state: DailyCheckInPromptState;
  onOpen: () => void;
  onHistory: () => void;
}

export function DailyCheckInCard({ isDark, state, onOpen, onHistory }: DailyCheckInCardProps) {
  const palette = getThemeColors(isDark);
  const copy = (() => {
    if (state.kind === 'morning') return { title: 'Morning check-in', body: 'Sleep, state, intention, and what matters today.', cta: 'Check in' };
    if (state.kind === 'catch-up') return { title: 'Log today so far', body: 'A quiet catch-up for the morning you started with.', cta: 'Catch up' };
    if (state.kind === 'evening') return { title: 'Evening debrief', body: 'Close the loop without turning it into a performance review.', cta: 'Debrief' };
    if (state.kind === 'logged') return { title: 'Today logged', body: 'Your daily signal is tucked away for review.', cta: 'View log' };
    return { title: 'Daily log', body: 'Check in and debrief when the day calls for it.', cta: 'History' };
  })();

  const primary = state.kind === 'logged' || state.kind === 'idle' ? onHistory : onOpen;

  return (
    <View style={{ marginHorizontal: 12, marginTop: 8 }}>
      <RiverStoneSurface
        variant="card"
        mode={isDark ? 'dark' : 'light'}
        shape="regular"
        contentStyle={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>
              {copy.title}
            </Text>
            <Text style={{ color: palette.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {copy.body}
            </Text>
          </View>
          <TouchableOpacity
            onPress={primary}
            style={{
              minHeight: 36,
              justifyContent: 'center',
              paddingHorizontal: 12,
              borderRadius: 18,
              backgroundColor: palette.vermilion,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>
              {copy.cta}
            </Text>
          </TouchableOpacity>
        </View>
        {state.kind !== 'logged' && state.kind !== 'idle' ? (
          <TouchableOpacity onPress={onHistory} style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' }}>
            <Text style={{ color: palette.textTertiary, fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>
              View history
            </Text>
          </TouchableOpacity>
        ) : null}
      </RiverStoneSurface>
    </View>
  );
}
