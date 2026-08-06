import { useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { KatanaProgress } from '../components/ui/KatanaProgress';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { Briefcase, Users, Banknotes, PuzzlePiece, ChartBar, Flag, Star, Lock, Dumbbell } from '../icons';
import {
  createItem,
  setRelation,
  createPotentialStat,
  setFocus,
  computeOverallPotential,
} from '../db/database';

const heroDawn = require('../../assets/hero-dawn.png');

type Step = 'intro' | 'domains' | 'loop' | 'focus';

interface SuggestedDomain {
  title: string;
  Icon: typeof Briefcase;
}

// Fixed 8-Domain default (the traditional Harada life-balance count) so the
// Harada wheel visualization always renders as a proper 8-spoke wheel while
// the visual design is still being iterated on, rather than a shape that
// varies per user. Pre-selected below, not just suggested — still fully
// editable (deselect, rename via custom-add, or add more later from the
// Domains screen).
const SUGGESTED_DOMAINS: SuggestedDomain[] = [
  { title: 'Health & Wellbeing', Icon: AreaBonsaiIcon as unknown as typeof Briefcase },
  { title: 'Career', Icon: Briefcase },
  { title: 'Finance', Icon: Banknotes },
  { title: 'Relationships', Icon: Users },
  { title: 'Creativity', Icon: PuzzlePiece },
  { title: 'Growth', Icon: ChartBar },
  { title: 'Discipline', Icon: Lock },
  { title: 'Fitness & Performance', Icon: Dumbbell },
];

interface CreatedDomain {
  id: string;
  title: string;
}

interface OnboardingScreenProps {
  onDone: () => void;
}

// First-launch guided setup for Domains -> Missions -> Potential Stats -> Focus
// (see docs/superpowers/specs/2026-08-04-harada-onboarding-design.md). Purely a
// UI flow over existing database.ts functions — no schema changes. Every field
// past Domain selection is individually skippable, matching AreaDetailScreen's
// existing "add later" support.
export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const [step, setStep] = useState<Step>('intro');
  const [selectedTitles, setSelectedTitles] = useState<string[]>(SUGGESTED_DOMAINS.map((d) => d.title));
  const [customTitle, setCustomTitle] = useState('');
  const [customDomains, setCustomDomains] = useState<string[]>([]);

  const [domains, setDomains] = useState<CreatedDomain[]>([]);
  const [loopIndex, setLoopIndex] = useState(0);
  const [missionTitle, setMissionTitle] = useState('');
  const [statTitle, setStatTitle] = useState('');

  const [focusDomainId, setFocusDomainId] = useState<string | null>(null);
  const [finalPotential, setFinalPotential] = useState<number | null>(null);

  const allChipTitles = useMemo(
    () => [...SUGGESTED_DOMAINS.map((d) => d.title), ...customDomains],
    [customDomains]
  );

  const toggleTitle = (title: string) => {
    Haptics.selectionAsync();
    setSelectedTitles((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title]
    );
  };

  const addCustomDomain = () => {
    const trimmed = customTitle.trim();
    if (!trimmed) return;
    setCustomDomains((current) => [...current, trimmed]);
    setSelectedTitles((current) => [...current, trimmed]);
    setCustomTitle('');
    Keyboard.dismiss();
  };

  const handleFinishSetup = () => {
    const finalWeights: Record<string, number> = {};
    if (focusDomainId) finalWeights[focusDomainId] = 2;
    if (focusDomainId) {
      const domain = domains.find((d) => d.id === focusDomainId);
      if (domain) setFocus(`${domain.title} Focus`, finalWeights);
    }
    onDone();
  };

  const handleBeginDomains = () => setStep('domains');

  const handleContinueDomains = () => {
    const created = selectedTitles.map((title) => ({ id: createItem('area', title), title }));
    setDomains(created);
    setLoopIndex(0);
    setMissionTitle('');
    setStatTitle('');
    setStep(created.length > 0 ? 'loop' : 'focus');
  };

  const commitCurrentDomainFields = () => {
    const domain = domains[loopIndex];
    if (!domain) return;
    const mission = missionTitle.trim();
    if (mission) {
      const projectId = createItem('project', mission, 'active');
      setRelation(projectId, 'area', domain.id);
    }
    const stat = statTitle.trim();
    if (stat) createPotentialStat(stat, domain.id);
  };

  const handleNextDomain = () => {
    commitCurrentDomainFields();
    const isLast = loopIndex >= domains.length - 1;
    if (isLast) {
      setFinalPotential(computeOverallPotential());
      setStep('focus');
      return;
    }
    setLoopIndex((i) => i + 1);
    setMissionTitle('');
    setStatTitle('');
  };

  const handleSelectFocus = (domainId: string | null) => {
    Haptics.selectionAsync();
    setFocusDomainId((current) => (current === domainId ? null : domainId));
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 'intro' && (
          <View style={styles.flex}>
            <View style={styles.heroWrap}>
              <Image source={heroDawn} style={styles.heroImage} resizeMode="cover" />
              <View style={[styles.heroFade, { backgroundColor: palette.bg }]} />
            </View>
            <View style={styles.content}>
              <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>YOUR JOURNEY BEGINS</Text>
              <Text style={[styles.title, { color: palette.text }]}>Balance, not a to-do list</Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                RKA OS tracks whether the life areas that matter — your Domains — are actually being
                maintained over time, not just which tasks you checked off.
              </Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Set a few up now. You can rename, add, or remove anything later.
              </Text>
              <View style={styles.spacer} />
              <View style={styles.footer}>
                <TouchableOpacity onPress={onDone} hitSlop={12}>
                  <Text style={[styles.ghostBtn, { color: palette.textSecondary }]}>Skip setup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: palette.red }]}
                  onPress={handleBeginDomains}
                >
                  <Text style={styles.primaryBtnText}>Begin →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {step === 'domains' && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>STEP 1 OF 3</Text>
            <Text style={[styles.title, { color: palette.text }]}>Pick your Domains</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Tap the ones that resonate. Rename, add your own, or remove any later.
            </Text>

            <View style={styles.chips}>
              {allChipTitles.map((title) => {
                const suggestion = SUGGESTED_DOMAINS.find((d) => d.title === title);
                const Icon = suggestion?.Icon;
                const selected = selectedTitles.includes(title);
                return (
                  <TouchableOpacity
                    key={title}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? palette.red : palette.separator,
                        backgroundColor: selected ? `${palette.red}22` : 'transparent',
                      },
                    ]}
                    onPress={() => toggleTitle(title)}
                    activeOpacity={0.75}
                  >
                    {Icon && (
                      <Icon size={16} color={selected ? palette.red : palette.textTertiary} strokeWidth={1.9} />
                    )}
                    <Text style={[styles.chipText, { color: selected ? palette.text : palette.textSecondary }]}>
                      {title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.customRow, { borderColor: palette.separator }]}>
              <TextInput
                style={[styles.customInput, { color: palette.text }]}
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="Add a custom Domain"
                placeholderTextColor={palette.textTertiary}
                onSubmitEditing={addCustomDomain}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addCustomDomain} hitSlop={10}>
                <Text style={[styles.addLink, { color: palette.red }]}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.spacer} />
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setStep('intro')} hitSlop={12}>
                <Text style={[styles.ghostBtn, { color: palette.textSecondary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: palette.red, opacity: selectedTitles.length ? 1 : 0.4 }]}
                onPress={handleContinueDomains}
                disabled={selectedTitles.length === 0}
              >
                <Text style={styles.primaryBtnText}>Continue ({selectedTitles.length})</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {step === 'loop' && domains[loopIndex] && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>
              STEP 2 OF 3 · DOMAIN {loopIndex + 1}/{domains.length}
            </Text>
            <Text style={[styles.title, { color: palette.text }]}>Set up {domains[loopIndex].title}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              A Mission is something you're actively working toward. A Potential Stat is what you're
              maintaining day to day. Both are optional.
            </Text>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
              <View style={styles.cardHead}>
                <View style={[styles.iconBadge, { backgroundColor: palette.fillStrong }]}>
                  <Flag size={18} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <Text style={[styles.cardLabel, { color: palette.textTertiary }]}>MISSION (OPTIONAL)</Text>
              </View>
              <TextInput
                style={[styles.cardInput, { color: palette.text, borderColor: palette.separator }]}
                value={missionTitle}
                onChangeText={setMissionTitle}
                placeholder="e.g. Run a 10K by December"
                placeholderTextColor={palette.textTertiary}
              />
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
              <View style={styles.cardHead}>
                <View style={[styles.iconBadge, { backgroundColor: palette.fillStrong }]}>
                  <ChartBar size={18} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <Text style={[styles.cardLabel, { color: palette.textTertiary }]}>POTENTIAL STAT (OPTIONAL)</Text>
              </View>
              <TextInput
                style={[styles.cardInput, { color: palette.text, borderColor: palette.separator }]}
                value={statTitle}
                onChangeText={setStatTitle}
                placeholder="e.g. Sleep consistency"
                placeholderTextColor={palette.textTertiary}
              />
            </View>

            <View style={styles.spacer} />
            <View style={styles.footer}>
              <TouchableOpacity onPress={onDone} hitSlop={12}>
                <Text style={[styles.ghostBtn, { color: palette.textSecondary }]}>Skip setup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: palette.red }]} onPress={handleNextDomain}>
                <Text style={styles.primaryBtnText}>
                  {loopIndex >= domains.length - 1 ? 'Continue →' : 'Next Domain →'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {step === 'focus' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>STEP 3 OF 3</Text>
            <Text style={[styles.title, { color: palette.text }]}>What's your Focus right now?</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Focus gently weights one Domain higher in your Overall Potential. Change it anytime — it
              never resets your Domains, Missions, or history.
            </Text>

            <View style={styles.rows}>
              {domains.map((domain) => {
                const selected = focusDomainId === domain.id;
                return (
                  <TouchableOpacity
                    key={domain.id}
                    style={[
                      styles.focusRow,
                      {
                        borderColor: selected ? palette.red : palette.separator,
                        backgroundColor: selected ? `${palette.red}14` : 'transparent',
                      },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSelectFocus(domain.id)}
                  >
                    <View style={styles.focusLeft}>
                      <Star size={18} color={selected ? palette.red : palette.textTertiary} strokeWidth={1.9} />
                      <Text style={[styles.focusLabel, { color: palette.text }]}>{domain.title}</Text>
                    </View>
                    <View style={[styles.radio, { borderColor: selected ? palette.red : palette.separator, backgroundColor: selected ? palette.red : 'transparent' }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {finalPotential !== null && (
              <View style={styles.potentialPreview}>
                <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>
                  OVERALL POTENTIAL SO FAR
                </Text>
                <KatanaProgress
                  progress={finalPotential / 100}
                  size={20}
                  accessibilityLabel="Overall potential preview"
                />
              </View>
            )}

            <View style={styles.spacer} />
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setStep('loop')} hitSlop={12}>
                <Text style={[styles.ghostBtn, { color: palette.textSecondary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: palette.red }]} onPress={handleFinishSetup}>
                <Text style={styles.primaryBtnText}>Finish → Home</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  heroWrap: { height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, opacity: 0.001 },
  eyebrow: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1, marginTop: 20, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 12, lineHeight: 30 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400', lineHeight: 21, marginBottom: 12 },
  spacer: { flex: 1, minHeight: 24 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 },
  ghostBtn: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  primaryBtn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  customRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
  },
  customInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  addLink: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold', paddingLeft: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.8 },
  cardInput: { fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rows: { gap: 8, marginTop: 8 },
  focusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  focusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  potentialPreview: { marginTop: 20, gap: 8 },
});
