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
}
export interface Revision {
  id: string;
  createdAt: string;
  label: string;
  arrangement: Arrangement;
}
export interface Project extends Arrangement {
  schemaVersion: 1;
  id: string;
  updatedAt: string;
  revisions: Revision[];
}
export function newProject(demo = true): Project {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: demo ? 'Schiță de seară' : 'Proiect fără titlu',
    key: { root: 'C', mode: 'major' },
    bpm: 90,
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
function arrangement(value: unknown): Arrangement {
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
  return { name: p.name.trim(), bpm: p.bpm, key: { root: key.root, mode: key.mode }, chords };
}
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('Fișier invalid.');
  const p = value as Project;
  if (p.schemaVersion !== 1)
    throw new Error('Versiune de proiect incompatibilă. Este acceptată versiunea 1.');
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
      arrangement: arrangement(r.arrangement),
    };
  });
  return { ...arrangement(p), schemaVersion: 1, id: p.id, updatedAt: p.updatedAt, revisions };
}
export function addRevision(project: Project): Project {
  const { name, key, bpm, chords } = project;
  const revision: Revision = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: `Versiunea ${Number(project.revisions.at(-1)?.label.match(/(\d+)$/)?.[1] ?? 0) + 1}`,
    arrangement: structuredClone({ name, key, bpm, chords }),
  };
  return { ...project, revisions: [...project.revisions, revision].slice(-30) };
}
export function parseProject(text: string): Project {
  if (text.length > 2_000_000) throw new Error('Fișierul depășește limita de 2 MB.');
  try {
    return validateProject(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('Fișierul nu conține JSON valid.');
    throw e;
  }
}
