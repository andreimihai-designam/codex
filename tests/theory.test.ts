import { describe, expect, it } from 'vitest';
import {
  analyze,
  buildChord,
  identifyChord,
  keyNotes,
  pc,
  QUALITIES,
  ROOTS,
  substitutions,
  suggestScales,
} from '../src/core/theory';
import { guitarVoicings, movement, TUNING, voicingMidi } from '../src/core/guitar';

const major = { root: 'C', mode: 'major' } as const;
describe('deterministic harmony', () => {
  it('spells C major seventh and its inversions', () => {
    expect(buildChord({ root: 'C', quality: 'maj7', inversion: 0 }).notes).toEqual([
      'C',
      'E',
      'G',
      'B',
    ]);
    const chord = buildChord({ root: 'C', quality: 'maj7', inversion: 1 });
    expect(chord.notes).toEqual(['E', 'G', 'B', 'C']);
    expect(chord.symbol).toBe('Cmaj7/E');
    expect(chord.midi).toEqual([52, 55, 59, 60]);
  });
  it('preserves flat spelling and diminished sevenths', () => {
    expect(buildChord({ root: 'Bb', quality: '', inversion: 0 }).notes).toEqual(['Bb', 'D', 'F']);
    expect(buildChord({ root: 'C', quality: 'dim7', inversion: 0 }).notes).toEqual([
      'C',
      'Eb',
      'Gb',
      'Bbb',
    ]);
  });
  it('builds every offered root and quality with ascending MIDI', () => {
    for (const root of ROOTS)
      for (const q of QUALITIES) {
        const base = buildChord({ root, quality: q.suffix, inversion: 0 });
        for (let inversion = 0; inversion < base.notes.length; inversion++) {
          const chord = buildChord({ root, quality: q.suffix, inversion });
          expect(chord.notes.length).toBe(base.notes.length);
          expect(chord.midi.every((m, i) => i === 0 || m > chord.midi[i - 1])).toBe(true);
          expect(chord.midi.map((m) => m % 12)).toEqual(chord.notes.map(pc));
        }
      }
  });
  it('rejects malformed notes and inversions', () => {
    expect(() => buildChord({ root: 'H', quality: '', inversion: 0 })).toThrow();
    expect(() => buildChord({ root: 'C', quality: '', inversion: 3 })).toThrow();
    expect(() => buildChord({ root: 'C', quality: '', inversion: -1 })).toThrow();
    expect(identifyChord('H E G')).toEqual([]);
  });
  it('identifies a triad and an inverted triad', () => {
    expect(identifyChord('C E G')).toContain('CM');
    expect(identifyChord('E G C')).toContain('CM/E');
    expect(identifyChord('')).toEqual([]);
  });
  it('analyzes a major ii–V–I', () => {
    const chords = [
      { root: 'D', quality: 'm7' },
      { root: 'G', quality: '7' },
      { root: 'C', quality: 'maj7' },
    ] as const;
    expect(chords.map((c) => analyze({ ...c, inversion: 0 }, major).roman)).toEqual([
      'ii7',
      'V7',
      'Imaj7',
    ]);
    expect(chords.map((c) => analyze({ ...c, inversion: 0 }, major).function)).toEqual([
      'Predominantă',
      'Dominantă',
      'Tonică',
    ]);
  });
  it('recognizes a secondary dominant and flags its chromatic note', () => {
    const a = analyze({ root: 'A', quality: '7', inversion: 0 }, major);
    expect(a.roman).toBe('V7/ii');
    expect(a.diatonic).toBe(false);
  });
  it('handles harmonic minor dominant without calling it diatonic in natural minor', () => {
    const a = analyze({ root: 'E', quality: '7', inversion: 0 }, { root: 'A', mode: 'minor' });
    expect(a.function).toBe('Dominantă');
    expect(a.diatonic).toBe(false);
    expect(keyNotes({ root: 'A', mode: 'minor' })).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
  it('uses minor-key target degrees and preserves chord-quality numerals', () => {
    expect(
      analyze({ root: 'D', quality: '7', inversion: 0 }, { root: 'A', mode: 'minor' }).roman,
    ).toBe('V7/VII');
    expect(analyze({ root: 'B', quality: 'dim7', inversion: 0 }, major).roman).toBe('vii°7');
    expect(analyze({ root: 'C', quality: 'aug', inversion: 0 }, major).roman).toBe('I+');
  });
  it('only recommends scales containing every chord pitch', () => {
    for (const q of QUALITIES) {
      const chord = { root: 'C', quality: q.suffix, inversion: 0 };
      const tones = buildChord(chord).notes.map(pc);
      for (const scale of suggestScales(chord, major)) {
        expect(tones.every((t) => scale.notes.map(pc).includes(t))).toBe(true);
      }
    }
  });
  it('offers a valid tritone substitution sharing the guide tones', () => {
    const choices = substitutions({ root: 'G', quality: '7', inversion: 0 });
    const tritone = buildChord(choices[0].chord);
    expect(pc(choices[0].chord.root)).toBe(pc('Db'));
    expect(tritone.notes.map(pc)).toEqual(expect.arrayContaining([pc('B'), pc('F')]));
  });
});

describe('guitar voicings', () => {
  it('returns reproducible chord-complete, bass-correct shapes', () => {
    const spec = { root: 'C', quality: 'maj7', inversion: 0 } as const;
    const voicings = guitarVoicings(spec);
    expect(voicings.length).toBeGreaterThan(0);
    expect(voicings).toEqual(guitarVoicings(spec));
    const tones = buildChord(spec).notes.map(pc).sort();
    for (const shape of voicings) {
      expect(shape).toHaveLength(6);
      expect(shape.every((f) => f === null || (f >= 0 && f <= 12))).toBe(true);
      const pitches = voicingMidi(shape);
      expect([...new Set(pitches.map((m) => m % 12))].sort()).toEqual(tones);
      expect(Math.min(...pitches) % 12).toBe(pc('C'));
      const positive = shape.filter((f): f is number => f !== null && f > 0);
      expect(Math.max(...positive) - Math.min(...positive)).toBeLessThanOrEqual(3);
    }
  });
  it('respects slash-chord bass and ranks against a previous shape', () => {
    const previous = guitarVoicings({ root: 'C', quality: 'maj7', inversion: 0 })[0];
    const spec = { root: 'A', quality: 'm7', inversion: 1 } as const;
    const choices = guitarVoicings(spec, previous);
    expect(choices.length).toBeGreaterThan(0);
    for (const shape of choices) expect(Math.min(...voicingMidi(shape)) % 12).toBe(pc('C'));
    expect(movement(previous, previous)).toBe(0);
    expect(TUNING).toEqual([40, 45, 50, 55, 59, 64]);
  });
});
