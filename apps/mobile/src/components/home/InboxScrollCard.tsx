import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from '../../icons';
import { getThemeColors } from '../../theme';
import { RiverStoneSurface } from '../riverstone';

interface InboxScrollCardProps {
  inboxCount: number;
  onPress: () => void;
  isDark: boolean;
}

// Full-width tile on HomeScreen.tsx. Restructured from the old horizontal
// row (illustration/icon + stat + text + chevron all in one line) to a column:
// illustration on top, stat + text stacked below, chevron as a small
// top-right corner accent instead of competing with the illustration. Color
// and depth now come entirely from RiverStoneSurface (this card has no
// deliberate color of its own — its old gradient/shadow was already
// approximating a neutral graphite tone, now genuinely shared/consistent
// with every other neutral surface instead of a near-duplicate one-off).
export function InboxScrollCard({ inboxCount, onPress, isDark }: InboxScrollCardProps) {
  const hasItems = inboxCount > 0;
  const isFull = inboxCount > 10;
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

  return (
    <TouchableOpacity
      onPress={hasItems ? handlePress : undefined}
      activeOpacity={hasItems ? 0.75 : 1}
      style={styles.touchWrap}
    >
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.content}>
          {hasItems && <ChevronRight size={15} color={attentionColor} strokeWidth={2} style={styles.chevron} />}

          <View style={styles.illustrationWrap}>
            <Image
              source={
                !hasItems
                  ? require('../../../assets/illustrations/inbox/inbox-empty.png')
                  : isFull
                    ? require('../../../assets/illustrations/inbox/inbox-full.png')
                    : require('../../../assets/illustrations/inbox/inbox-active.png')
              }
              style={styles.illustration}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <View>
            {/* Stat number — pulled out as its own figure (the part that's
                actually changing) rather than folded into the sentence, so it
                reads at a glance like a counter. */}
            {hasItems && <Text style={[styles.statNumber, { color: attentionColor }]}>{inboxCount}</Text>}

            <Text style={[styles.primaryText, { color: textColor }]}>
              {isFull ? 'inbox is full' : hasItems ? `unopened scroll${inboxCount > 1 ? 's' : ''}` : 'All clear'}
            </Text>
            <Text style={[styles.secondaryText, { color: secondaryColor }]} numberOfLines={1}>
              {isFull ? 'Review your scrolls' : hasItems ? 'Tap to review' : 'No unattended matters.'}
            </Text>
          </View>
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    // Breathing room around the card so its drop shadow isn't clipped by a
    // tight-fitting parent.
    paddingVertical: 4,
  },
  fill: {
    flex: 1,
  },
  squareCard: {
    // Final compact proportion, shortened again after the device comparison.
    aspectRatio: 1.16,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
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
    transform: [{ translateY: 4 }],
  },
  illustration: {
    width: 118,
    height: 96,
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
