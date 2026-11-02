import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRevision, newProject, validateProject } from '../src/core/project';
import { audioBeats, emptyAudio, splitClip, validateAudio } from '../src/core/studio';
import { compositionEvents } from '../src/core/composition';
import { AudioEngine, clipEvents } from '../src/services/audio';

function session() {
  return {
    assets: [
      {
        id: 'asset-1',
        name: 'guitar.wav',
        duration: 2,
        sampleRate: 44100,
        channels: 1,
        peaks: [0, 0.5, 1],
      },
    ],
    tracks: [
      {
        id: 'track-1',
        name: 'Guitar',
        volume: 0.8,
        pan: -0.5,
        muted: false,
        solo: false,
        clips: [
          { id: 'clip-1', assetId: 'asset-1', start: 4, trimStart: 0.2, trimEnd: 1.8, gain: 0.7 },
        ],
      },
    ],
  };
}
describe('audio session and edits', () => {
  it('migrates v1/v2 to empty audio, including history', () => {
    const p = addRevision(newProject());
    for (const schemaVersion of [1, 2]) {
      const migrated = validateProject({ ...p, schemaVersion, audio: undefined });
      expect(migrated.schemaVersion).toBe(3);
      expect(migrated.audio).toEqual(emptyAudio());
      expect(migrated.revisions[0].arrangement.audio).toEqual(emptyAudio());
    }
  });
  it('round-trips validated audio and isolates history metadata', () => {
    const p = newProject();
    p.audio = validateAudio(session());
    const snapshot = addRevision(p);
    p.audio.tracks[0].clips[0].trimStart = 0.4;
    expect(snapshot.revisions[0].arrangement.audio.tracks[0].clips[0].trimStart).toBe(0.2);
    expect(validateProject(snapshot)).toEqual(snapshot);
  });
  it('splits without changing source coverage or timing', () => {
    const clip = session().tracks[0].clips[0];
    const [a, b] = splitClip(clip, 5, 120, 'second');
    expect(a.trimEnd).toBeCloseTo(0.7);
    expect(b.trimStart).toBe(a.trimEnd);
    expect(b.start).toBe(5);
    expect(b.id).toBe('second');
    expect(a.trimEnd - a.trimStart + (b.trimEnd - b.trimStart)).toBeCloseTo(1.6);
    expect(() => splitClip(clip, 4, 120, 'x')).toThrow('interiorul');
    expect(() => splitClip(clip, 20, 120, 'x')).toThrow();
  });
  it('rejects missing assets, invalid trims, nonfinite mix and duplicate IDs', () => {
    const p = session();
    p.tracks[0].clips[0].assetId = 'missing';
    expect(() => validateAudio(p)).toThrow('Clip');
    const q = session();
    q.tracks[0].clips[0].trimEnd = 20;
    expect(() => validateAudio(q)).toThrow('Clip');
    const r = session();
    r.tracks[0].pan = NaN;
    expect(() => validateAudio(r)).toThrow('Pistă');
    const s = session();
    s.tracks[0].clips.push({ ...s.tracks[0].clips[0] });
    expect(() => validateAudio(s)).toThrow('Clip');
  });
  it('plans trim offsets correctly when seeking inside audio', () => {
    const p = newProject(false);
    p.bpm = 120;
    p.audio = session();
    expect(audioBeats(p.audio, p.bpm)).toBeCloseTo(7.2);
    const event = clipEvents(p, 5)[0];
    expect(event.beat).toBe(0);
    expect(event.offset).toBeCloseTo(0.7);
    expect(event.duration).toBeCloseTo(1.1);
    expect(event.pan).toBe(-0.5);
    expect(event.gain).toBeCloseTo(0.56);
    expect(clipEvents(p, 8)).toHaveLength(0);
  });
  it('shares mute/solo decisions across synthetic and recorded parts', () => {
    const p = newProject();
    p.audio = session();
    p.audio.tracks[0].solo = true;
    expect(compositionEvents(p)).toHaveLength(0);
    expect(clipEvents(p)).toHaveLength(1);
    p.audio.tracks[0].solo = false;
    p.backing.mix.melody.solo = true;
    expect(clipEvents(p)).toHaveLength(0);
    p.backing.mix.melody.solo = false;
    p.audio.tracks[0].muted = true;
    expect(clipEvents(p)).toHaveLength(0);
  });
});
describe('transport cancellation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('does not start after stop was pressed during asynchronous asset loading', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    vi.spyOn(engine, 'unlock').mockResolvedValue({
      currentTime: 0,
      state: 'running',
    } as AudioContext);
    let release!: (value: Map<string, AudioBuffer>) => void;
    vi.spyOn(engine, 'loadAssets').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const play = engine.play(newProject(), false, vi.fn(), vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toBeTypeOf('function');
    engine.stop();
    release(new Map());
    await play;
    expect(vi.getTimerCount()).toBe(0);
  });
});
