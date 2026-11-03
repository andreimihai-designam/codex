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
