import { useMemo, useState, type ComponentType } from 'react';
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
import { RiverStoneProgress } from '../components/ui/RiverStoneProgress';
import { ChartBar, Flag, Star } from '../icons';
import { getDomainIcon } from '../utils/domainIcons';
import {
  createItem,
  setRelation,
  createPotentialStat,
  setFocus,
  computeOverallPotential,
  updateItemMetadata,
  CANONICAL_DOMAIN_TITLES,
} from '../db/database';

const heroDawn = require('../../assets/hero-dawn.png');

type Step = 'intro' | 'domains' | 'loop' | 'focus';

interface SuggestedDomain {
  title: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

// Fixed 8-Domain baseline (the traditional Harada life-balance count) so the
// Harada wheel visualization always renders as a proper 8-spoke wheel. Every
// user gets these 8 as a mandatory minimum — they can be renamed (from the
// Domains screen, via Edit) but never deselected here or deleted later; only
// custom, user-added Domains beyond these 8 can be removed. Created with
// metadata.canonical = true (see handleContinueDomains / createCanonicalDomains)
// so AreasScreen can block Delete/Convert-to-Skill on them.
// The same custom icon resolver is shared with Domains, Potential and Domain
// detail so the fixed eight identities never drift between screens.
const SUGGESTED_DOMAINS: SuggestedDomain[] = CANONICAL_DOMAIN_TITLES.map((title) => ({
  title,
  Icon: getDomainIcon(title),
}));

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

  const isMandatoryTitle = (title: string) => SUGGESTED_DOMAINS.some((d) => d.title === title);

  const toggleTitle = (title: string) => {
    if (isMandatoryTitle(title)) return; // the 8 baseline Domains can't be deselected
    Haptics.selectionAsync();
    setSelectedTitles((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title]
    );
  };

  // Shared by both onboarding paths that can create the baseline 8: the
  // normal Domains step (handleContinueDomains) and the intro's "Skip
  // setup" (which must still guarantee the mandatory minimum, not zero).
  const createCanonicalDomains = (): CreatedDomain[] =>
    SUGGESTED_DOMAINS.map((d) => {
      const id = createItem('area', d.title, 'active');
      updateItemMetadata(id, { canonical: true });
      return { id, title: d.title };
    });

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
    const created = selectedTitles.map((title) => {
      const id = createItem('area', title, 'active');
      if (isMandatoryTitle(title)) updateItemMetadata(id, { canonical: true });
      return { id, title };
    });
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
                You start with 8 baseline Domains — rename them anytime, and add more of your own later.
              </Text>
              <View style={styles.spacer} />
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => { createCanonicalDomains(); onDone(); }} hitSlop={12}>
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
            <Text style={[styles.title, { color: palette.text }]}>Your 8 Domains</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              These 8 are the baseline everyone starts with — you can rename them later, but not remove
              them. Add your own on top; those you can remove anytime.
            </Text>

            <View style={styles.chips}>
              {allChipTitles.map((title) => {
                const suggestion = SUGGESTED_DOMAINS.find((d) => d.title === title);
                const Icon = suggestion?.Icon;
                const mandatory = isMandatoryTitle(title);
                const selected = selectedTitles.includes(title);
                return (
                  <TouchableOpacity
                    key={title}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? palette.red : palette.separator,
                        backgroundColor: selected ? `${palette.red}22` : 'transparent',
                        opacity: mandatory ? 0.9 : 1,
                      },
                    ]}
                    onPress={() => toggleTitle(title)}
                    activeOpacity={mandatory ? 1 : 0.75}
                    accessibilityLabel={mandatory ? `${title}, included by default` : title}
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
                <RiverStoneProgress
                  progress={finalPotential / 100}
                  isDark={isDark}
                  height={12}
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
