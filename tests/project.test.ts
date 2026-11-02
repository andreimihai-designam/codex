import { describe, expect, it } from 'vitest';
import { addRevision, newProject, parseProject, validateProject } from '../src/core/project';

describe('project interchange and history', () => {
  it('creates an empty project on request and keeps revision numbers increasing', () => {
    expect(newProject(false).chords).toHaveLength(0);
    let p = newProject();
    for (let i = 0; i < 35; i++) p = addRevision(p);
    expect(p.revisions.at(-1)?.label).toBe('Versiunea 35');
  });
  it('round-trips a complete project including independent snapshots', () => {
    const initial = newProject();
    const saved = addRevision(initial);
    initial.chords[0].root = 'F';
    expect(saved.revisions[0].arrangement.chords[0].root).toBe('C');
    expect(parseProject(JSON.stringify(saved))).toEqual(saved);
  });
  it('rejects invalid JSON, schema, tempo, key, duration and duplicate IDs', () => {
    expect(() => parseProject('{broken')).toThrow('JSON');
    expect(() => validateProject({ ...newProject(), schemaVersion: 2 })).toThrow('Versiune');
    expect(() => validateProject({ ...newProject(), bpm: 0 })).toThrow('Tempo');
    expect(() => validateProject({ ...newProject(), key: { root: 'H', mode: 'major' } })).toThrow(
      'Tonalitate',
    );
    const p = newProject();
    p.chords[0].beats = 0;
    expect(() => validateProject(p)).toThrow('Durată');
    p.chords[0].beats = 4;
    p.chords[1].id = p.chords[0].id;
    expect(() => validateProject(p)).toThrow('identificator');
  });
  it('rejects invalid chord data in the current arrangement and history', () => {
    const p = addRevision(newProject());
    p.revisions[0].arrangement.chords[0].inversion = 100;
    expect(() => validateProject(p)).toThrow('Inversiune');
  });
  it('limits file size, chord count and revision count', () => {
    expect(() => parseProject(' '.repeat(2_000_001))).toThrow('2 MB');
    const p = newProject();
    p.chords = Array.from({ length: 129 }, (_, i) => ({ ...p.chords[0], id: String(i) }));
    expect(() => validateProject(p)).toThrow('128');
    let versions = newProject();
    for (let i = 0; i < 35; i++) versions = addRevision(versions);
    expect(versions.revisions.length).toBe(30);
    expect(validateProject(versions).revisions.length).toBe(30);
  });
});
