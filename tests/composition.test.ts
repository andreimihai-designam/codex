import { describe, expect, it } from 'vitest';
import { addRevision, newProject, parseProject, validateProject } from '../src/core/project';
import { arrangementBeats, compositionEvents, generateMelody } from '../src/core/composition';
import { buildChord, pc } from '../src/core/theory';
import { exportMidi } from '../src/core/midi';
import { encodeWav, renderWav } from '../src/services/audio';

describe('composition planning', () => {
  it('generates reproducible sketches with chord-tone targets on strong beats', () => {
    const p = newProject();
    const a = generateMelody(p, 42);
    expect(a).toEqual(generateMelody(p, 42));
    expect(a).not.toEqual(generateMelody(p, 123));
    expect(a.length).toBeGreaterThan(16);
    for (const n of a) {
      expect(n.midi).toBeGreaterThanOrEqual(60);
      expect(n.midi).toBeLessThan(80);
      if (Number.isInteger(n.start)) {
        const chord = p.chords[Math.floor(n.start / 4)];
        expect(buildChord(chord).notes.map(pc)).toContain(n.midi % 12);
      }
    }
  });
  it('keeps chord offsets exact for non-four-beat changes', () => {
    const p = newProject();
    p.chords[0].beats = 3;
    p.chords[1].beats = 2;
    expect(
      compositionEvents(p)
        .filter((e) => e.channel === 'harmony')
        .map((e) => e.beat),
    ).toEqual([0, 3, 5, 9]);
    expect(arrangementBeats(p)).toBe(13);
  });
  it('adds bass and drums only when enabled and distinguishes shuffle timing', () => {
    const p = newProject();
    expect(compositionEvents(p).every((e) => e.channel === 'harmony')).toBe(true);
    p.backing.enabled = true;
    const straight = compositionEvents(p);
    expect(straight.some((e) => e.channel === 'bass')).toBe(true);
    expect(straight.find((e) => e.drum === 'hat' && e.beat > 0)?.beat).toBe(0.5);
    p.backing.style = 'shuffle';
    expect(compositionEvents(p).find((e) => e.drum === 'hat' && e.beat > 0)?.beat).toBe(2 / 3);
    p.backing.style = 'ballad';
    expect(compositionEvents(p).filter((e) => e.channel === 'bass')).toHaveLength(8);
  });
  it('applies mute, solo and channel volume to the actual events', () => {
    const p = newProject();
    p.backing.enabled = true;
    p.backing.mix.bass.solo = true;
    expect(compositionEvents(p).every((e) => e.channel === 'bass')).toBe(true);
    p.backing.mix.bass.muted = true;
    expect(compositionEvents(p)).toHaveLength(0);
    p.backing.mix.bass.solo = false;
    expect(compositionEvents(p).some((e) => e.channel === 'harmony')).toBe(true);
    p.backing.mix.harmony.volume = 0;
    expect(compositionEvents(p).some((e) => e.channel === 'harmony')).toBe(false);
    p.backing.enabled = false;
    p.backing.mix.harmony.volume = 1;
    p.backing.mix.bass.muted = false;
    p.backing.mix.bass.solo = true;
    expect(compositionEvents(p).some((e) => e.channel === 'harmony')).toBe(true);
  });
  it('supports melody-only projects and extends the arrangement to note ends', () => {
    const p = newProject(false);
    p.melody = [{ id: 'lead', midi: 64, start: 2.5, duration: 1, velocity: 0.8 }];
    expect(arrangementBeats(p)).toBe(3.5);
    const events = compositionEvents(p);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ beat: 2.5, duration: 0.92, notes: [64], channel: 'melody' });
    expect(events[0].velocity).toBeCloseTo(0.64);
  });
});

describe('versioned composition data', () => {
  it('migrates v1 projects and history without changing their musical content', () => {
    const p = addRevision(newProject());
    const legacy = { ...p, schemaVersion: 1 } as Record<string, unknown>;
    delete legacy.melody;
    delete legacy.backing;
    const revisions = legacy.revisions as { arrangement: Record<string, unknown> }[];
    delete revisions[0].arrangement.melody;
    delete revisions[0].arrangement.backing;
    const restored = parseProject(JSON.stringify(legacy));
    expect(restored.schemaVersion).toBe(3);
    expect(restored.chords).toEqual(p.chords);
    expect(restored.melody).toEqual([]);
    expect(restored.backing.enabled).toBe(false);
    expect(restored.revisions[0].arrangement.melody).toEqual([]);
  });
  it('round-trips melody and mix settings in isolated history snapshots', () => {
    const p = newProject();
    p.melody = generateMelody(p, 42).map((n, i) => ({ ...n, id: String(i) }));
    p.backing.enabled = true;
    const saved = addRevision(p);
    p.melody[0].midi = 48;
    p.backing.mix.drums.volume = 0;
    expect(saved.revisions[0].arrangement.melody[0].midi).not.toBe(48);
    expect(saved.revisions[0].arrangement.backing.mix.drums.volume).toBe(0.5);
    expect(parseProject(JSON.stringify(saved))).toEqual(saved);
  });
  it('rejects malformed melody, mix, missing v2 fields and non-grid timing', () => {
    const p = newProject();
    p.melody = [{ id: 'x', midi: 64, start: 0, duration: 0.5, velocity: 0.8 }];
    for (const patch of [
      { midi: 128 },
      { start: 0.1 },
      { start: -1 },
      { duration: NaN },
      { velocity: 2 },
    ]) {
      expect(() => validateProject({ ...p, melody: [{ ...p.melody[0], ...patch }] })).toThrow(
        'melodic',
      );
    }
    expect(() => validateProject({ ...p, melody: undefined })).toThrow('Melodie');
    expect(() =>
      validateProject({
        ...p,
        backing: {
          ...p.backing,
          mix: { ...p.backing.mix, bass: { volume: 2, muted: false, solo: false } },
        },
      }),
    ).toThrow('Mixaj');
  });
});

// Independent SMF decoder: checks written bytes rather than reusing the exporter.
function readMidi(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, len: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + len));
  expect(text(0, 4)).toBe('MThd');
  expect(view.getUint16(8)).toBe(1);
  expect(view.getUint16(12)).toBe(480);
  const tracks: { tick: number; status: number; meta?: number; data: number[] }[][] = [];
  let pos = 14;
  while (pos < bytes.length) {
    expect(text(pos, 4)).toBe('MTrk');
    const end = pos + 8 + view.getUint32(pos + 4);
    pos += 8;
    let tick = 0;
    const events: (typeof tracks)[number] = [];
    const variable = () => {
      let n = 0,
        v = 0;
      do {
        v = bytes[pos++];
        n = n * 128 + (v & 127);
      } while (v & 128);
      return n;
    };
    while (pos < end) {
      tick += variable();
      const status = bytes[pos++];
      if (status === 255) {
        const meta = bytes[pos++];
        const len = variable();
        const data = [...bytes.slice(pos, pos + len)];
        pos += len;
        events.push({ tick, status, meta, data });
      } else {
        const length = (status & 240) === 192 ? 1 : 2;
        const data = [...bytes.slice(pos, pos + length)];
        pos += length;
        events.push({ tick, status, data });
      }
    }
    expect(pos).toBe(end);
    tracks.push(events);
  }
  expect(tracks.length).toBe(view.getUint16(10));
  return tracks;
}
describe('offline interchange export', () => {
  it('writes a valid five-track MIDI with tempo, lead timing and percussion channel', () => {
    const p = newProject();
    p.bpm = 120;
    p.backing.enabled = true;
    p.melody = [{ id: 'x', midi: 67, start: 0.25, duration: 1, velocity: 0.8 }];
    const tracks = readMidi(exportMidi(p));
    expect(tracks).toHaveLength(5);
    expect(tracks[0].find((e) => e.meta === 81)?.data).toEqual([7, 161, 32]);
    expect(tracks[0].find((e) => e.meta === 88)?.data).toEqual([4, 2, 24, 8]);
    expect(tracks[2].find((e) => (e.status & 240) === 144)?.tick).toBe(120);
    expect(
      tracks[4].filter((e) => (e.status & 240) === 144).every((e) => (e.status & 15) === 9),
    ).toBe(true);
    for (const track of tracks) {
      const ons = track.filter((e) => (e.status & 240) === 144),
        offs = track.filter((e) => (e.status & 240) === 128);
      expect(ons.length).toBe(offs.length);
      expect(track.at(-1)?.meta).toBe(47);
      expect(track.at(-1)?.tick).toBe(16 * 480);
    }
  });
  it('merges overlapping same-pitch melody notes to avoid premature MIDI note-off', () => {
    const p = newProject(false);
    p.melody = [
      { id: 'a', midi: 64, start: 0, duration: 1, velocity: 0.8 },
      { id: 'b', midi: 64, start: 0.5, duration: 1, velocity: 0.6 },
    ];
    const track = readMidi(exportMidi(p))[2];
    expect(track.filter((e) => (e.status & 240) === 144)).toHaveLength(1);
    expect(track.filter((e) => (e.status & 240) === 128)).toHaveLength(1);
    expect(track.find((e) => (e.status & 240) === 128)?.tick).toBe(682);
  });
  it('omits muted tracks from exported notes', () => {
    const p = newProject();
    p.backing.mix.harmony.muted = true;
    expect(readMidi(exportMidi(p))[1].filter((e) => (e.status & 240) === 144)).toHaveLength(0);
  });
  it('writes stereo PCM, interleaves channels and prevents sample overflow', () => {
    const wav = encodeWav([new Float32Array([2, -2]), new Float32Array([1, 0])], 44100);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(16384);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(wav.length).toBe(52);
  });
  it('rejects empty and oversized WAV exports before allocating audio buffers', async () => {
    await expect(renderWav(newProject(false))).rejects.toThrow('Adaugă');
    const p = newProject();
    p.bpm = 30;
    p.chords = Array.from({ length: 100 }, () => ({ ...p.chords[0] }));
    await expect(renderWav(p)).rejects.toThrow('3 minute');
    expect(() => encodeWav([new Float32Array([NaN])], 44100)).toThrow('invalid');
  });
});
