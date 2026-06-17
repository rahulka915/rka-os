import * as chrono from 'chrono-node';

export interface ParsedAction {
  title: string;
  scheduledDate: string | null;
  tags: string[];
}

export function parseActionInput(input: string): ParsedAction {
  let title = input;
  let scheduledDate: string | null = null;
  const tags: string[] = [];
  
  // Extract #tags
  const tagRegex = /#(\w+)/g;
  let match;
  while ((match = tagRegex.exec(title)) !== null) {
    tags.push(match[1]);
  }
  // Remove tags from title
  title = title.replace(tagRegex, '').trim();

  // Extract natural language date
  const parsedDate = chrono.parseDate(title);
  if (parsedDate) {
    // Format to YYYY-MM-DD
    scheduledDate = parsedDate.toISOString().split('T')[0];
    
    // Remove the date text from the title
    const chronoResults = chrono.parse(title);
    if (chronoResults.length > 0) {
      title = title.replace(chronoResults[0].text, '').trim();
    }
  }

  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ');

  return {
    title: title || 'New Action',
    scheduledDate,
    tags
  };
}
