import { keyNotes, ROOTS, type ChordSpec, type Key, type Quality } from './theory';

/** Diatonic seventh chords: I–vi–ii–V (major), i–VI–iv–v (natural minor). */
export function generateKeyProgression(key: Key, count = 4): ChordSpec[] {
  if (!ROOTS.includes(key.root) || !['major', 'minor'].includes(key.mode))
    throw new Error('Tonalitate invalidă.');
  if (!Number.isInteger(count) || count < 1 || count > 128)
    throw new Error('Progresia trebuie să conțină 1–128 acorduri.');
  const scale = keyNotes(key);
  const degrees = key.mode === 'major' ? [0, 5, 1, 4] : [0, 5, 3, 4];
  const qualities: Quality[] =
    key.mode === 'major' ? ['maj7', 'm7', 'm7', '7'] : ['m7', 'maj7', 'm7', 'm7'];
  return Array.from({ length: count }, (_, i) => ({
    root: scale[degrees[i % 4]],
    quality: qualities[i % 4],
    inversion: 0,
  }));
}
