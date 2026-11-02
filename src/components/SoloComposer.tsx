import { useState } from 'react';
import { ArrowLeft, ArrowRight, Music2, Sparkles, Trash2, Volume2 } from 'lucide-react';
import {
  arrangementBeats,
  chordTimeline,
  generateMelody,
  noteName,
  type MelodyNote,
} from '../core/composition';
import { buildChord, keyNotes, pc } from '../core/theory';
import type { Project } from '../core/project';

export default function SoloComposer({
  project,
  disabled,
  onChange,
  onPreview,
}: {
  project: Project;
  disabled: boolean;
  onChange: (notes: MelodyNote[], checkpoint?: boolean) => void;
  onPreview: (midi: number[]) => void;
}) {
  const [measure, setMeasure] = useState(0);
  const [octave, setOctave] = useState(4);
  const [duration, setDuration] = useState(0.5);
  const [velocity, setVelocity] = useState(0.8);
  const [seed, setSeed] = useState(42);
  const [selectedId, setSelectedId] = useState('');
  const selected = project.melody.find((n) => n.id === selectedId);
  const scale = new Set(keyNotes(project.key).map(pc));
  const timeline = chordTimeline(project);
  const register = Array.from({ length: 24 }, (_, i) => (octave + 1) * 12 + 23 - i).filter(
    (m) => m >= 40 && m <= 88,
  );
  function changeSelected(patch: Partial<MelodyNote>) {
    if (selected)
      onChange(project.melody.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)));
  }
  function toggle(midi: number, step: number) {
    if (disabled) return;
    const start = measure * 4 + step / 4;
    const found = project.melody.find(
      (n) => n.midi === midi && n.start <= start && n.start + n.duration > start,
    );
    if (found) {
      setSelectedId(found.id);
      return;
    }
    if (project.melody.length >= 512 || start + duration > 2048) return;
    const note = { id: crypto.randomUUID(), midi, start, duration, velocity };
    onChange([...project.melody, note].sort((a, b) => a.start - b.start || a.midi - b.midi));
    setSelectedId(note.id);
    onPreview([midi]);
  }
  return (
    <div className="composition-layout">
      <section className="panel melody-panel">
        <div className="panel-header">
          <div className="section-title">
            <Music2 size={18} />
            <h2>Solo & Melody Composer</h2>
            <span className="subtle-badge">{project.melody.length}/512 note</span>
          </div>
        </div>
        <div className="composer-intro">
          <h3>O melodie, notă cu notă.</h3>
          <p>
            Adaugă note pe grila de șaisprezecimi. Selectează o notă existentă pentru editare sau
            ștergere. Redarea include armonia și acompaniamentul activ.
          </p>
        </div>
        <div className="melody-tools">
          <div className="measure-nav">
            <button
              className="icon-button"
              aria-label="Măsura anterioară"
              disabled={measure === 0}
              onClick={() => setMeasure((m) => m - 1)}
            >
              <ArrowLeft size={16} />
            </button>
            <strong>Măsura {measure + 1}</strong>
            <button
              className="icon-button"
              aria-label="Măsura următoare"
              disabled={measure >= 511}
              onClick={() => setMeasure((m) => m + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <label>
            Registru
            <select
              aria-label="Registru melodie"
              value={octave}
              onChange={(e) => setOctave(Number(e.target.value))}
            >
              <option value={2}>E2–B3</option>
              <option value={3}>C3–B4</option>
              <option value={4}>C4–B5</option>
              <option value={5}>C5–E6</option>
            </select>
          </label>
          <label>
            Durata notelor noi
            <select
              aria-label="Durata notelor noi"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[0.25, 0.5, 1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n} timpi
                </option>
              ))}
            </select>
          </label>
          <label>
            Intensitate nouă
            <input
              aria-label="Intensitate note noi"
              type="range"
              min="5"
              max="100"
              value={velocity * 100}
              onChange={(e) => setVelocity(Number(e.target.value) / 100)}
            />
          </label>
        </div>
        <div
          className="piano-scroll"
          tabIndex={0}
          role="group"
          aria-label="Editor melodie cu derulare orizontală"
        >
          <div className="piano-roll">
            <div className="roll-ruler">
              <span>4/4</span>
              {Array.from({ length: 16 }, (_, s) => (
                <span key={s} className={s % 4 === 0 ? 'strong-beat' : ''}>
                  {s % 4 === 0 ? s / 4 + 1 : '·'}
                </span>
              ))}
            </div>
            <div className="roll-chords">
              <span>ARMONIE</span>
              {Array.from({ length: 16 }, (_, s) => {
                const beat = measure * 4 + s / 4;
                const item = timeline.find((t) => beat >= t.start && beat < t.end);
                return (
                  <span key={s} title={item ? buildChord(item.chord).symbol : 'Fără acord'}>
                    {s % 4 === 0 && item ? buildChord(item.chord).symbol : ''}
                  </span>
                );
              })}
            </div>
            {register.map((midi) => (
              <div
                key={midi}
                className={`roll-row ${[1, 3, 6, 8, 10].includes(midi % 12) ? 'black-key' : ''}`}
              >
                <button
                  className="piano-key"
                  disabled={disabled}
                  onClick={() => onPreview([midi])}
                  aria-label={`Ascultă ${noteName(midi)}`}
                >
                  {noteName(midi)}
                  {scale.has(midi % 12) && <i />}
                </button>
                {Array.from({ length: 16 }, (_, step) => {
                  const beat = measure * 4 + step / 4;
                  const start = project.melody.find((n) => n.midi === midi && n.start === beat);
                  const sustained = project.melody.find(
                    (n) => n.midi === midi && n.start < beat && n.start + n.duration > beat,
                  );
                  return (
                    <button
                      key={step}
                      aria-label={`${noteName(midi)}, măsura ${measure + 1}, pas ${step + 1}${start ? ', notă existentă' : ''}`}
                      aria-pressed={!!start}
                      disabled={disabled || (!start && project.melody.length >= 512)}
                      onClick={() => toggle(midi, step)}
                      className={`roll-cell ${step % 4 === 0 ? 'beat-boundary' : ''} ${scale.has(midi % 12) ? 'in-scale' : ''} ${start ? 'note-start' : sustained ? 'note-sustain' : ''} ${start?.id === selectedId ? 'note-selected' : ''}`}
                    >
                      {start ? <span>{noteName(midi)}</span> : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="roll-legend">
          <span>
            <i className="legend-dot green" /> Notele gamei sunt marcate pe claviatură
          </span>
          <span>
            Un pas = ¼ timp · {Math.ceil(arrangementBeats(project) / 4)} măsuri în proiect
          </span>
        </div>
      </section>
      <aside className="composer-side">
        <section className="panel">
          <div className="panel-header">
            <h2>{selected ? `Editează ${noteName(selected.midi)}` : 'Selectează o notă'}</h2>
          </div>
          <div className="note-properties">
            {selected ? (
              <>
                <label>
                  Notă MIDI
                  <select
                    aria-label="Înălțime notă selectată"
                    value={selected.midi}
                    disabled={disabled}
                    onChange={(e) => changeSelected({ midi: Number(e.target.value) })}
                  >
                    {Array.from({ length: 49 }, (_, i) => i + 40).map((m) => (
                      <option key={m} value={m}>
                        {noteName(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Durată în timpi
                  <select
                    aria-label="Durată notă selectată"
                    value={selected.duration}
                    disabled={disabled}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      if (selected.start + d <= 2048) changeSelected({ duration: d });
                    }}
                  >
                    {[
                      0.25,
                      0.5,
                      1,
                      2,
                      4,
                      8,
                      16,
                      ...(![0.25, 0.5, 1, 2, 4, 8, 16].includes(selected.duration)
                        ? [selected.duration]
                        : []),
                    ].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Poziție în timpi (de la 0)
                  <input
                    aria-label="Poziție notă selectată"
                    type="number"
                    min="0"
                    max={2048 - selected.duration}
                    step="0.25"
                    value={selected.start}
                    disabled={disabled}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (
                        Number.isFinite(n) &&
                        n >= 0 &&
                        (n * 4) % 1 === 0 &&
                        n + selected.duration <= 2048
                      )
                        changeSelected({ start: n });
                    }}
                  />
                </label>
                <label>
                  Intensitate
                  <input
                    aria-label="Intensitate notă selectată"
                    type="range"
                    min="5"
                    max="100"
                    value={selected.velocity * 100}
                    disabled={disabled}
                    onChange={(e) => changeSelected({ velocity: Number(e.target.value) / 100 })}
                  />
                </label>
                <p>
                  Poziție: măsura {Math.floor(selected.start / 4) + 1}, timpul{' '}
                  {(selected.start % 4) + 1}.
                </p>
                <div className="note-edit-actions">
                  <button
                    className="button"
                    disabled={disabled}
                    onClick={() => onPreview([selected.midi])}
                  >
                    <Volume2 size={15} />
                    Ascultă
                  </button>
                  <button
                    className="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(project.melody.filter((n) => n.id !== selected.id));
                      setSelectedId('');
                    }}
                  >
                    <Trash2 size={15} />
                    Șterge nota
                  </button>
                </div>
              </>
            ) : (
              <p>
                Atinge o celulă pentru a crea o notă. Atinge începutul unei note existente pentru
                a-i schimba durata, înălțimea sau intensitatea.
              </p>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div className="section-title">
              <Sparkles size={17} />
              <h2>Schiță melodică</h2>
            </div>
          </div>
          <div className="note-properties">
            <p>
              Generator determinist: note din acord pe timpi și note din gamă între timpi. O schiță
              de lucru, fără AI sau cloud.
            </p>
            <label>
              Seed
              <input
                type="number"
                aria-label="Seed melodie"
                min="1"
                max="999999"
                value={seed}
                disabled={disabled}
                onChange={(e) =>
                  setSeed(Math.max(1, Math.min(999999, Number(e.target.value) || 1)))
                }
              />
            </label>
            <button
              className="button dark"
              disabled={disabled || !project.chords.length}
              onClick={() => {
                onChange(
                  generateMelody(project, seed).map((n) => ({ ...n, id: crypto.randomUUID() })),
                  true,
                );
                setMeasure(0);
                setSelectedId('');
              }}
            >
              <Sparkles size={15} />
              Generează schiță
            </button>
            <small>Înainte de înlocuire, melodia curentă este păstrată automat în Istoric.</small>
            <button
              className="button"
              disabled={disabled || !project.melody.length}
              onClick={() => {
                onChange([], true);
                setSelectedId('');
              }}
            >
              <Trash2 size={15} />
              Golește melodia
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
