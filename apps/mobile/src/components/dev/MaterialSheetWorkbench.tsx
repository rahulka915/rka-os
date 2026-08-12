import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { RiverStoneSurface } from '../riverstone';
import { TimelinePaper } from '../calendar/TimelinePaper';
import { ArchiveScrollChestIcon, HabitRitualIcon, ToGetParcelIcon, WorkoutTrainingIcon } from '../icons/CollectionIcons';
import { Check, Clock, DragHandle, Sparkles, Trophy } from '../../icons';
import { getThemeColors, spacing } from '../../theme';

interface MaterialSheetWorkbenchProps {
  isDark: boolean;
}

const MATERIALS = [
  {
    name: 'Washi / Sumi',
    role: 'World / canvas',
    note: 'Matte, quiet, light-absorbing field.',
  },
  {
    name: 'River Stone',
    role: 'Everyday objects',
    note: 'Broad diffuse light, calm charcoal body.',
  },
  {
    name: 'Blackened Iron',
    role: 'Tools / controls',
    note: 'Harder edge response, restrained system weight.',
  },
  {
    name: 'Urushi Lacquer',
    role: 'Importance / reward',
    note: 'Deep black, smooth surface, rare highlight.',
  },
  {
    name: 'Gold / Brass',
    role: 'Significance',
    note: 'Scarce progress and selection signal.',
  },
] as const;

const TASKS = [
  'Draft weekly review',
  'Schedule training block',
  'Follow up on mission brief',
  'Refill medication',
  'Plan tomorrow morning',
] as const;

function SectionTitle({ children, isDark }: { children: string; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return <Text style={[styles.sectionTitle, { color: palette.textTertiary }]}>{children}</Text>;
}

function MaterialCaption({ name, role, note, isDark }: { name: string; role: string; note: string; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.caption}>
      <Text style={[styles.materialName, { color: palette.text }]}>{name}</Text>
      <Text style={[styles.materialRole, { color: palette.antiqueBrass }]}>{role}</Text>
      <Text style={[styles.materialNote, { color: palette.textSecondary }]}>{note}</Text>
    </View>
  );
}

function WashiSample({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={[styles.sampleFrame, { borderColor: palette.separator }]}>
      <TimelinePaper variant="A" mode={isDark ? 'dark' : 'light'} seed="material-sheet-washi" />
      <View style={styles.washiGrid}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.washiRule, { backgroundColor: isDark ? 'rgba(226,222,214,0.09)' : 'rgba(77,72,65,0.11)' }]} />
        ))}
      </View>
      <Text style={[styles.sampleLabel, { color: palette.text }]}>Timeline canvas</Text>
    </View>
  );
}

function StoneRows({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.repeatedRows}>
      {TASKS.map((title, index) => (
        <RiverStoneSurface
          key={title}
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.taskRow}
        >
          <View style={[styles.checkDisc, { borderColor: palette.antiqueBrass }]}>
            {index === 0 ? <Check size={14} color={palette.antiqueBrass} strokeWidth={2.5} /> : null}
          </View>
          <View style={styles.taskCopy}>
            <Text style={[styles.taskTitle, { color: palette.ivory }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.taskMeta, { color: palette.greige }]} numberOfLines={1}>Interactive stone row · seam test</Text>
          </View>
        </RiverStoneSurface>
      ))}
    </View>
  );
}

function CollectionSamples({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const tiles = [
    { label: 'Workouts', Icon: WorkoutTrainingIcon },
    { label: 'Habits', Icon: HabitRitualIcon },
    { label: 'To Get', Icon: ToGetParcelIcon },
    { label: 'Archive', Icon: ArchiveScrollChestIcon },
  ] as const;

  return (
    <View style={styles.collectionGrid}>
      {tiles.map(({ label, Icon }) => (
        <RiverStoneSurface
          key={label}
          variant="card"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={styles.collectionTile}
          contentStyle={styles.collectionTileContent}
        >
          <Icon size={42} />
          <Text style={[styles.collectionLabel, { color: palette.text }]} numberOfLines={1}>{label}</Text>
        </RiverStoneSurface>
      ))}
    </View>
  );
}

function IronSample({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.ironStrip}>
      <LinearGradient
        pointerEvents="none"
        colors={isDark
          ? ['#15161A', '#222225', '#111215']
          : ['#CFC9BC', '#E4DDD0', '#B9B1A3']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.ironEdge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.34)' }]} />
      {['Filter', 'Timeline', 'Tools'].map((label, index) => (
        <View key={label} style={[styles.ironChip, { borderColor: index === 1 ? palette.antiqueBrass : palette.separator }]}>
          {index === 0 ? <DragHandle size={15} color={palette.textSecondary} strokeWidth={2} /> : <Clock size={15} color={index === 1 ? palette.antiqueBrass : palette.textSecondary} strokeWidth={2} />}
          <Text style={[styles.ironChipText, { color: index === 1 ? palette.antiqueBrass : palette.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function UrushiSample({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.urushiCard}>
      <LinearGradient
        pointerEvents="none"
        colors={['#050506', '#11100F', '#050506']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,244,220,0.20)', 'rgba(255,244,220,0.035)', 'rgba(255,244,220,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.urushiHighlight}
      />
      <View style={styles.urushiContent}>
        <Trophy size={31} color={palette.antiqueBrass} strokeWidth={1.6} />
        <View style={styles.taskCopy}>
          <Text style={styles.urushiTitle}>Mission earned</Text>
          <Text style={styles.urushiMeta}>Reward surface · elevated material</Text>
        </View>
        <Sparkles size={18} color={palette.antiqueBrass} strokeWidth={1.6} />
      </View>
    </View>
  );
}

function BrassSample({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.brassStack}>
      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(242,236,221,0.10)' : 'rgba(43,38,32,0.10)' }]}>
        <LinearGradient
          colors={['#8B6936', '#D4B078', '#F0D8A4']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.progressFill, { width: '68%' }]}
        />
      </View>
      <View style={styles.brassDots}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.brassDot,
              {
                backgroundColor: index < 3 ? palette.antiqueBrass : 'transparent',
                borderColor: palette.antiqueBrass,
                opacity: index < 3 ? 1 : 0.55,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function MaterialSheetWorkbench({ isDark }: MaterialSheetWorkbenchProps) {
  const palette = getThemeColors(isDark);

  return (
    <View style={styles.container}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: palette.text }]}>Material Sheet</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Compare material roles against real RKA.OS content before changing production surfaces.
        </Text>
      </View>

      <SectionTitle isDark={isDark}>MATERIAL ROLES</SectionTitle>
      <View style={styles.roleStack}>
        {MATERIALS.map((material) => (
          <RiverStoneSurface
            key={material.name}
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.roleRow}
          >
            <MaterialCaption {...material} isDark={isDark} />
          </RiverStoneSurface>
        ))}
      </View>

      <SectionTitle isDark={isDark}>WASHI / SUMI</SectionTitle>
      <WashiSample isDark={isDark} />

      <SectionTitle isDark={isDark}>RIVER STONE · LIST DENSITY</SectionTitle>
      <StoneRows isDark={isDark} />

      <SectionTitle isDark={isDark}>RIVER STONE · COLLECTION DENSITY</SectionTitle>
      <CollectionSamples isDark={isDark} />

      <SectionTitle isDark={isDark}>BLACKENED IRON</SectionTitle>
      <IronSample isDark={isDark} />

      <SectionTitle isDark={isDark}>URUSHI LACQUER</SectionTitle>
      <UrushiSample isDark={isDark} />

      <SectionTitle isDark={isDark}>GOLD / BRASS</SectionTitle>
      <BrassSample isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerCopy: {
    gap: 4,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Newsreader_600SemiBold',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1,
  },
  roleStack: {
    gap: 8,
  },
  roleRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: 12,
  },
  caption: {
    gap: 3,
  },
  materialName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  materialRole: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  materialNote: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  sampleFrame: {
    height: 160,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
  },
  washiGrid: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-evenly',
    paddingLeft: 66,
  },
  washiRule: {
    height: StyleSheet.hairlineWidth,
  },
  sampleLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  repeatedRows: {
    gap: 6,
  },
  taskRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  checkDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  taskMeta: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  collectionTile: {
    width: '48.5%',
    aspectRatio: 1.18,
  },
  collectionTileContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  collectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  ironStrip: {
    minHeight: 80,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  ironEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  ironChip: {
    minHeight: 42,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  ironChipText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  urushiCard: {
    minHeight: 104,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10,
  },
  urushiHighlight: {
    position: 'absolute',
    left: -20,
    top: -34,
    width: '82%',
    height: 88,
    borderRadius: 44,
  },
  urushiContent: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  urushiTitle: {
    color: '#F6ECDD',
    fontSize: 17,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
  },
  urushiMeta: {
    color: 'rgba(246,236,221,0.58)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  brassStack: {
    gap: 14,
    paddingVertical: 8,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  brassDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brassDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.4,
  },
});
