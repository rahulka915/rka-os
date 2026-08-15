// Agentic assistant — shared by web and native. The only platform difference
// lives in the data layer, which is already platform-split: assistantContext
// (SQLite getDb on native / Firestore snapshot on web) and assistantToolExecutor
// (database.ts on native / database.web.ts on web) both resolve per-platform via
// Metro. This loop is identical on both. See docs/superpowers/specs/
// 2026-08-15-agentic-web-assistant-design.md and
// 2026-08-15-conversational-onboarding-design.md.
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { app, hasFirebaseConfig } from '../../lib/firebase';
import { buildAssistantContext } from './assistantContext';
import { ASSISTANT_TOOL_DECLARATIONS, previewAssistantTool, type AssistantToolName } from './assistantTools';
import { executeAssistantTool } from './assistantToolExecutor';

export const hasAssistant = hasFirebaseConfig && !!app;

export interface AssistantTurn {
  role: 'user' | 'model';
  text: string;
}

export interface PendingAssistantCall {
  name: AssistantToolName;
  args: Record<string, any>;
  preview: string;
}

export type AskAssistantResult =
  | { kind: 'text'; text: string; rawHistory: any[] }
  | { kind: 'pending'; calls: PendingAssistantCall[]; rawHistory: any[] };

const SYSTEM_PROMPT_PREFIX = `You are the personal assistant embedded in RKA OS, a personal task/life
management app. You have read access to the user's current data, given below as JSON, AND you can
create, update, complete, and delete items using the tools provided — every tool call you make is
shown to the user for explicit confirmation before it takes effect, so propose actions confidently
when the user's intent is clear.

When the user's request refers to a SPECIFIC existing item by name (not a general category), find
it by title in the data below and use its own "id" field as the tool argument — never invent an id.
If nothing in the data plausibly matches, ask the user to clarify instead of guessing.

When you refer to a SPECIFIC item from the data below by name in your text responses, wrap it
exactly as [[id:Title]] using that item's own "id" field, e.g. [[a1b2c3:MUSIC]]. Only wrap specific
named items this way, never general category words.

GUIDED SETUP: If the user asks you to help set up their system / onboard them / plan out their life,
run a short, friendly interview — ask ONE focused question at a time, don't dump a questionnaire.
Work through, in order: (1) their life areas — these map to the existing Domains in the data (there
are usually six canonical ones); reference those rather than creating duplicates, and only create a
new Domain (create_item type 'area') if they name something genuinely outside the existing set;
(2) goals/projects → create_mission linked to the relevant Domain; (3) capabilities they're developing
→ create_skill linked to a primary Domain (unlocked: true only if they already practise it);
(4) routines/behaviours → create_habit with the right measurement (binary for yes/no, count/duration
with a target + period when they mention amounts), and tag Potential Attribute evidence (e.g. the
Strength/Stamina attributes in the data) when a habit is physical; (5) optionally set_focus. Propose
concrete tool calls as you go — each is confirmed individually, so it's fine to propose several at
once, but keep each call to one real thing. Always use real "id" values from the data for links;
never invent ids. Confirm what you've set up in a short summary at the end.

SUGGESTING THINGS: When the user asks you to SUGGEST, RECOMMEND, or help them DECIDE on Missions,
Skills, Habits, or a Focus (as opposed to giving you a specific thing to add), do NOT invent a list
out of thin air. First ask 1–2 short clarifying questions to understand what they actually want
(e.g. which Domain or goal it's for, how much time/effort, what they're trying to improve), THEN
propose concrete, tailored options as tool calls they can confirm. Exception: if the user gives you
a specific, explicit instruction ("add a mission called X", "create a daily meditation habit"), just
do it — don't interrogate them.

Be concise and conversational.

Today's date: ${new Date().toISOString().slice(0, 10)}

Current data (JSON array of items):
`;

function buildModel() {
  if (!hasAssistant || !app) {
    throw new Error('The assistant needs Firebase to be configured.');
  }
  const context = buildAssistantContext();
  // Vertex AI backend (not the Gemini Developer API's GoogleAIBackend) so calls
  // bill against the Google Cloud project's credit rather than the separate,
  // depleted AI Studio prepay pool.
  const ai = getAI(app, { backend: new VertexAIBackend() });
  return getGenerativeModel(ai, {
    // Concrete Vertex model ID — the 'gemini-flash-latest' alias is a Gemini
    // Developer API construct and 404s on Vertex. gemini-2.5-flash is confirmed
    // available to this project in us-central1.
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT_PREFIX + context,
    tools: ASSISTANT_TOOL_DECLARATIONS as any,
  });
}

function extractFunctionCalls(response: any): Array<{ name: AssistantToolName; args: Record<string, any> }> {
  const calls = typeof response.functionCalls === 'function' ? response.functionCalls() : null;
  if (!calls || calls.length === 0) return [];
  return calls.map((c: any) => ({ name: c.name as AssistantToolName, args: c.args ?? {} }));
}

export async function askAssistant(question: string, priorRawHistory: any[]): Promise<AskAssistantResult> {
  const model = buildModel();
  const chat = model.startChat({ history: priorRawHistory });
  const result = await chat.sendMessage(question);
  const response = result.response;

  const calls = extractFunctionCalls(response);
  const rawHistory = await chat.getHistory();

  if (calls.length === 0) {
    return { kind: 'text', text: response.text(), rawHistory };
  }

  return {
    kind: 'pending',
    calls: calls.map((c) => ({ ...c, preview: previewAssistantTool(c.name, c.args) })),
    rawHistory,
  };
}

export async function resolveAssistantActions(
  rawHistory: any[],
  decisions: Array<{ call: PendingAssistantCall; confirmed: boolean }>
): Promise<AskAssistantResult> {
  const model = buildModel();
  const chat = model.startChat({ history: rawHistory });

  const functionResponseParts = decisions.map(({ call, confirmed }) => {
    if (!confirmed) {
      return { functionResponse: { name: call.name, response: { cancelled: true } } };
    }
    const outcome = executeAssistantTool(call.name, call.args);
    return {
      functionResponse: {
        name: call.name,
        response: outcome.ok ? { result: outcome.result } : { error: outcome.error },
      },
    };
  });

  const result = await chat.sendMessage(functionResponseParts as any);
  const response = result.response;
  const calls = extractFunctionCalls(response);
  const newRawHistory = await chat.getHistory();

  if (calls.length === 0) {
    return { kind: 'text', text: response.text(), rawHistory: newRawHistory };
  }

  return {
    kind: 'pending',
    calls: calls.map((c) => ({ ...c, preview: previewAssistantTool(c.name, c.args) })),
    rawHistory: newRawHistory,
  };
}
