export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; id: string; text: string };

const TOKEN_PATTERN = /\[\[([^:\]]+):([^\]]+)\]\]|\*\*([^*]+)\*\*/g;

// Single regex pass over the raw assistant response: matches either an
// entity link ([[id:Title]]) or bold markup (**text**), in source order,
// with everything in between falling back to plain text segments.
export function parseAssistantMessage(raw: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: raw.slice(lastIndex, match.index) });
    }
    const [, linkId, linkTitle, boldText] = match;
    if (linkId !== undefined) {
      segments.push({ kind: 'link', id: linkId, text: linkTitle });
    } else {
      segments.push({ kind: 'bold', text: boldText });
    }
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < raw.length) {
    segments.push({ kind: 'text', text: raw.slice(lastIndex) });
  }
  return segments;
}
