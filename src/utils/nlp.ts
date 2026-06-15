import * as chrono from 'chrono-node';

export interface ParsedInput {
  cleanText: string;
  date: Date | null;
  projectOrTag: string | null;
}

export function parseActionInput(input: string): ParsedInput {
  let cleanText = input;
  let date: Date | null = null;
  let projectOrTag: string | null = null;

  // 1. Extract Project/Tag (anything starting with #)
  const tagMatch = input.match(/#(\w+)/);
  if (tagMatch) {
    projectOrTag = tagMatch[1];
    cleanText = cleanText.replace(tagMatch[0], '');
  }

  // 2. Extract Date using chrono
  const results = chrono.parse(cleanText);
  if (results.length > 0) {
    const result = results[0];
    date = result.start.date();
    // Remove the date text from the clean string
    cleanText = cleanText.replace(result.text, '');
  }

  // Cleanup extra spaces
  cleanText = cleanText.trim().replace(/\s+/g, ' ');

  return { cleanText, date, projectOrTag };
}
