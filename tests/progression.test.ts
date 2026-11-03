import { describe, expect, it } from 'vitest';
import { generateKeyProgression } from '../src/core/progression';
import { newProject, regenerateProgression, validateProject } from '../src/core/project';
import { ROOTS, buildChord, keyNotes, pc } from '../src/core/theory';

describe('key-driven progression generation', () => {
  it('generates correctly spelled major and natural-minor progressions', () => {
    expect(
      generateKeyProgression({ root: 'C#', mode: 'major' })
        .map(buildChord)
        .map((c) => c.symbol),
    ).toEqual(['C#maj7', 'A#m7', 'D#m7', 'G#7']);
    expect(
      generateKeyProgression({ root: 'A', mode: 'minor' })
        .map(buildChord)
        .map((c) => c.symbol),
    ).toEqual(['Am7', 'Fmaj7', 'Dm7', 'Em7']);
  });
  it('generates exclusively diatonic notes for every offered root and mode', () => {
    for (const root of ROOTS)
      for (const mode of ['major', 'minor'] as const) {
        const key = { root, mode };
        const scale = keyNotes(key).map(pc);
        const chords = generateKeyProgression(key, 9);
        expect(chords).toHaveLength(9);
        expect(chords).toEqual(generateKeyProgression(key, 9));
        for (const chord of chords)
          expect(buildChord(chord).notes.every((n) => scale.includes(pc(n)))).toBe(true);
      }
  });
  it('saves old harmony before replacing chromatic chords, preserving timing and other music', () => {
    const p = newProject();
    p.chords[0] = { ...p.chords[0], root: 'Db', quality: '7b9', beats: 2, section: 'Intro' };
    p.melody = [{ id: 'note', midi: 60, start: 0, duration: 1, velocity: 0.8 }];
    const before = JSON.stringify(p);
    const next = regenerateProgression(p, { root: 'D', mode: 'major' });
    expect(JSON.stringify(p)).toBe(before);
    expect(next.chords.map((c) => buildChord(c).symbol)).toEqual(['Dmaj7', 'Bm7', 'Em7', 'A7']);
    expect(next.chords.map(({ id, beats, section }) => ({ id, beats, section }))).toEqual(
      p.chords.map(({ id, beats, section }) => ({ id, beats, section })),
    );
    expect(next.revisions.at(-1)?.arrangement.chords).toEqual(p.chords);
    expect(next.revisions.at(-1)?.arrangement.key).toEqual(p.key);
    expect(next.melody).toEqual(p.melody);
    expect(next.audio).toEqual(p.audio);
    expect(next.backing).toEqual(p.backing);
    expect(validateProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(regenerateProgression(next, next.key)).toBe(next);
  });
  it('initializes an empty progression and bounds generation', () => {
    const p = regenerateProgression(newProject(false), { root: 'F', mode: 'minor' });
    expect(p.chords).toHaveLength(4);
    expect(new Set(p.chords.map((c) => c.id)).size).toBe(4);
    expect(p.chords.every((c) => c.beats === 4)).toBe(true);
    expect(validateProject(p)).toEqual(p);
    for (const count of [0, -1, 129, 1.5, NaN])
      expect(() => generateKeyProgression(p.key, count)).toThrow();
  });
});
