import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PotentialOverview } from '../components/potential/PotentialOverview';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';

// Me shares the Harada data/visual component with Potential but uses its
// compact personal-summary mode; the full Domain breakdown belongs to the
// dedicated Potential and Domains screens.
export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
      >
        <View style={styles.potentialSection}>
          <Text style={[styles.sectionLabel, { color: palette.antiqueBrass }]}>ME</Text>
          <PotentialOverview showAchievementsLink={false} mode="me" />
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Menu', { screen: 'Skills' })}
          style={[styles.logRow, { backgroundColor: palette.surface, borderColor: palette.separator }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.logTitle, { color: palette.text }]}>Skills</Text>
            <Text style={[styles.logSubtitle, { color: palette.textSecondary }]}>Capabilities you develop</Text>
          </View>
          <Text style={{ color: palette.textTertiary, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Menu', { screen: 'Achievements' })}
          style={[styles.logRow, { backgroundColor: palette.surface, borderColor: palette.separator }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.logTitle, { color: palette.text }]}>Achievements</Text>
            <Text style={[styles.logSubtitle, { color: palette.textSecondary }]}>Permanent record of what you’ve accomplished</Text>
          </View>
          <Text style={{ color: palette.textTertiary, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Menu', { screen: 'DailyLog' })}
          style={[styles.logRow, { backgroundColor: palette.surface, borderColor: palette.separator }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.logTitle, { color: palette.text }]}>Daily Log</Text>
            <Text style={[styles.logSubtitle, { color: palette.textSecondary }]}>Morning check-ins and evening debriefs</Text>
          </View>
          <Text style={{ color: palette.textTertiary, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[2],
    gap: spacing[3],
  },
  potentialSection: {
    paddingHorizontal: spacing[2],
  },
  sectionLabel: {
    marginBottom: spacing[2],
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  logRow: {
    marginHorizontal: spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  logSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
});
