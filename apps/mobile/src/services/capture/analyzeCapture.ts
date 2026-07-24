// Future extension point: analyze a transcript and return enrichment suggestions.
// Returns null (no suggestions) until a real implementation is wired up.
export async function analyzeCapture(_transcript: string): Promise<null> {
  return null;
}
