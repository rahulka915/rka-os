import { createItem, updateItemMetadata } from '../../db/database';

export type CaptureSource = 'typed' | 'voice';

export function buildInboxCaptureInput(text: string, source: CaptureSource) {
  const title = text.trim();
  return {
    type: 'task' as const,
    title,
    status: 'inbox' as const,
    voiceTranscript: source === 'voice' ? title : undefined,
    metadata: { source, entityType: null as null },
  };
}

export function saveVoiceCapture(text: string): string {
  const input = buildInboxCaptureInput(text, 'voice');
  if (!input.title) throw new Error('Cannot save an empty voice capture.');
  const id = createItem('task', input.title, 'inbox', undefined, undefined, input.voiceTranscript);
  updateItemMetadata(id, input.metadata);
  return id;
}
