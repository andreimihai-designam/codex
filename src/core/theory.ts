import { Chord, Note, Scale } from '@tonaljs/tonal';

export const ROOTS = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
];
export const QUALITIES = [
  { suffix: '', label: 'Major', formula: '1 · 3 · 5' },
  { suffix: 'm', label: 'Minor', formula: '1 · ♭3 · 5' },
  { suffix: '7', label: 'Dominant 7', formula: '1 · 3 · 5 · ♭7' },
  { suffix: 'maj7', label: 'Major 7', formula: '1 · 3 · 5 · 7' },
  { suffix: 'm7', label: 'Minor 7', formula: '1 · ♭3 · 5 · ♭7' },
  { suffix: 'sus2', label: 'Sus 2', formula: '1 · 2 · 5' },
  { suffix: 'sus4', label: 'Sus 4', formula: '1 · 4 · 5' },
  { suffix: 'dim', label: 'Diminuat', formula: '1 · ♭3 · ♭5' },
  { suffix: 'dim7', label: 'Diminuat 7', formula: '1 · ♭3 · ♭5 · 𝄫7' },
  { suffix: 'm7b5', label: 'Semidiminuat', formula: '1 · ♭3 · ♭5 · ♭7' },
  { suffix: 'aug', label: 'Augmentat', formula: '1 · 3 · ♯5' },
  { suffix: 'add9', label: 'Add 9', formula: '1 · 3 · 5 · 9' },
  { suffix: '9', label: 'Dominant 9', formula: '1 · 3 · 5 · ♭7 · 9' },
  { suffix: 'm9', label: 'Minor 9', formula: '1 · ♭3 · 5 · ♭7 · 9' },
  { suffix: '5', label: 'Power chord', formula: '1 · 5' },
  { suffix: '6', label: 'Major cu sextă', formula: '1 · 3 · 5 · 6' },
  { suffix: 'm6', label: 'Minor cu sextă', formula: '1 · ♭3 · 5 · 6' },
  { suffix: 'maj9', label: 'Major 9', formula: '1 · 3 · 5 · 7 · 9' },
  { suffix: '11', label: 'Dominant 11, fără terță', formula: '1 · 5 · ♭7 · 9 · 11' },
  { suffix: 'm11', label: 'Minor 11', formula: '1 · ♭3 · 5 · ♭7 · 9 · 11' },
  { suffix: '13', label: 'Dominant 13', formula: '1 · 3 · 5 · ♭7 · 9 · 13' },
  { suffix: 'maj13', label: 'Major 13', formula: '1 · 3 · 5 · 7 · 9 · 13' },
  { suffix: 'm13', label: 'Minor 13', formula: '1 · ♭3 · 5 · ♭7 · 9 · 13' },
  { suffix: '7b5', label: 'Dominant 7 cu cvintă micșorată', formula: '1 · 3 · ♭5 · ♭7' },
  { suffix: '7#5', label: 'Dominant 7 cu cvintă mărită', formula: '1 · 3 · ♯5 · ♭7' },
  { suffix: '7b9', label: 'Dominant 7 cu nonă micșorată', formula: '1 · 3 · 5 · ♭7 · ♭9' },
  { suffix: '7#9', label: 'Dominant 7 cu nonă mărită', formula: '1 · 3 · 5 · ♭7 · ♯9' },
  { suffix: '7sus4', label: 'Dominant 7 suspendat', formula: '1 · 4 · 5 · ♭7' },
] as const;
export type Quality = (typeof QUALITIES)[number]['suffix'];
export interface ChordSpec {
  root: string;
  quality: Quality;
  inversion: number;
}
export interface BuiltChord {
  symbol: string;
  notes: string[];
  intervals: string[];
  midi: number[];
  bass: string;
}
export interface Key {
  root: string;
  mode: 'major' | 'minor';
}
export const pc = (note: string): number => {
  const value = Note.chroma(note);
  if (value === undefined || value === null) throw new Error(`Notă invalidă: ${note}`);
  return value;
};
export const mod = (n: number, base = 12) => ((n % base) + base) % base;

export function buildChord(spec: ChordSpec): BuiltChord {
  if (
    !/^[A-G](?:#{1,2}|b{1,2})?$/.test(spec.root) ||
    !QUALITIES.some((q) => q.suffix === spec.quality)
  )
    throw new Error('Acord invalid.');
  const chord = Chord.get(spec.root + spec.quality);
  if (
    chord.empty ||
    !Number.isInteger(spec.inversion) ||
    spec.inversion < 0 ||
    spec.inversion >= chord.notes.length
  )
    throw new Error('Inversiune invalidă.');
  const ordered = [...chord.notes.slice(spec.inversion), ...chord.notes.slice(0, spec.inversion)];
  let last = 47;
  const midi = ordered.map((note) => {
    let value = 48 + pc(note);
    while (value <= last) value += 12;
    last = value;
    return value;
  });
  return {
    symbol: spec.root + spec.quality + (spec.inversion ? `/${ordered[0]}` : ''),
    notes: ordered,
    midi,
    bass: ordered[0],
    intervals: chord.intervals,
  };
}

export function identifyChord(input: string): string[] {
  const notes = input
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (
    notes.length < 2 ||
    notes.length > 12 ||
    notes.some((n) => !/^[A-G](?:#{1,2}|b{1,2})?$/.test(n))
  )
    return [];
  return Chord.detect(notes, { assumePerfectFifth: false });
}

export function keyNotes(key: Key): string[] {
  return Scale.get(`${key.root} ${key.mode}`).notes;
}
export interface Analysis {
  roman: string;
  function: string;
  explanation: string;
  diatonic: boolean;
}
export function analyze(spec: ChordSpec, key: Key): Analysis {
  const scale = keyNotes(key);
  const chord = buildChord(spec);
  const degrees = scale.map(pc);
  const degree = degrees.indexOf(pc(spec.root));
  const diatonic = chord.notes.every((n) => degrees.includes(pc(n)));
  const minor = ['m', 'm6', 'm7', 'm9', 'm11', 'm13', 'dim', 'dim7', 'm7b5'].includes(spec.quality);
  const base = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree];
  const suffix: Record<Quality, string> = {
    '': '',
    m: '',
    '7': '7',
    maj7: 'maj7',
    m7: '7',
    sus2: 'sus2',
    sus4: 'sus4',
    dim: '°',
    dim7: '°7',
    m7b5: 'ø7',
    aug: '+',
    add9: 'add9',
    '9': '9',
    m9: '9',
    '5': '5',
    '6': '(add6)',
    m6: '(add6)',
    maj9: 'maj9',
    '11': '11',
    m11: '11',
    '13': '13',
    maj13: 'maj13',
    m13: '13',
    '7b5': '7♭5',
    '7#5': '7♯5',
    '7b9': '7♭9',
    '7#9': '7♯9',
    '7sus4': '7sus4',
  };
  const roman = base ? (minor ? base.toLowerCase() : base) + suffix[spec.quality] : '—';
  if (diatonic) {
    const category =
      degree === 0 || degree === 2 || degree === 5
        ? 'Tonică'
        : degree === 1 || degree === 3
          ? 'Predominantă'
          : 'Dominantă';
    const explanation =
      category === 'Tonică'
        ? 'Zonă de stabilitate sau prelungire a tonicii.'
        : category === 'Predominantă'
          ? 'Pregătește mișcarea către dominantă.'
          : 'Creează tensiune și poate conduce către tonică.';
    return {
      roman,
      function: category,
      explanation: `${explanation} Notele aparțin gamei ${key.root} ${key.mode === 'major' ? 'major' : 'minor natural'}. Funcția este o interpretare contextuală.`,
      diatonic,
    };
  }
  if (['', '7', '9', '11', '13', '7b5', '7#5', '7b9', '7#9', '7sus4'].includes(spec.quality)) {
    const target = degrees.indexOf(mod(pc(spec.root) + 5));
    if (target >= 0) {
      const third = mod(degrees[(target + 2) % 7] - degrees[target]);
      const fifth = mod(degrees[(target + 4) % 7] - degrees[target]);
      const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][target];
      const targetRoman =
        (third === 3 ? numeral.toLowerCase() : numeral) + (fifth === 6 ? '°' : '');
      return {
        roman: target === 0 ? 'V' + (spec.quality || '') : `V${spec.quality}/${targetRoman}`,
        function: target === 0 ? 'Dominantă' : 'Dominantă secundară',
        explanation: `Poate rezolva către ${scale[target]}. Interpretarea depinde de acordul următor; gama minoră naturală nu include sensibila ridicată.`,
        diatonic: false,
      };
    }
  }
  return {
    roman,
    function: 'Cromatic / împrumutat',
    explanation:
      'Conține note din afara gamei alese. Poate fi un împrumut modal sau o mișcare cromatică; contextul decide interpretarea.',
    diatonic: false,
  };
}

export function suggestScales(spec: ChordSpec, key: Key) {
  const chord = buildChord(spec);
  const chordPcs = chord.notes.map(pc);
  const candidates = [
    { root: key.root, mode: key.mode },
    ...[
      'major',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'minor',
      'locrian',
      'harmonic minor',
      'minor pentatonic',
      'major pentatonic',
    ].map((mode) => ({ root: spec.root, mode })),
  ];
  const seen = new Set<string>();
  return candidates
    .flatMap((candidate) => {
      const name = `${candidate.root} ${candidate.mode}`;
      if (seen.has(name)) return [];
      seen.add(name);
      const notes = Scale.get(name).notes;
      if (!chordPcs.every((p) => notes.some((n) => pc(n) === p))) return [];
      const shared = notes.filter((n) => keyNotes(key).some((k) => pc(k) === pc(n))).length;
      return [
        {
          name,
          notes,
          score: shared / notes.length,
          reason:
            name === `${key.root} ${key.mode}`
              ? 'Include acordul și păstrează tonalitatea.'
              : 'Include toate notele acordului; verifică tensiunile în progresie.',
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 4);
}

export function substitutions(spec: ChordSpec): { chord: ChordSpec; reason: string }[] {
  const result: { chord: ChordSpec; reason: string }[] = [];
  const add = (root: string, quality: Quality, reason: string) =>
    result.push({ chord: { root, quality, inversion: 0 }, reason });
  if (spec.quality === '')
    add(spec.root, 'maj7', 'Adaugă septima mare pentru o culoare mai deschisă.');
  if (spec.quality === 'm') add(spec.root, 'm7', 'Adaugă septima mică, păstrând triada minoră.');
  if (['7', '9'].includes(spec.quality))
    add(
      Note.transpose(spec.root, '5d'),
      '7',
      'Substituție de triton: păstrează enarmonic terța și septima dominantei; verifică rezolvarea.',
    );
  if (['', 'maj7'].includes(spec.quality))
    add(
      Note.transpose(spec.root, '-3m'),
      'm7',
      'Relativul minor împarte note cu acordul inițial; funcția poate deveni diferită.',
    );
  if (['m', 'm7', 'm9'].includes(spec.quality))
    add(
      Note.transpose(spec.root, '3m'),
      'maj7',
      'Relativul major oferă note comune și o altă culoare armonică.',
    );
  return result;
}
