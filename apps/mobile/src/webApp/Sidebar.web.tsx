import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Home, Inbox, ListTodo, CalendarDays, Folder } from 'lucide-react-native';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export type SidebarView = 'home' | 'inbox' | 'tasks';

export interface SidebarProps {
  activeView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  inboxCount: number;
}

const NAV_ITEMS: Array<{ view: SidebarView; label: string; Icon: typeof Inbox }> = [
  { view: 'home', label: 'Home', Icon: Home },
  { view: 'inbox', label: 'Inbox', Icon: Inbox },
  { view: 'tasks', label: 'Tasks', Icon: ListTodo },
];

export function Sidebar({ activeView, onSelectView, inboxCount }: SidebarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.workspaceLabel}>RKA OS</Text>

      <View style={styles.navSection}>
        {NAV_ITEMS.map(({ view, label, Icon }) => {
          const active = view === activeView;
          return (
            <Pressable
              key={view}
              onPress={() => onSelectView(view)}
              style={[styles.navRow, active && styles.navRowActive]}
            >
              <Icon size={18} color={active ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
              {view === 'inbox' && inboxCount > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{inboxCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <CalendarDays size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Calendar</Text>
          <Text style={styles.comingSoon}>Soon</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Areas & Projects</Text>
      <ScrollView style={styles.treeSection}>
        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <Folder size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Coming soon</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: '100%',
    backgroundColor: webColors.card,
    borderRightWidth: 1,
    borderRightColor: webColors.border,
    paddingVertical: webSpacing[5],
    paddingHorizontal: webSpacing[3],
  },
  workspaceLabel: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[5],
  },
  navSection: {
    gap: webSpacing[1],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
  },
  navRowActive: {
    backgroundColor: `${webColors.accent}1A`,
  },
  navRowDisabled: {
    opacity: 0.5,
  },
  navLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
  },
  navLabelActive: {
    color: webColors.foreground,
    fontWeight: '600',
  },
  navLabelDisabled: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: webSpacing[1],
  },
  countBadgeText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.card,
  },
  comingSoon: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  divider: {
    height: 1,
    backgroundColor: webColors.border,
    marginVertical: webSpacing[4],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  treeSection: {
    flex: 1,
  },
});
