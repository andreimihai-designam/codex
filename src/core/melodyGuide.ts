import { chordTimeline } from './composition';
import { buildChord, pc } from './theory';
import type { Arrangement } from './project';
export interface MelodyChordGuide {
  id: string;
  index: number;
  start: number;
  end: number;
  symbol: string;
  notes: string[];
  pitchClasses: number[];
  root: number;
}
/** The actual progression supplies the guide, including chromatic chords and inversions. */
export function melodyChordGuides(project: Pick<Arrangement, 'chords'>): MelodyChordGuide[] {
  return chordTimeline(project).map(({ chord, index, start, end }) => {
    const built = buildChord(chord);
    return {
      id: chord.id,
      index,
      start,
      end,
      symbol: built.symbol,
      notes: built.notes,
      pitchClasses: built.notes.map(pc),
      root: pc(chord.root),
    };
  });
}
export function guideAt(guides: MelodyChordGuide[], beat: number): MelodyChordGuide | undefined {
  if (!Number.isFinite(beat) || beat < 0) return undefined;
  return guides.find((c) => beat >= c.start && beat < c.end);
}
export function isChordTone(midi: number, guide: MelodyChordGuide | undefined): boolean {
  return (
    Number.isInteger(midi) && midi >= 0 && midi <= 127 && !!guide?.pitchClasses.includes(midi % 12)
  );
}

/** Keep enharmonic spelling and scientific octave correct at B#/Cb boundaries. */
export function chordNoteLabel(midi: number, guide: MelodyChordGuide | undefined): string {
  const index = guide?.pitchClasses.indexOf(midi % 12) ?? -1;
  const spelling =
    index >= 0
      ? guide!.notes[index]
      : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12];
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const offset = [...spelling.slice(1)].reduce(
    (n, a) => n + (a === '#' ? 1 : a === 'b' ? -1 : 0),
    0,
  );
  return `${spelling}${Math.floor((midi - natural[spelling[0]] - offset) / 12) - 1}`;
}
