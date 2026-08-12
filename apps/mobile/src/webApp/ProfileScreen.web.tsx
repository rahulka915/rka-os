import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBackup } from '../hooks/useBackup';
import { PotentialOverview } from './PotentialOverview.web';
import { AchievementsScreen } from './AchievementsScreen.web';
import { SkillsScreen } from './SkillsScreen.web';
import { webColors, webSpacing, webFontSize, webDepth } from '../theme/webTheme';

// Me shares the exact Potential content ("Me IS the Potential", per native's
// ProfileScreen.tsx) below an account header — no separate hand-built
// summary, so the two screens can't visually drift apart. Achievements and
// Skills are folded in as expandable sections here too, since neither is a
// standalone top-level concept — they're all facets of "Me."
export function ProfileScreen() {
  const { email } = useBackup();
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, webDepth.card]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{(email ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.email}>{email ?? 'Signed in'}</Text>
      </View>

      <View style={styles.potentialSection}>
        <Text style={styles.sectionLabel}>POTENTIAL</Text>
        <PotentialOverview showAchievementsLink={false} />
      </View>

      <ExpandableSection label="ACHIEVEMENTS" open={achievementsOpen} onToggle={() => setAchievementsOpen((v) => !v)}>
        <AchievementsScreen />
      </ExpandableSection>

      <ExpandableSection label="SKILLS" open={skillsOpen} onToggle={() => setSkillsOpen((v) => !v)}>
        <SkillsScreen />
      </ExpandableSection>
    </ScrollView>
  );
}

function ExpandableSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.expandableSection}>
      <Pressable style={[styles.expandableHeader, webDepth.list]} onPress={onToggle}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.expandableToggle}>{open ? 'Close' : 'Open'}</Text>
      </Pressable>
      {open ? <View style={styles.expandableBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: webColors.background },
  content: { padding: webSpacing[6], gap: webSpacing[6], maxWidth: 640, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[4],
    backgroundColor: webColors.card,
    padding: webSpacing[5],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: webColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.card },
  email: { fontSize: webFontSize.base, fontWeight: '600', color: webColors.foreground },
  potentialSection: { gap: webSpacing[3] },
  sectionLabel: { fontSize: webFontSize.xs, fontWeight: '800', letterSpacing: 1.2, color: webColors.primary },
  expandableSection: { gap: webSpacing[3] },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[4],
  },
  expandableToggle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.accent },
  expandableBody: { height: 520, overflow: 'hidden', borderRadius: 12, backgroundColor: webColors.background },
});
