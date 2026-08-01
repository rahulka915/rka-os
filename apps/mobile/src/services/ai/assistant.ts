import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app, hasFirebaseConfig } from '../../lib/firebase';
import { buildAssistantContext } from './assistantContext';

export const hasAssistant = hasFirebaseConfig && !!app;

export interface AssistantTurn {
  role: 'user' | 'model';
  text: string;
}

const SYSTEM_PROMPT_PREFIX = `You are the personal assistant embedded in RKA OS, a personal task/life
management app. You have READ-ONLY access to the user's current data, given below as JSON —
you cannot add, edit, or delete anything (that capability doesn't exist yet). Answer questions,
summarize, and help the user think through their tasks, missions, medications, and domains.
Be concise and conversational. If asked to change something, explain you can't yet and suggest
they do it in the app directly.

When you refer to a SPECIFIC item from the data below by name (a particular domain, mission,
task, habit, medication, or object — not a general category like "domains" or "tasks"), wrap
it exactly as [[id:Title]] using that item's own "id" field from the JSON, e.g. [[a1b2c3:MUSIC]].
Only wrap specific named items this way, never general category words.

Today's date: ${new Date().toISOString().slice(0, 10)}

Current data (JSON array of items):
`;

export async function askAssistant(question: string, priorTurns: AssistantTurn[]): Promise<string> {
  if (!hasAssistant || !app) {
    throw new Error('The assistant needs Firebase to be configured.');
  }

  const context = buildAssistantContext();
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    // Stable alias (currently resolves to gemini-3.6-flash) rather than a
    // pinned version — gemini-2.5-flash stopped being available to new
    // Firebase AI Logic projects, which is what broke this before.
    model: 'gemini-flash-latest',
    systemInstruction: SYSTEM_PROMPT_PREFIX + context,
  });

  const chat = model.startChat({
    history: priorTurns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
  });

  const result = await chat.sendMessage(question);
  return result.response.text();
}
