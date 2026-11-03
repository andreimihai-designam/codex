import { describe, expect, it } from 'vitest';
import { melodyChordGuides, guideAt, isChordTone } from '../src/core/melodyGuide';
import { newProject, validateProject } from '../src/core/project';
import { buildChord } from '../src/core/theory';

describe('progression chord-tone guidance', () => {
  it('follows every chord and exact boundaries, including changes within a measure', () => {
    const p = newProject();
    p.chords = p.chords.map((c, i) => ({ ...c, beats: i === 0 ? 1 : 2 }));
    const guides = melodyChordGuides(p);
    expect(guides).toHaveLength(p.chords.length);
    expect(guides.map((g) => g.notes)).toEqual(p.chords.map((c) => buildChord(c).notes));
    expect(guideAt(guides, 0)?.id).toBe(p.chords[0].id);
    expect(guideAt(guides, 0.75)?.id).toBe(p.chords[0].id);
    expect(guideAt(guides, 1)?.id).toBe(p.chords[1].id);
    expect(guideAt(guides, 3)?.id).toBe(p.chords[2].id);
    for (const beat of [-1, NaN, Infinity, 7]) expect(guideAt(guides, beat)).toBeUndefined();
  });
  it('uses chromatic and enharmonic chord tones in every octave, not C major scale', () => {
    const p = newProject();
    p.chords = [{ ...p.chords[0], root: 'Db', quality: '7b9', inversion: 1 }];
    const guide = melodyChordGuides(p)[0];
    expect(guide.notes).toEqual(['F', 'Ab', 'Cb', 'Ebb', 'Db']);
    expect(guide.root).toBe(1);
    for (const midi of [49, 61, 73, 65, 68, 71, 62]) expect(isChordTone(midi, guide)).toBe(true);
    for (const midi of [60, 64, 67, -1, 128, 60.5, NaN])
      expect(isChordTone(midi, guide)).toBe(false);
    expect(isChordTone(61, undefined)).toBe(false);
    expect(melodyChordGuides({ chords: [] })).toEqual([]);
  });
  it('preserves newly supported extended and altered chords in saved projects', () => {
    const p = newProject();
    p.chords = [
      { ...p.chords[0], root: 'F#', quality: 'maj9', inversion: 0 },
      { ...p.chords[1], root: 'G', quality: '7#9', inversion: 0 },
    ];
    expect(buildChord(p.chords[0]).notes).toEqual(['F#', 'A#', 'C#', 'E#', 'G#']);
    expect(buildChord(p.chords[1]).notes).toEqual(['G', 'B', 'D', 'F', 'A#']);
    expect(validateProject(JSON.parse(JSON.stringify(p))).chords).toEqual(p.chords);
  });
});
