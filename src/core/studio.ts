export interface AudioAsset {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
}
export interface AudioClip {
  id: string;
  assetId: string;
  start: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
}
export interface AudioTrack {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  clips: AudioClip[];
}
export interface AudioSession {
  assets: AudioAsset[];
  tracks: AudioTrack[];
}
export const emptyAudio = (): AudioSession => ({ assets: [], tracks: [] });
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function validateAudio(value: unknown): AudioSession {
  if (!value || typeof value !== 'object') throw new Error('Sesiune audio invalidă.');
  const p = value as AudioSession;
  if (
    !Array.isArray(p.assets) ||
    p.assets.length > 128 ||
    !Array.isArray(p.tracks) ||
    p.tracks.length > 16
  )
    throw new Error('Limita audio: 16 piste și 128 surse per stare.');
  const ids = new Set<string>();
  const assets = p.assets.map((a) => {
    if (
      !a ||
      !id(a.id) ||
      ids.has(a.id) ||
      typeof a.name !== 'string' ||
      a.name.length > 150 ||
      !Number.isFinite(a.duration) ||
      a.duration <= 0 ||
      a.duration > 180.1 ||
      !Number.isInteger(a.sampleRate) ||
      a.sampleRate < 8000 ||
      a.sampleRate > 192000 ||
      !Number.isInteger(a.channels) ||
      a.channels < 1 ||
      a.channels > 2 ||
      !Array.isArray(a.peaks) ||
      a.peaks.length < 1 ||
      a.peaks.length > 256 ||
      a.peaks.some((n) => !Number.isFinite(n) || n < 0 || n > 1)
    )
      throw new Error('Sursă audio invalidă.');
    ids.add(a.id);
    return {
      id: a.id,
      name: a.name,
      duration: a.duration,
      sampleRate: a.sampleRate,
      channels: a.channels,
      peaks: [...a.peaks],
    };
  });
  const trackIds = new Set<string>(),
    clipIds = new Set<string>();
  let count = 0;
  const tracks = p.tracks.map((t) => {
    if (
      !t ||
      !id(t.id) ||
      trackIds.has(t.id) ||
      typeof t.name !== 'string' ||
      !t.name.trim() ||
      t.name.length > 80 ||
      !Number.isFinite(t.volume) ||
      t.volume < 0 ||
      t.volume > 1 ||
      !Number.isFinite(t.pan) ||
      t.pan < -1 ||
      t.pan > 1 ||
      typeof t.muted !== 'boolean' ||
      typeof t.solo !== 'boolean' ||
      !Array.isArray(t.clips)
    )
      throw new Error('Pistă audio invalidă.');
    trackIds.add(t.id);
    const clips = t.clips.map((c) => {
      const asset = assets.find((a) => a.id === c?.assetId);
      if (
        ++count > 128 ||
        !c ||
        !id(c.id) ||
        clipIds.has(c.id) ||
        !asset ||
        !Number.isFinite(c.start) ||
        c.start < 0 ||
        c.start > 2048 ||
        !Number.isFinite(c.trimStart) ||
        !Number.isFinite(c.trimEnd) ||
        c.trimStart < 0 ||
        c.trimEnd > asset.duration + 0.001 ||
        c.trimEnd - c.trimStart < 0.02 ||
        !Number.isFinite(c.gain) ||
        c.gain < 0 ||
        c.gain > 2
      )
        throw new Error('Clip audio invalid sau sursă lipsă.');
      clipIds.add(c.id);
      return {
        id: c.id,
        assetId: c.assetId,
        start: c.start,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        gain: c.gain,
      };
    });
    return {
      id: t.id,
      name: t.name.trim(),
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      clips,
    };
  });
  return { assets, tracks };
}
export function audioBeats(audio: AudioSession, bpm: number): number {
  return Math.max(
    0,
    ...audio.tracks.flatMap((t) =>
      t.clips.map((c) => c.start + ((c.trimEnd - c.trimStart) * bpm) / 60),
    ),
  );
}
export function trackGain(audio: AudioSession, track: AudioTrack, otherSolo = false): number {
  return track.muted || ((otherSolo || audio.tracks.some((t) => t.solo)) && !track.solo)
    ? 0
    : track.volume;
}
export function splitClip(
  clip: AudioClip,
  beat: number,
  bpm: number,
  newId: string,
): [AudioClip, AudioClip] {
  const offset = ((beat - clip.start) * 60) / bpm;
  if (offset < 0.02 || offset > clip.trimEnd - clip.trimStart - 0.02)
    throw new Error('Cursorul trebuie să fie în interiorul clipului.');
  const point = clip.trimStart + offset;
  return [
    { ...clip, trimEnd: point },
    { ...clip, id: newId, start: beat, trimStart: point },
  ];
}
