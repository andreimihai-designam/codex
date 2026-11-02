import { buildChord, mod, pc, type ChordSpec } from './theory';
export const TUNING = [40, 45, 50, 55, 59, 64]; // low E through high E
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export type Voicing = (number | null)[];
export function voicingMidi(voicing: Voicing): number[] {
  return voicing.flatMap((f, s) => (f === null ? [] : [TUNING[s] + f]));
}
export function movement(a: Voicing, b: Voicing): number {
  return a.reduce<number>(
    (sum, fret, i) =>
      sum +
      (fret === null && b[i] === null
        ? 0
        : fret === null || b[i] === null
          ? 3
          : Math.abs(fret - b[i]!)),
    0,
  );
}
export function guitarVoicings(spec: ChordSpec, previous?: Voicing): Voicing[] {
  const chord = buildChord(spec);
  const tones = new Set(chord.notes.map(pc));
  const bass = pc(chord.bass);
  const candidates = TUNING.map((open) => [
    null,
    ...Array.from({ length: 13 }, (_, f) => f).filter((f) => tones.has(mod(open + f))),
  ]);
  const results: { frets: Voicing; score: number }[] = [];
  function visit(frets: Voicing, used: Set<number>, min: number, max: number, sounding: number) {
    const s = frets.length;
    if (tones.size - used.size > 6 - s) return;
    if (s === 6) {
      if (sounding < 3 || used.size !== tones.size) return;
      const midi = voicingMidi(frets);
      // Bass is the lowest sounding pitch, not simply the first played string.
      if (mod(Math.min(...midi)) !== bass) return;
      const positive = frets.filter((f): f is number => f !== null && f > 0);
      // A first approximation; full physical fingering analysis is outside v0.1.
      if (new Set(positive).size > 4) return;
      const score =
        (previous ? movement(previous, frets) * 4 : 0) +
        (positive.length ? Math.max(...positive) : 0) +
        (max - min > 0 ? max - min : 0) * 2 +
        (6 - sounding) * 1.5;
      results.push({ frets, score });
      return;
    }
    for (const fret of candidates[s]) {
      const nextMin = fret && fret > 0 ? Math.min(min, fret) : min;
      const nextMax = fret && fret > 0 ? Math.max(max, fret) : max;
      if (nextMax - nextMin > 3) continue;
      const nextUsed = new Set(used);
      if (fret !== null) nextUsed.add(mod(TUNING[s] + fret));
      visit([...frets, fret], nextUsed, nextMin, nextMax, sounding + (fret === null ? 0 : 1));
    }
  }
  visit([], new Set(), 99, 0, 0);
  return results
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.frets
          .map((f) => f ?? -1)
          .join(',')
          .localeCompare(b.frets.map((f) => f ?? -1).join(',')),
    )
    .slice(0, 24)
    .map((r) => r.frets);
}
