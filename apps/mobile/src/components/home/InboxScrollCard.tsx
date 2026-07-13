import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, ChevronRight } from '../../icons';
import { ScrollIcon } from '../icons/ScrollIcon';
import { getThemeColors } from '../../theme';

interface InboxScrollCardProps {
  inboxCount: number;
  onPress: () => void;
  isDark: boolean;
}

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
  const attentionSoft = palette.deeperBlueSoft;
  const textColor = palette.text;
  const secondaryColor = palette.textMuted;

  // Depth comes from real elevation + a top-lit gradient surface + a glow
  // behind the icon bubble — same shadow/glow language already used for the
  // dock FAB and NextUp's badge — rather than the old stacked-duplicate-card
  // "paper stack" illusion.
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
        {/* Icon bubble */}
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: hasItems ? attentionSoft : 'rgba(52,168,83,0.14)' },
            hasItems && { shadowColor: attentionColor, shadowOpacity: isDark ? 0.4 : 0.22 },
          ]}
        >
          {hasItems ? (
            <ScrollIcon size={19} color={attentionColor} strokeWidth={1.6} />
          ) : (
            <CheckCircle2 size={19} color="#34a853" strokeWidth={1.5} />
          )}
        </View>

        {/* Stat number — pulled out as its own figure (the part that's
            actually changing) rather than folded into the sentence, so it
            reads at a glance like a counter. Explicit lineHeight so its own
            font leading doesn't throw off the row's center alignment. */}
        {hasItems && (
          <Text style={[styles.statNumber, { color: attentionColor }]}>{inboxCount}</Text>
        )}

        <View style={styles.textGroup}>
          <Text style={[styles.primaryText, { color: textColor }]}>
            {hasItems ? `unopened scroll${inboxCount > 1 ? 's' : ''}` : 'All clear'}
          </Text>
          <Text style={[styles.secondaryText, { color: secondaryColor }]}>
            {hasItems ? 'Tap to review' : 'No unattended matters.'}
          </Text>
        </View>

        {hasItems && <ChevronRight size={16} color={attentionColor} strokeWidth={2} />}
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
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  textGroup: {
    flex: 1,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryText: {
    fontSize: 12,
    marginTop: 2,
  },
});
