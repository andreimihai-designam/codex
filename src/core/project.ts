import { emptyAudio, validateAudio, type AudioSession } from './studio';
import { defaultBacking, CHANNELS, type MelodyNote, type BackingSettings } from './composition';
import { buildChord, ROOTS, type ChordSpec, type Key } from './theory';
export interface ProgressionChord extends ChordSpec {
  id: string;
  beats: number;
  section: string;
}
export interface Arrangement {
  name: string;
  key: Key;
  bpm: number;
  chords: ProgressionChord[];
  melody: MelodyNote[];
  backing: BackingSettings;
  audio: AudioSession;
}
export interface Revision {
  id: string;
  createdAt: string;
  label: string;
  arrangement: Arrangement;
}
export interface Project extends Arrangement {
  schemaVersion: 3;
  id: string;
  updatedAt: string;
  revisions: Revision[];
}
export function newProject(demo = true): Project {
  return {
    schemaVersion: 3,
    id: crypto.randomUUID(),
    name: demo ? 'Schiță de seară' : 'Proiect fără titlu',
    key: { root: 'C', mode: 'major' },
    bpm: 90,
    melody: [],
    backing: defaultBacking(),
    audio: emptyAudio(),
    updatedAt: new Date().toISOString(),
    revisions: [],
    chords: (demo
      ? [
          { root: 'C', quality: 'maj7' },
          { root: 'A', quality: 'm7' },
          { root: 'D', quality: 'm7' },
          { root: 'G', quality: '7' },
        ]
      : []
    ).map((c) => ({
      ...c,
      quality: c.quality as ChordSpec['quality'],
      inversion: 0,
      id: crypto.randomUUID(),
      beats: 4,
      section: 'A',
    })),
  };
}
function arrangement(value: unknown, version = 3): Arrangement {
  const legacy = version === 1;
  if (!value || typeof value !== 'object') throw new Error('Proiect invalid.');
  const p = value as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100)
    throw new Error('Numele proiectului trebuie să aibă 1–100 caractere.');
  if (typeof p.bpm !== 'number' || !Number.isInteger(p.bpm) || p.bpm < 30 || p.bpm > 240)
    throw new Error('Tempo invalid (30–240 BPM).');
  const key = p.key as Key | undefined;
  if (!key || !ROOTS.includes(key.root) || !['major', 'minor'].includes(key.mode))
    throw new Error('Tonalitate invalidă.');
  if (!Array.isArray(p.chords) || p.chords.length > 128)
    throw new Error('Progresia poate conține maximum 128 acorduri.');
  const ids = new Set<string>();
  const chords = p.chords.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Acord invalid.');
    const c = raw as ProgressionChord;
    buildChord(c);
    if (
      typeof c.id !== 'string' ||
      c.id.length > 100 ||
      !c.id ||
      ids.has(c.id) ||
      !Number.isInteger(c.beats) ||
      c.beats < 1 ||
      c.beats > 16 ||
      typeof c.section !== 'string' ||
      c.section.length > 24
    )
      throw new Error('Durată, secțiune sau identificator invalid.');
    ids.add(c.id);
    return {
      id: c.id,
      root: c.root,
      quality: c.quality,
      inversion: c.inversion,
      beats: c.beats,
      section: c.section,
    };
  });
  const rawMelody = legacy ? [] : p.melody;
  if (!Array.isArray(rawMelody) || rawMelody.length > 512)
    throw new Error('Melodie invalidă (maximum 512 note).');
  const melodyIds = new Set<string>();
  const melody = rawMelody.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Notă melodică invalidă.');
    const n = raw as MelodyNote;
    if (
      typeof n.id !== 'string' ||
      !n.id ||
      n.id.length > 100 ||
      melodyIds.has(n.id) ||
      !Number.isInteger(n.midi) ||
      n.midi < 40 ||
      n.midi > 88 ||
      !Number.isFinite(n.start) ||
      n.start < 0 ||
      n.start > 2047.75 ||
      (n.start * 4) % 1 !== 0 ||
      !Number.isFinite(n.duration) ||
      n.duration < 0.25 ||
      n.duration > 16 ||
      (n.duration * 4) % 1 !== 0 ||
      n.start + n.duration > 2048 ||
      !Number.isFinite(n.velocity) ||
      n.velocity < 0.05 ||
      n.velocity > 1
    )
      throw new Error('Înălțime, poziție sau durată melodică invalidă.');
    melodyIds.add(n.id);
    return { id: n.id, midi: n.midi, start: n.start, duration: n.duration, velocity: n.velocity };
  });
  const rawBacking = legacy ? defaultBacking() : (p.backing as BackingSettings);
  if (
    !rawBacking ||
    typeof rawBacking.enabled !== 'boolean' ||
    !['rock', 'ballad', 'shuffle'].includes(rawBacking.style) ||
    !rawBacking.mix
  )
    throw new Error('Setări de acompaniament invalide.');
  const backing = defaultBacking();
  backing.enabled = rawBacking.enabled;
  backing.style = rawBacking.style;
  for (const channel of CHANNELS) {
    const mix = rawBacking.mix[channel];
    if (
      !mix ||
      !Number.isFinite(mix.volume) ||
      mix.volume < 0 ||
      mix.volume > 1 ||
      typeof mix.muted !== 'boolean' ||
      typeof mix.solo !== 'boolean'
    )
      throw new Error('Mixaj invalid.');
    backing.mix[channel] = { volume: mix.volume, muted: mix.muted, solo: mix.solo };
  }
  return {
    name: p.name.trim(),
    bpm: p.bpm,
    key: { root: key.root, mode: key.mode },
    chords,
    melody,
    backing,
    audio: version < 3 ? emptyAudio() : validateAudio(p.audio),
  };
}
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('Fișier invalid.');
  const p = value as Omit<Project, 'schemaVersion'> & { schemaVersion: number };
  if (![1, 2, 3].includes(p.schemaVersion))
    throw new Error('Versiune de proiect incompatibilă. Sunt acceptate versiunile 1, 2 și 3.');
  if (
    typeof p.id !== 'string' ||
    !p.id ||
    p.id.length > 100 ||
    typeof p.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(p.updatedAt))
  )
    throw new Error('Metadate invalide.');
  if (!Array.isArray(p.revisions) || p.revisions.length > 30)
    throw new Error('Istoric invalid (maximum 30 versiuni).');
  const revisions = p.revisions.map((r) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      typeof r.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      typeof r.label !== 'string' ||
      r.label.length > 100
    )
      throw new Error('Versiune salvată invalidă.');
    return {
      id: r.id,
      createdAt: r.createdAt,
      label: r.label,
      arrangement: arrangement(r.arrangement, p.schemaVersion),
    };
  });
  return {
    ...arrangement(p, p.schemaVersion),
    schemaVersion: 3,
    id: p.id,
    updatedAt: p.updatedAt,
    revisions,
  };
}
export function addRevision(project: Project): Project {
  const { name, key, bpm, chords, melody, backing, audio } = project;
  const revision: Revision = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: `Versiunea ${Number(project.revisions.at(-1)?.label.match(/(\d+)$/)?.[1] ?? 0) + 1}`,
    arrangement: structuredClone({ name, key, bpm, chords, melody, backing, audio }),
  };
  return { ...project, revisions: [...project.revisions, revision].slice(-30) };
}
export function parseProject(text: string): Project {
  if (text.length > 8_000_000) throw new Error('Fișierul depășește limita de 8 MB.');
  try {
    return validateProject(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('Fișierul nu conține JSON valid.');
    throw e;
  }
}
