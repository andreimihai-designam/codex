import { arrangementBeats, CHANNELS, compositionEvents } from './composition';
import type { Arrangement } from './project';
const PPQ = 480;
function variable(value: number): number[] {
  const output = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) output.unshift((value & 127) | 128);
  return output;
}
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
function chunk(name: string, bytes: number[]): number[] {
  return [...ascii(name), ...[24, 16, 8, 0].map((s) => (bytes.length >>> s) & 255), ...bytes];
}
export function exportMidi(p: Arrangement): Uint8Array<ArrayBuffer> {
  const total = arrangementBeats(p);
  if (!total) throw new Error('Adaugă acorduri sau note înainte de export.');
  const tempo = Math.round(60_000_000 / p.bpm);
  const conductor = [
    ...variable(0),
    255,
    81,
    3,
    (tempo >>> 16) & 255,
    (tempo >>> 8) & 255,
    tempo & 255,
    0,
    255,
    88,
    4,
    4,
    2,
    24,
    8,
    ...variable(Math.ceil(total * PPQ)),
    255,
    47,
    0,
  ];
  const events = compositionEvents(p);
  const tracks = CHANNELS.map((channel, index) => {
    const midiChannel = channel === 'drums' ? 9 : index;
    const program = channel === 'bass' ? 33 : channel === 'melody' ? 26 : 24;
    const notes: { tick: number; bytes: number[]; off: boolean }[] = [];
    const spans = events
      .filter((e) => e.channel === channel)
      .flatMap((event) =>
        event.notes.map((note) => ({
          note,
          start: Math.round(event.beat * PPQ),
          end: Math.max(
            Math.round(event.beat * PPQ) + 1,
            Math.round((event.beat + event.duration) * PPQ),
          ),
          velocity: Math.max(1, Math.round(event.velocity * 127)),
        })),
      )
      .sort((a, b) => a.note - b.note || a.start - b.start);
    const merged: typeof spans = [];
    for (const span of spans) {
      const previous = merged.at(-1);
      if (
        channel !== 'drums' &&
        previous &&
        previous.note === span.note &&
        span.start < previous.end
      ) {
        previous.end = Math.max(previous.end, span.end);
        previous.velocity = Math.max(previous.velocity, span.velocity);
      } else merged.push({ ...span });
    }
    for (const span of merged) {
      notes.push({
        tick: span.start,
        bytes: [0x90 | midiChannel, span.note, span.velocity],
        off: false,
      });
      notes.push({ tick: span.end, bytes: [0x80 | midiChannel, span.note, 0], off: true });
    }
    notes.sort(
      (a, b) => a.tick - b.tick || Number(b.off) - Number(a.off) || a.bytes[1] - b.bytes[1],
    );
    const bytes = [
      0,
      255,
      3,
      channel.length,
      ...ascii(channel),
      ...(channel === 'drums' ? [] : [0, 0xc0 | midiChannel, program]),
    ];
    let previous = 0;
    for (const event of notes) {
      bytes.push(...variable(event.tick - previous), ...event.bytes);
      previous = event.tick;
    }
    bytes.push(...variable(Math.max(previous, Math.ceil(total * PPQ)) - previous), 255, 47, 0);
    return chunk('MTrk', bytes);
  });
  return new Uint8Array([
    ...ascii('MThd'),
    0,
    0,
    0,
    6,
    0,
    1,
    0,
    5,
    1,
    224,
    ...chunk('MTrk', conductor),
    ...tracks.flat(),
  ]);
}
