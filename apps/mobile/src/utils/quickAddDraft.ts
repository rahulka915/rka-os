import AsyncStorage from '@react-native-async-storage/async-storage';

export type WhenOption = 'today' | 'evening' | 'tomorrow' | 'anytime' | null;

export interface QuickAddDraft {
  title: string;
  notes: string;
  when: WhenOption;
}

const DRAFT_KEY = 'quickadd:draft';

export async function saveDraft(draft: QuickAddDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<QuickAddDraft | null> {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuickAddDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}
