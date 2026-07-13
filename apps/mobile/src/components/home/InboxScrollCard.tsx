import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, ChevronRight } from '../../icons';
import { getThemeColors } from '../../theme';

interface InboxScrollCardProps {
  inboxCount: number;
  onPress: () => void;
  isDark: boolean;
}

// Square tile — sits side by side with NextUpCard (see HomeScreen.tsx), each
// taking half the row width. Restructured from the old horizontal row
// (illustration/icon + stat + text + chevron all in one line) to a column:
// illustration on top, stat + text stacked below, chevron as a small
// top-right corner accent instead of competing with the illustration.
export function InboxScrollCard({ inboxCount, onPress, isDark }: InboxScrollCardProps) {
  const hasItems = inboxCount > 0;
  const palette = getThemeColors(isDark);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Deeper blue accent for the "needs attention" state in both modes — the
  // theme no longer splits primary color by light/dark. Green stays for the
  // all-clear state in both — it's a semantic success color, not a theme accent.
  const attentionColor = palette.deeperBlue;
  const textColor = palette.text;
  const secondaryColor = palette.textMuted;

  // Depth comes from real elevation + a top-lit gradient surface — same
  // shadow language already used for the dock FAB — rather than the old
  // stacked-duplicate-card "paper stack" illusion.
  const gradientColors: [string, string] = isDark ? ['#1f2038', '#1a1a2e'] : ['#ffffff', '#faf9f6'];

  return (
    <TouchableOpacity
      onPress={hasItems ? handlePress : undefined}
      activeOpacity={hasItems ? 0.75 : 1}
      style={styles.touchWrap}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.card, isDark ? styles.cardShadowDark : styles.cardShadowLight]}
      >
        {hasItems && <ChevronRight size={15} color={attentionColor} strokeWidth={2} style={styles.chevron} />}

        <View style={styles.illustrationWrap}>
          {hasItems ? (
            <Image
              source={require('../../../assets/illustrations/scroll-stack.png')}
              style={styles.illustration}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.iconBubble, { backgroundColor: 'rgba(52,168,83,0.14)' }]}>
              <CheckCircle2 size={22} color="#34a853" strokeWidth={1.5} />
            </View>
          )}
        </View>

        <View>
          {/* Stat number — pulled out as its own figure (the part that's
              actually changing) rather than folded into the sentence, so it
              reads at a glance like a counter. */}
          {hasItems && <Text style={[styles.statNumber, { color: attentionColor }]}>{inboxCount}</Text>}

          <Text style={[styles.primaryText, { color: textColor }]}>
            {hasItems ? `unopened scroll${inboxCount > 1 ? 's' : ''}` : 'All clear'}
          </Text>
          <Text style={[styles.secondaryText, { color: secondaryColor }]} numberOfLines={1}>
            {hasItems ? 'Tap to review' : 'No unattended matters.'}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    // Breathing room around the card so its drop shadow isn't clipped by a
    // tight-fitting parent.
    paddingVertical: 4,
  },
  card: {
    aspectRatio: 1,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardShadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
  },
  cardShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  chevron: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 88,
    height: 58,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryText: {
    fontSize: 11,
    marginTop: 2,
  },
});
