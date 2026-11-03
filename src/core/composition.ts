import { audioBeats } from './studio';
import { buildChord, keyNotes, pc } from './theory';
import type { Arrangement } from './project';

export interface MelodyNote {
  id: string;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
}
export interface MixChannel {
  volume: number;
  muted: boolean;
  solo: boolean;
}
export type Channel = 'harmony' | 'melody' | 'bass' | 'drums';
export interface BackingSettings {
  enabled: boolean;
  style: 'rock' | 'ballad' | 'shuffle';
  mix: Record<Channel, MixChannel>;
}
export const CHANNELS: Channel[] = ['harmony', 'melody', 'bass', 'drums'];
export function defaultBacking(): BackingSettings {
  return {
    enabled: false,
    style: 'rock',
    mix: {
      harmony: { volume: 0.8, muted: false, solo: false },
      melody: { volume: 0.8, muted: false, solo: false },
      bass: { volume: 0.65, muted: false, solo: false },
      drums: { volume: 0.5, muted: false, solo: false },
    },
  };
}
export function channelGain(settings: BackingSettings, channel: Channel): number {
  const audible = CHANNELS.filter((c) => settings.enabled || (c !== 'bass' && c !== 'drums'));
  const anySolo = audible.some((c) => settings.mix[c].solo);
  const mix = settings.mix[channel];
  return mix.muted || (anySolo && !mix.solo) ? 0 : mix.volume;
}
export function arrangementBeats(
  p: Pick<Arrangement, 'chords' | 'melody' | 'audio' | 'bpm'>,
): number {
  return Math.max(
    p.chords.reduce((n, c) => n + c.beats, 0),
    ...p.melody.map((n) => n.start + n.duration),
    audioBeats(p.audio, p.bpm),
    0,
  );
}
export function chordTimeline(p: Pick<Arrangement, 'chords'>) {
  let start = 0;
  return p.chords.map((chord, index) => {
    const item = { chord, index, start, end: start + chord.beats };
    start = item.end;
    return item;
  });
}
export function noteName(midi: number): string {
  return (
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] +
    (Math.floor(midi / 12) - 1)
  );
}
export interface MusicEvent {
  beat: number;
  duration: number;
  notes: number[];
  velocity: number;
  channel: Channel;
  drum?: 'kick' | 'snare' | 'hat';
}
export function compositionEvents(p: Arrangement): MusicEvent[] {
  const events: MusicEvent[] = [];
  const gains = Object.fromEntries(
    CHANNELS.map((c) => [
      c,
      p.audio.tracks.some((t) => t.solo) && !p.backing.mix[c].solo ? 0 : channelGain(p.backing, c),
    ]),
  ) as Record<Channel, number>;
  const add = (e: MusicEvent) => {
    if (gains[e.channel] > 0) events.push({ ...e, velocity: e.velocity * gains[e.channel] });
  };
  const end = arrangementBeats(p);
  for (const { chord, start, end: chordEnd } of chordTimeline(p)) {
    add({
      beat: start,
      duration: chord.beats * 0.94,
      notes: buildChord(chord).midi,
      velocity: 0.7,
      channel: 'harmony',
    });
    if (p.backing.enabled) {
      const bass = 36 + pc(chord.root);
      const step = p.backing.style === 'ballad' ? 2 : 1;
      for (let b = start, i = 0; b < chordEnd; b += step, i++) {
        add({
          beat: b,
          duration: Math.min(step * 0.85, chordEnd - b),
          notes: [bass + (i % 4 === 2 ? 7 : 0)],
          velocity: 0.65,
          channel: 'bass',
        });
      }
    }
  }
  for (const n of p.melody)
    add({
      beat: n.start,
      duration: n.duration * 0.92,
      notes: [n.midi],
      velocity: n.velocity,
      channel: 'melody',
    });
  if (p.backing.enabled) {
    for (let b = 0; b < end; b++) {
      if (b % 4 === 0 || b % 4 === 2)
        add({
          beat: b,
          duration: 0.25,
          notes: [36],
          velocity: 0.8,
          channel: 'drums',
          drum: 'kick',
        });
      if (b % 4 === 1 || b % 4 === 3)
        add({
          beat: b,
          duration: 0.2,
          notes: [38],
          velocity: 0.5,
          channel: 'drums',
          drum: 'snare',
        });
      const offbeat = p.backing.style === 'shuffle' ? 2 / 3 : 0.5;
      for (const offset of p.backing.style === 'ballad' ? [0] : [0, offbeat]) {
        if (b + offset < end)
          add({
            beat: b + offset,
            duration: 0.08,
            notes: [42],
            velocity: 0.22,
            channel: 'drums',
            drum: 'hat',
          });
      }
    }
  }
  return events.sort(
    (a, b) => a.beat - b.beat || CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel),
  );
}
/** A seeded sketch, not an AI model. Target chord tones on beats, scale tones between. */
export function generateMelody(p: Arrangement, seed: number): Omit<MelodyNote, 'id'>[] {
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  let previous = 67;
  const notes: Omit<MelodyNote, 'id'>[] = [];
  for (const { chord, start } of chordTimeline(p)) {
    const tones = buildChord(chord).notes.map(pc);
    const scale = keyNotes(p.key).map(pc);
    for (let beat = 0; beat < chord.beats && notes.length < 512; beat += 0.5) {
      if (beat % 1 !== 0 && random() < 0.3) continue;
      const pool = beat % 1 === 0 ? tones : scale;
      const candidates = Array.from({ length: 20 }, (_, i) => i + 60).filter((m) =>
        pool.includes(m % 12),
      );
      candidates.sort((a, b) => Math.abs(a - previous) - Math.abs(b - previous) || a - b);
      const midi = candidates[Math.floor(random() * Math.min(3, candidates.length))];
      previous = midi;
      notes.push({
        midi,
        start: start + beat,
        duration: 0.5,
        velocity: beat % 1 === 0 ? 0.8 : 0.65,
      });
    }
  }
  return notes;
}
