import { validateProject, type Project, type ProgressionChord } from './project';
import { buildChord, analyze, QUALITIES, ROOTS } from './theory';
import type { MelodyNote } from './composition';
export interface AssistantReply {
  answer: string;
  progression?: Omit<ProgressionChord, 'id' | 'section'>[];
  melody?: Omit<MelodyNote, 'id'>[];
}
export function parseAssistantReply(text: string, base: Project): AssistantReply {
  if (text.length > 32000) throw new Error('Răspunsul AI depășește limita permisă.');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
  } catch {
    throw new Error(
      'Modelul nu a returnat JSON valid. Cere o propunere mai scurtă sau folosește un model compatibil cu JSON.',
    );
  }
  if (!value || typeof value !== 'object') throw new Error('Răspuns AI invalid.');
  const v = value as Record<string, unknown>;
  if (typeof v.answer !== 'string' || !v.answer.trim() || v.answer.length > 8000)
    throw new Error('Explicația AI este invalidă.');
  let chords: ProgressionChord[] | undefined, melody: MelodyNote[] | undefined;
  if (v.progression !== undefined && v.progression !== null) {
    if (!Array.isArray(v.progression) || v.progression.length > 16)
      throw new Error('Propunerea poate conține maximum 16 acorduri.');
    chords = v.progression.map((c, i) => {
      if (
        !c ||
        typeof c !== 'object' ||
        !ROOTS.includes(c.root) ||
        !QUALITIES.some((q) => q.suffix === c.quality)
      )
        throw new Error('AI a propus un acord necunoscut; propunerea nu a fost aplicată.');
      return {
        id: `ai-chord-${i}`,
        section: 'AI',
        root: c.root,
        quality: c.quality,
        inversion: c.inversion ?? 0,
        beats: c.beats ?? 4,
      };
    });
  }
  if (v.melody !== undefined && v.melody !== null) {
    if (!Array.isArray(v.melody) || v.melody.length > 128)
      throw new Error('Propunerea poate conține maximum 128 note.');
    melody = v.melody.map((n, i) => ({
      id: `ai-note-${i}`,
      midi: n?.midi,
      start: n?.start,
      duration: n?.duration,
      velocity: n?.velocity ?? 0.8,
    }));
  }
  validateProject({ ...base, ...(chords ? { chords } : {}), ...(melody ? { melody } : {}) });
  return {
    answer: v.answer.trim(),
    ...(chords
      ? {
          progression: chords.map(({ id, section, ...c }) => {
            void id;
            void section;
            return c;
          }),
        }
      : {}),
    ...(melody
      ? {
          melody: melody.map(({ id, ...n }) => {
            void id;
            return n;
          }),
        }
      : {}),
  };
}
export function assistantContext(p: Project): string {
  return JSON.stringify({
    key: p.key,
    bpm: p.bpm,
    progression: p.chords.slice(0, 16).map((c) => ({
      symbol: buildChord(c).symbol,
      root: c.root,
      quality: c.quality,
      inversion: c.inversion,
      beats: c.beats,
      analysis: analyze(c, p.key),
    })),
    melody: p.melody.slice(0, 32).map(({ midi, start, duration }) => ({ midi, start, duration })),
    audioTrackCount: p.audio.tracks.length,
  });
}
export function applyAssistantReply(
  p: Project,
  reply: AssistantReply,
  parts: { chords: boolean; melody: boolean },
): Project {
  // Revalidate at the moment of applying, even if a UI caller bypasses preview.
  const validated = parseAssistantReply(JSON.stringify(reply), p);
  return validateProject({
    ...p,
    ...(parts.chords && validated.progression
      ? {
          chords: validated.progression.map((c) => ({
            ...c,
            id: crypto.randomUUID(),
            section: 'AI',
          })),
        }
      : {}),
    ...(parts.melody && validated.melody
      ? { melody: validated.melody.map((n) => ({ ...n, id: crypto.randomUUID() })) }
      : {}),
  });
}
export const assistantSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    progression: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          root: { type: 'string', enum: ROOTS },
          quality: { type: 'string', enum: QUALITIES.map((q) => q.suffix) },
          inversion: { type: 'integer', minimum: 0, maximum: 4 },
          beats: { type: 'integer', minimum: 1, maximum: 16 },
        },
        required: ['root', 'quality', 'beats'],
        additionalProperties: false,
      },
      maxItems: 16,
    },
    melody: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          midi: { type: 'integer', minimum: 40, maximum: 88 },
          start: { type: 'number', minimum: 0 },
          duration: { type: 'number', minimum: 0.25, maximum: 16 },
          velocity: { type: 'number', minimum: 0.05, maximum: 1 },
        },
        required: ['midi', 'start', 'duration', 'velocity'],
        additionalProperties: false,
      },
      maxItems: 128,
    },
  },
  required: ['answer'],
  additionalProperties: false,
};
