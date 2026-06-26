import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Inbox, CheckCircle2, ChevronRight } from '../../icons';

interface InboxScrollCardProps {
  inboxCount: number;
  onPress: () => void;
  isDark: boolean;
}

export function InboxScrollCard({ inboxCount, onPress, isDark }: InboxScrollCardProps) {
  const hasItems = inboxCount > 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const cardBg = isDark ? '#1e1e1e' : '#ffffff';

  return (
    <View style={styles.container}>
      {/* Shadow cards — stacked paper effect */}
      <View style={[styles.shadowCard, styles.shadowCard3, { backgroundColor: isDark ? '#161616' : '#e8e8e8' }]} />
      <View style={[styles.shadowCard, styles.shadowCard2, { backgroundColor: isDark ? '#191919' : '#efefef' }]} />

      {/* Foreground card */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={[styles.foregroundCard, { backgroundColor: cardBg }]}
      >
        {/* Icon bubble */}
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: hasItems ? 'rgba(193,18,31,0.15)' : 'rgba(52,171,83,0.14)' },
          ]}
        >
          {hasItems ? (
            <Inbox size={17} color="#c1121f" strokeWidth={1.5} />
          ) : (
            <CheckCircle2 size={17} color="#34ab53" strokeWidth={1.5} />
          )}
        </View>

        {/* Text */}
        <View style={styles.textGroup}>
          <Text style={styles.primaryText}>
            {hasItems
              ? `${inboxCount} unopened scroll${inboxCount > 1 ? 's' : ''}`
              : 'No unattended matters remain'}
          </Text>
          <Text style={styles.secondaryText}>
            {hasItems ? 'Tap to review' : 'All resolved'}
          </Text>
        </View>

        {/* Chevron */}
        {hasItems && <ChevronRight size={14} color="#c1121f" strokeWidth={2} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    position: 'relative',
  },
  shadowCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 14,
  },
  shadowCard3: {
    top: 6,
    marginHorizontal: 18,
    height: 66,
    opacity: 0.5,
  },
  shadowCard2: {
    top: 3,
    marginHorizontal: 10,
    height: 70,
    opacity: 0.7,
  },
  foregroundCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 62,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  secondaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 2,
  },
});
