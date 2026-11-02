import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FolderOpen,
  Guitar,
  History,
  Layers3,
  Library,
  ListMusic,
  LoaderCircle,
  Mic2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import {
  analyze,
  buildChord,
  identifyChord,
  keyNotes,
  pc,
  QUALITIES,
  ROOTS,
  substitutions,
  suggestScales,
  type ChordSpec,
  type Quality,
} from './core/theory';
import { guitarVoicings, STRING_NAMES, TUNING, voicingMidi, type Voicing } from './core/guitar';
import {
  addRevision,
  newProject,
  parseProject,
  type Project,
  type ProgressionChord,
} from './core/project';
import { deleteProject, listProjects, saveProject } from './services/storage';
import { AudioEngine, renderWav } from './services/audio';
import { arrangementBeats, type MelodyNote } from './core/composition';
import { exportMidi } from './core/midi';
import SoloComposer from './components/SoloComposer';
import BackingStudio from './components/BackingStudio';
import AudioStudio from './components/AudioStudio';
import AiAssistant from './components/AiAssistant';
import { validateAudio, type AudioSession } from './core/studio';
import { applyAssistantReply, type AssistantReply } from './core/assistant';
import { audioAssetIds, exportBundle, importBundle } from './services/projectBundle';
import { loadChat } from './services/mediaStore';

const audio = new AudioEngine();
const formatDate = (s: string) =>
  new Date(s).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
function IconButton({
  label,
  children,
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Închide" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
function Fretboard({
  chord,
  voicing,
  scaleNotes,
  onNote,
}: {
  chord: ChordSpec;
  voicing?: Voicing;
  scaleNotes: string[];
  onNote: (midi: number) => void;
}) {
  const built = buildChord(chord);
  const tones = new Map(built.notes.map((note) => [pc(note), note]));
  const scale = new Set(scaleNotes.map(pc));
  return (
    <div className="fret-scroll" tabIndex={0} role="group" aria-label="Grif cu derulare orizontală">
      <div
        className="fretboard"
        role="group"
        aria-label="Grif chitară, acordaj standard, de la coarda subțire la cea groasă"
      >
        <div className="fret-numbers">
          <span></span>
          {Array.from({ length: 13 }, (_, f) => (
            <span key={f}>{f === 0 ? 'LIBER' : f}</span>
          ))}
        </div>
        {[5, 4, 3, 2, 1, 0].map((s) => (
          <div className={`string string-${s}`} key={s}>
            <span className="string-label">{STRING_NAMES[s]}</span>
            {Array.from({ length: 13 }, (_, f) => {
              const pitch = (TUNING[s] + f) % 12;
              const note = tones.get(pitch);
              const isRoot = pitch === pc(chord.root);
              const selected = voicing?.[s] === f;
              const label = note ?? ROOTS.find((n) => pc(n) === pitch)!;
              return (
                <button
                  type="button"
                  key={f}
                  className={`fret ${f === 0 ? 'open' : ''} ${note ? 'chord-tone' : scale.has(pitch) ? 'scale-tone' : ''} ${isRoot ? 'root-tone' : ''} ${selected ? 'voiced' : ''}`}
                  aria-label={`Coarda ${STRING_NAMES[s]}, tasta ${f}, ${label}${selected ? ', poziție selectată' : ''}`}
                  onClick={() => onNote(TUNING[s] + f)}
                >
                  <span>{note || (scale.has(pitch) ? '·' : '')}</span>
                  {[3, 5, 7, 9, 12].includes(f) && s === 0 && <i className="fret-dot" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [project, setProject] = useState<Project>(newProject);
  const [loaded, setLoaded] = useState(false);
  const [storageState, setStorageState] = useState<'saving' | 'saved' | 'error'>('saving');
  const [selectedId, setSelectedId] = useState<string>('');
  const [view, setView] = useState<'studio' | 'library'>('studio');
  const [workspaceTab, setWorkspaceTab] = useState<'harmony' | 'solo' | 'backing' | 'audio' | 'ai'>(
    'harmony',
  );
  const [exporting, setExporting] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [audioCursor, setAudioCursor] = useState(0);
  const cursorRef = useRef(0);
  cursorRef.current = audioCursor;
  const workspaceTitle =
    workspaceTab === 'audio'
      ? 'Audio Studio'
      : workspaceTab === 'ai'
        ? 'Asistent AI'
        : workspaceTab === 'solo'
          ? 'Solo & Melody'
          : workspaceTab === 'backing'
            ? 'Backing & Export'
            : 'Harmony Studio';
  const [projects, setProjects] = useState<Project[]>([]);
  const [modal, setModal] = useState<'add' | 'history' | 'help' | null>(null);
  const [root, setRoot] = useState('F');
  const [quality, setQuality] = useState<Quality>('maj7');
  const [identify, setIdentify] = useState('');
  const [notice, setNotice] = useState('');
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [loop, setLoop] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [volume, setVolume] = useState(60);
  const [voicingIndex, setVoicingIndex] = useState(0);
  const [scaleVisible, setScaleVisible] = useState(false);
  const [showVoicing, setShowVoicing] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const projectRef = useRef(project);
  projectRef.current = project;
  const operation = useRef(0);
  const selectedIndex = Math.max(
    0,
    project.chords.findIndex((c) => c.id === selectedId),
  );
  const selected = project.chords[selectedIndex];
  const selectedSymbol = selected ? buildChord(selected).symbol : '';
  const built = useMemo(() => (selected ? buildChord(selected) : null), [selected]);
  const analysis = useMemo(
    () => (selected ? analyze(selected, project.key) : null),
    [selected, project.key],
  );
  const scales = useMemo(
    () => (selected ? suggestScales(selected, project.key) : []),
    [selected, project.key],
  );
  const previous = useMemo(
    () => (selectedIndex > 0 ? guitarVoicings(project.chords[selectedIndex - 1])[0] : undefined),
    [project.chords, selectedIndex],
  );
  const voicings = useMemo(
    () => (selected ? guitarVoicings(selected, previous) : []),
    [selected, previous],
  );
  const voicing = voicings[voicingIndex] ?? voicings[0];
  const totalBeats = arrangementBeats(project);
  const seconds = Math.round((totalBeats * 60) / project.bpm);
  const changesDisabled = playing || !loaded || exporting || mediaBusy;

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((saved) => {
        if (cancelled) return;
        setProjects(saved);
        if (saved.length) setProject(saved[0]);
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            'Stocarea locală nu este disponibilă. Exportă proiectul pentru a păstra modificările.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
      audio.stop();
    };
  }, []);
  useEffect(() => {
    if (!loaded || view !== 'studio') return;
    let current = true;
    setStorageState('saving');
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveProject(project));
      saveQueue.current
        .then(() => {
          if (current) setStorageState('saved');
        })
        .catch(() => {
          if (current) setStorageState('error');
        });
    }, 450);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [project, loaded, view]);
  useEffect(() => {
    setAudioCursor(0);
  }, [project.id]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (mediaBusy) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [mediaBusy]);
  useEffect(() => {
    setVoicingIndex(0);
  }, [selectedSymbol]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        operation.current++;
        audio.stop();
        setPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const update = (fn: (p: Project) => Project) =>
    setProject((p) => ({ ...fn(p), updatedAt: new Date().toISOString() }));
  function updateChord(patch: Partial<ProgressionChord>) {
    if (selected)
      update((p) => ({
        ...p,
        chords: p.chords.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)),
      }));
  }
  function stop() {
    operation.current++;
    audio.stop();
    setPlaying(false);
    setActiveIndex(-1);
    setActiveBeat(-1);
  }
  async function beginPlayback(at = 0, repeat = loop) {
    stop();
    if (!totalBeats) return;
    const token = ++operation.current;
    try {
      await audio.unlock();
      if (token !== operation.current) return;
      setPlaying(true);
      await audio.play(
        project,
        repeat,
        (index, beat, absoluteBeat) => {
          if (workspaceTab === 'audio') setAudioCursor(absoluteBeat);
          setActiveIndex(index);
          setActiveBeat(beat);
        },
        () => {
          setPlaying(false);
          setActiveIndex(-1);
          setActiveBeat(-1);
        },
        at,
      );
    } catch (e) {
      if (token !== operation.current) return;
      stop();
      setNotice(`Redarea nu a pornit: ${e instanceof Error ? e.message : 'audio indisponibil'}`);
    }
  }
  async function togglePlayback() {
    if (playing) {
      stop();
      return;
    }
    await beginPlayback(workspaceTab === 'audio' ? audioCursor : 0);
  }
  function changeAudio(value: AudioSession, checkpoint = false) {
    try {
      const audio = validateAudio(value);
      update((p) => ({ ...(checkpoint ? addRevision(p) : p), audio }));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Sesiune audio invalidă.');
    }
  }
  function applyAi(reply: AssistantReply, parts: { chords: boolean; melody: boolean }) {
    update((p) => ({ ...applyAssistantReply(addRevision(p), reply, parts) }));
    setNotice('Propunerea AI a fost aplicată. Starea anterioară este în Istoric.');
  }
  async function preview(midi: number[]) {
    try {
      await audio.preview(midi);
    } catch {
      setNotice('Audio indisponibil. Verifică setările browserului și încearcă din nou.');
    }
  }
  function addChord(spec: ChordSpec & Partial<Pick<ProgressionChord, 'beats' | 'section'>>) {
    if (project.chords.length >= 128) {
      setNotice('Limita este de 128 acorduri per proiect.');
      return;
    }
    const chord: ProgressionChord = {
      ...spec,
      id: crypto.randomUUID(),
      beats: spec.beats ?? 4,
      section: spec.section ?? 'A',
    };
    update((p) => ({ ...p, chords: [...p.chords, chord] }));
    setSelectedId(chord.id);
    setModal(null);
  }
  function moveChord(delta: number) {
    const next = selectedIndex + delta;
    if (next < 0 || next >= project.chords.length) return;
    update((p) => {
      const chords = [...p.chords];
      [chords[selectedIndex], chords[next]] = [chords[next], chords[selectedIndex]];
      return { ...p, chords };
    });
    setSelectedId(selected.id);
  }
  async function persistCurrent() {
    const p = projectRef.current;
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveProject(p));
    await saveQueue.current;
  }
  async function openLibrary() {
    stop();
    try {
      await persistCurrent();
      setProjects(await listProjects());
      setView('library');
    } catch {
      setNotice(
        'Biblioteca nu poate fi deschisă: salvarea locală a eșuat. Exportă proiectul înainte de a continua.',
      );
    }
  }
  async function createProject() {
    stop();
    try {
      await persistCurrent();
      setProject(newProject(false));
      setSelectedId('');
      setView('studio');
    } catch {
      setNotice('Proiectul curent nu a putut fi salvat. Exportă-l înainte de a crea unul nou.');
    }
  }
  async function snapshot() {
    const next = { ...addRevision(project), updatedAt: new Date().toISOString() };
    setProject(next);
    try {
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveProject(next));
      await saveQueue.current;
      setNotice('Versiune salvată local. O găsești în Istoric.');
    } catch {
      setNotice('Versiunea este în memorie, dar salvarea locală a eșuat. Exportă proiectul.');
    }
  }
  async function exportProject(forceBundle = false) {
    if (mediaBusy || exporting) return;
    setExporting(true);
    try {
      let chatAvailable = true;
      const chat = await loadChat(project.id).catch(() => {
        chatAvailable = false;
        return [];
      });
      const bundled = forceBundle || audioAssetIds(project).length > 0 || chat.length > 0;
      const blob = bundled
        ? await exportBundle(project)
        : new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80)}.${bundled ? 'gcsbundle' : 'gcs.json'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        bundled
          ? 'Backup complet exportat, inclusiv audio și conversație.'
          : chatAvailable
            ? 'Proiect exportat în format .gcs.json.'
            : 'Proiect exportat în JSON. Istoricul AI nu a putut fi citit din browser.',
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Exportul proiectului a eșuat.');
    } finally {
      setExporting(false);
    }
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await persistCurrent();
      const bundled = file.name.toLowerCase().endsWith('.gcsbundle');
      if (!bundled && file.size > 8_000_000) throw new Error('Fișierul depășește limita de 8 MB.');
      const imported = bundled ? await importBundle(file) : parseProject(await file.text());
      if (!bundled && audioAssetIds(imported).length)
        throw new Error(
          'Acest JSON conține referințe audio fără fișiere. Importă backup-ul complet .gcsbundle.',
        );
      // New identity preserves an existing project even when importing its older export.
      stop();
      setProject({
        ...imported,
        id: bundled ? imported.id : crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      });
      setSelectedId('');
      setView('studio');
      setNotice('Proiect importat ca o copie nouă.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Importul a eșuat.');
    }
  }

  function changeMelody(melody: MelodyNote[], checkpoint = false) {
    update((p) => ({ ...(checkpoint ? addRevision(p) : p), melody }));
  }
  function download(bytes: Uint8Array<ArrayBuffer>, extension: string, type: string) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80)}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportAudio(kind: 'midi' | 'wav') {
    if (changesDisabled) return;
    setExporting(true);
    try {
      if (kind === 'midi') download(exportMidi(project), 'mid', 'audio/midi');
      else
        download(
          await renderWav(project, volume / 100, await audio.loadAssets(project)),
          'wav',
          'audio/wav',
        );
      setNotice(
        kind === 'midi'
          ? 'Compoziție exportată ca MIDI multipistă.'
          : 'Mix stereo exportat ca WAV.',
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Exportul a eșuat.');
    } finally {
      setExporting(false);
    }
  }
  const transport = (
    <div className="transport">
      <div className="transport-primary">
        <button
          className={`play-button ${playing ? 'playing' : ''}`}
          aria-label={playing ? 'Oprește progresia' : 'Redă progresia'}
          disabled={!loaded || !totalBeats || exporting}
          onClick={togglePlayback}
        >
          {playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <div className="beat-lights" aria-label="Poziție în măsura de 4 timpi">
          {[0, 1, 2, 3].map((b) => (
            <span key={b} className={activeBeat === b ? 'lit' : ''} />
          ))}
        </div>
        <div className="transport-divider" />
        <label className="tempo">
          <input
            aria-label="Tempo BPM"
            type="number"
            min={30}
            max={240}
            value={project.bpm}
            disabled={changesDisabled}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 30 && n <= 240) update((p) => ({ ...p, bpm: Math.round(n) }));
            }}
          />
          <span>BPM</span>
        </label>
      </div>
      <div className="transport-options">
        <button
          className={`toggle-button ${loop ? 'on' : ''}`}
          onClick={() => setLoop((v) => !v)}
          disabled={playing}
          aria-pressed={loop}
          aria-label="Repetă progresia"
        >
          <Repeat2 size={18} />
        </button>
        <button
          className={`toggle-button ${metronome ? 'on' : ''}`}
          onClick={() => {
            setMetronome((v) => !v);
            audio.setMetronome(!metronome);
          }}
          aria-pressed={metronome}
          aria-label="Metronom"
        >
          <Activity size={18} />
        </button>
        <span className="transport-divider" />
        <Volume2 size={17} />
        <input
          type="range"
          aria-label="Volum"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => {
            const n = Number(e.target.value);
            setVolume(n);
            audio.setVolume(n / 100);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#studio"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            if (mediaBusy) return;
            setView('studio');
            setWorkspaceTab('harmony');
          }}
          aria-label="Guitar Composer Studio"
        >
          <div className="brand-icon">
            <Waves size={25} />
          </div>
          <span>
            guitar<span className="brand-light">composer</span>
            <small>PERSONAL MUSIC WORKSPACE</small>
          </span>
        </a>
        <div className="workspace-label">SPAȚIUL TĂU DE CREAȚIE</div>
        <nav aria-label="Navigare principală">
          <button
            className={
              view === 'studio' && workspaceTab === 'harmony' ? 'nav-item active' : 'nav-item'
            }
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('harmony');
            }}
          >
            <Layers3 size={19} /> Harmony Studio <span className="nav-indicator" />
          </button>
          <button
            className="nav-item"
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('harmony');
              setTimeout(
                () =>
                  document
                    .getElementById('fretboard')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                30,
              );
            }}
          >
            <Guitar size={19} /> Fretboard
          </button>
          <button
            className={view === 'library' ? 'nav-item active' : 'nav-item'}
            onClick={openLibrary}
            disabled={!loaded || mediaBusy}
          >
            <Library size={19} /> Biblioteca mea
          </button>
          <button
            className={
              view === 'studio' && workspaceTab === 'solo' ? 'nav-item active' : 'nav-item'
            }
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('solo');
            }}
          >
            <Music2 size={19} /> Solo & Melody
          </button>
          <button
            className={
              view === 'studio' && workspaceTab === 'backing' ? 'nav-item active' : 'nav-item'
            }
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('backing');
            }}
          >
            <Waves size={19} /> Backing & Export
          </button>
          <button
            className={
              view === 'studio' && workspaceTab === 'audio' ? 'nav-item active' : 'nav-item'
            }
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('audio');
            }}
          >
            <Mic2 size={19} />
            Audio Studio
          </button>
          <button
            className={view === 'studio' && workspaceTab === 'ai' ? 'nav-item active' : 'nav-item'}
            disabled={mediaBusy}
            onClick={() => {
              setView('studio');
              setWorkspaceTab('ai');
            }}
          >
            <Sparkles size={19} />
            Asistent AI
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <div>
              <span className="status-dot" /> Local. Fără limite de idei.
            </div>
            <p>Compozițiile rămân pe dispozitivul tău. Fără cont, fără abonament.</p>
          </div>
          <button className="nav-item help" onClick={() => setModal('help')}>
            <CircleHelp size={18} /> Ghidul studioului <span>↗</span>
          </button>
          <div className="sidebar-version">
            GUITAR COMPOSER STUDIO <span>v0.3</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{view === 'studio' ? workspaceTitle : 'Bibliotecă'}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`save-status ${storageState}`} role="status">
              {storageState === 'saving' ? (
                <LoaderCircle size={13} className="spin" />
              ) : storageState === 'saved' ? (
                <Check size={13} />
              ) : (
                <Activity size={13} />
              )}
              {storageState === 'saving'
                ? 'Se salvează…'
                : storageState === 'saved'
                  ? 'Salvat local'
                  : 'Salvare eșuată — exportă'}
            </span>
            <span className="avatar" aria-label="Workspace personal">
              GC
            </span>
          </div>
        </header>
        <main id="studio">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> ATELIERUL TĂU DE COMPOZIȚIE
              </div>
              <h1>
                {view === 'studio' ? workspaceTitle : 'Biblioteca mea'}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === 'studio'
                  ? workspaceTab === 'audio'
                    ? 'Înregistrează chitara și construiește un aranjament audio local.'
                    : workspaceTab === 'ai'
                      ? 'Explorează idei cu un model local. Tu alegi ce intră în proiect.'
                      : workspaceTab === 'solo'
                        ? 'Transformă armonia într-o melodie. Compune, ascultă și rafinează.'
                        : workspaceTab === 'backing'
                          ? 'Adaugă ritm și bas. Echilibrează mixul și exportă ideea completă.'
                          : 'Explorează acorduri. Găsește conexiuni. Dă formă următoarei idei.'
                  : 'Un loc pentru fiecare idee, de la prima schiță la ultima versiune.'}
              </p>
            </div>
            <button className="button dark" onClick={createProject} disabled={!loaded || mediaBusy}>
              <Plus size={17} /> Proiect nou
            </button>
          </div>
          {view === 'library' ? (
            <>
              <div className="library-toolbar">
                <span>{projects.length} proiecte pe acest dispozitiv</span>
                <button className="button" onClick={() => fileInput.current?.click()}>
                  <Upload size={16} /> Importă proiect
                </button>
              </div>
              <div className="project-grid">
                {projects.map((p) => (
                  <article className="panel library-project" key={p.id}>
                    <div className="library-project-icon">
                      <FolderOpen size={24} />
                    </div>
                    <h2>{p.name}</h2>
                    <p>
                      {p.key.root} {p.key.mode} · {p.bpm} BPM · {p.chords.length} acorduri
                    </p>
                    <div className="library-chords">
                      {p.chords.slice(0, 5).map((c) => (
                        <span key={c.id}>{buildChord(c).symbol}</span>
                      ))}
                    </div>
                    <small>{formatDate(p.updatedAt)}</small>
                    <div className="library-project-actions">
                      <button
                        className="button"
                        onClick={() => {
                          setProject(p);
                          setSelectedId('');
                          setView('studio');
                        }}
                      >
                        Deschide <ArrowRight size={15} />
                      </button>
                      <IconButton
                        label={`Șterge proiectul ${p.name}`}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Ștergi definitiv „${p.name}”? Exportă o copie dacă vrei să-l păstrezi.`,
                            )
                          )
                            return;
                          try {
                            const cleaned = await deleteProject(p.id);
                            if (!cleaned)
                              setNotice(
                                'Proiect șters. Unele surse media nu au putut fi curățate din browser.',
                              );
                            setProjects(await listProjects());
                            if (p.id === project.id) setProject(newProject(false));
                          } catch {
                            setNotice('Ștergerea a eșuat.');
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <section className="project-bar" aria-label="Setări proiect">
                <div className="project-name">
                  <span className="project-icon">
                    <Music2 size={19} />
                  </span>
                  <div>
                    <label htmlFor="project-name">PROIECT CURENT</label>
                    <input
                      id="project-name"
                      aria-label="Nume proiect"
                      value={project.name}
                      maxLength={100}
                      disabled={changesDisabled}
                      onChange={(e) =>
                        update((p) => ({ ...p, name: e.target.value || 'Proiect fără titlu' }))
                      }
                    />
                  </div>
                  <ChevronDown size={15} />
                </div>
                <div className="project-actions">
                  <button
                    className="text-button"
                    aria-label="Istoric"
                    onClick={() => setModal('history')}
                    disabled={!loaded}
                  >
                    <History size={16} />
                    <span>Istoric</span>
                    {project.revisions.length > 0 && <small>{project.revisions.length}</small>}
                  </button>
                  <button className="text-button" onClick={snapshot} disabled={changesDisabled}>
                    <Save size={16} />
                    <span>Salvează versiune</span>
                  </button>
                  <button
                    className="text-button"
                    disabled={mediaBusy || exporting}
                    onClick={() => void exportProject()}
                  >
                    <Download size={16} />
                    <span>Exportă</span>
                  </button>
                  <IconButton
                    label="Importă proiect"
                    onClick={() => fileInput.current?.click()}
                    disabled={changesDisabled}
                  >
                    <Upload size={17} />
                  </IconButton>
                </div>
              </section>
              <div className="workspace-tabs" role="group" aria-label="Module proiect">
                <button
                  className={workspaceTab === 'harmony' ? 'current' : ''}
                  aria-pressed={workspaceTab === 'harmony'}
                  onClick={() => setWorkspaceTab('harmony')}
                  disabled={mediaBusy}
                >
                  <Layers3 size={16} />
                  Harmony
                </button>
                <button
                  className={workspaceTab === 'solo' ? 'current' : ''}
                  aria-pressed={workspaceTab === 'solo'}
                  onClick={() => setWorkspaceTab('solo')}
                  disabled={mediaBusy}
                >
                  <Music2 size={16} />
                  Melodie
                </button>
                <button
                  className={workspaceTab === 'backing' ? 'current' : ''}
                  aria-pressed={workspaceTab === 'backing'}
                  onClick={() => setWorkspaceTab('backing')}
                  disabled={mediaBusy}
                >
                  <Waves size={16} />
                  Backing & export
                </button>
                <button
                  className={workspaceTab === 'audio' ? 'current' : ''}
                  aria-pressed={workspaceTab === 'audio'}
                  disabled={mediaBusy}
                  onClick={() => setWorkspaceTab('audio')}
                >
                  <Mic2 size={16} />
                  Audio
                </button>
                <button
                  className={workspaceTab === 'ai' ? 'current' : ''}
                  aria-pressed={workspaceTab === 'ai'}
                  disabled={mediaBusy}
                  onClick={() => setWorkspaceTab('ai')}
                >
                  <Sparkles size={16} />
                  AI
                </button>
              </div>
              {workspaceTab === 'harmony' ? (
                <div className="studio-grid">
                  <div className="primary-column">
                    <section className="panel progression-panel">
                      <div className="panel-header">
                        <div className="section-title">
                          <span className="section-icon">
                            <ListMusic size={18} />
                          </span>
                          <h2>Progresia ta</h2>
                          <span className="subtle-badge">{project.chords.length} acorduri</span>
                        </div>
                        <div className="key-picker">
                          <label htmlFor="key-root">Tonalitate</label>
                          <select
                            id="key-root"
                            value={project.key.root}
                            disabled={changesDisabled}
                            onChange={(e) =>
                              update((p) => ({ ...p, key: { ...p.key, root: e.target.value } }))
                            }
                          >
                            {ROOTS.map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                          <select
                            aria-label="Mod tonalitate"
                            value={project.key.mode}
                            disabled={changesDisabled}
                            onChange={(e) =>
                              update((p) => ({
                                ...p,
                                key: { ...p.key, mode: e.target.value as 'major' | 'minor' },
                              }))
                            }
                          >
                            <option value="major">Major</option>
                            <option value="minor">Minor</option>
                          </select>
                        </div>
                      </div>
                      <div
                        className="chord-strip"
                        tabIndex={0}
                        role="group"
                        aria-label="Acorduri în progresie, derulare orizontală"
                      >
                        {project.chords.map((chord, i) => {
                          const a = analyze(chord, project.key);
                          return (
                            <button
                              type="button"
                              key={chord.id}
                              className={`chord-card ${selected?.id === chord.id ? 'selected' : ''} ${activeIndex === i ? 'is-playing' : ''}`}
                              onClick={() => setSelectedId(chord.id)}
                              aria-pressed={selected?.id === chord.id}
                            >
                              <div className="chord-card-top">
                                <span>
                                  {chord.section || 'A'}
                                  <span className="card-number">
                                    {String(i + 1).padStart(2, '0')}
                                  </span>
                                </span>
                                <span>{a.roman}</span>
                              </div>
                              <strong>{buildChord(chord).symbol}</strong>
                              <div className="chord-card-bottom">
                                <span>{chord.beats} timpi</span>
                                <span
                                  className={`function-dot ${a.diatonic ? 'diatonic' : 'chromatic'}`}
                                />
                              </div>
                              <span className="card-bottom-line" />
                            </button>
                          );
                        })}
                        <button
                          className="add-chord"
                          onClick={() => setModal('add')}
                          disabled={changesDisabled || project.chords.length >= 128}
                        >
                          <Plus size={23} />
                          <span>
                            Adaugă
                            <br />
                            acord
                          </span>
                        </button>
                      </div>
                      <div className="progression-footer">
                        <span>
                          <span className="legend-dot green" /> Diatonic în tonalitate
                        </span>
                        <span>
                          <span className="legend-dot amber" /> Cromatic / împrumutat
                        </span>
                        <span className="duration">
                          4/4 ·{' '}
                          {(totalBeats / 4) % 1 ? (totalBeats / 4).toFixed(2) : totalBeats / 4}{' '}
                          măsuri · {Math.floor(seconds / 60)}:
                          {String(seconds % 60).padStart(2, '0')}
                        </span>
                      </div>
                      {transport}
                    </section>
                    {selected && built ? (
                      <section className="panel chord-editor">
                        <div className="panel-header">
                          <div className="section-title">
                            <span className="section-icon">
                              <Settings2 size={18} />
                            </span>
                            <h2>Detaliile acordului</h2>
                          </div>
                          <div className="editor-actions">
                            <IconButton
                              label="Mută acordul la stânga"
                              onClick={() => moveChord(-1)}
                              disabled={changesDisabled || selectedIndex === 0}
                            >
                              <ArrowLeft size={16} />
                            </IconButton>
                            <IconButton
                              label="Mută acordul la dreapta"
                              onClick={() => moveChord(1)}
                              disabled={
                                changesDisabled || selectedIndex === project.chords.length - 1
                              }
                            >
                              <ArrowRight size={16} />
                            </IconButton>
                            <IconButton
                              label="Duplică acordul"
                              onClick={() => addChord(selected)}
                              disabled={changesDisabled || project.chords.length >= 128}
                            >
                              <Copy size={16} />
                            </IconButton>
                            <IconButton
                              label="Șterge acordul"
                              onClick={() => {
                                update((p) => ({
                                  ...p,
                                  chords: p.chords.filter((c) => c.id !== selected.id),
                                }));
                                setSelectedId('');
                              }}
                              disabled={changesDisabled}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </div>
                        <div className="chord-editor-body">
                          <div className="selected-chord">
                            <span className="mini-label">ACORD SELECTAT</span>
                            <strong>{built.symbol}</strong>
                            <button
                              className="text-button audition"
                              onClick={() => preview(built.midi)}
                              disabled={playing}
                            >
                              <Volume2 size={14} /> Ascultă acordul
                            </button>
                          </div>
                          <div className="editor-fields">
                            <label>
                              Fundamentală
                              <select
                                aria-label="Fundamentală"
                                value={selected.root}
                                disabled={changesDisabled}
                                onChange={(e) => updateChord({ root: e.target.value })}
                              >
                                {ROOTS.map((n) => (
                                  <option key={n}>{n}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Tip acord
                              <select
                                aria-label="Tip acord"
                                value={selected.quality}
                                disabled={changesDisabled}
                                onChange={(e) =>
                                  updateChord({ quality: e.target.value as Quality, inversion: 0 })
                                }
                              >
                                {QUALITIES.map((q) => (
                                  <option value={q.suffix} key={q.suffix}>
                                    {q.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Inversiune
                              <select
                                aria-label="Inversiune"
                                value={selected.inversion}
                                disabled={changesDisabled}
                                onChange={(e) => updateChord({ inversion: Number(e.target.value) })}
                              >
                                {built.notes.map((_, i) => (
                                  <option key={i} value={i}>
                                    {i === 0 ? 'Poziție fundamentală' : `Inversiunea ${i}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Durată
                              <select
                                aria-label="Durată"
                                value={selected.beats}
                                disabled={changesDisabled}
                                onChange={(e) => updateChord({ beats: Number(e.target.value) })}
                              >
                                {Array.from({ length: 16 }, (_, i) => (
                                  <option key={i} value={i + 1}>
                                    {i + 1} {i === 0 ? 'timp' : 'timpi'}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Secțiune
                              <input
                                aria-label="Secțiune"
                                value={selected.section}
                                maxLength={24}
                                disabled={changesDisabled}
                                onChange={(e) => updateChord({ section: e.target.value })}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="chord-notes">
                          <span>NOTELE ACORDULUI</span>
                          {built.notes.map((n) => (
                            <span className="note-pill" key={n}>
                              {n}
                            </span>
                          ))}
                          <span className="formula">
                            {QUALITIES.find((q) => q.suffix === selected.quality)?.formula}
                          </span>
                        </div>
                      </section>
                    ) : (
                      <div className="panel empty-state">
                        <Music2 size={30} />
                        <h2>Prima idee începe cu un acord.</h2>
                        <p>Adaugă un acord pentru a explora armonia și pozițiile pe chitară.</p>
                        <button
                          className="button dark"
                          onClick={() => setModal('add')}
                          disabled={!loaded}
                        >
                          <Plus size={16} /> Adaugă acord
                        </button>
                      </div>
                    )}
                    {selected && (
                      <section className="panel fretboard-panel" id="fretboard">
                        <div className="panel-header">
                          <div className="section-title">
                            <span className="section-icon">
                              <Guitar size={19} />
                            </span>
                            <h2>Pe griful chitarei</h2>
                          </div>
                          <span className="subtle-badge">E A D G B E</span>
                        </div>
                        <div className="fretboard-toolbar">
                          <span>
                            <strong>{selectedSymbol}</strong>{' '}
                            <span className="muted">/ acordaj standard</span>
                          </span>
                          <label className="switch-label">
                            <input
                              type="checkbox"
                              checked={scaleVisible}
                              onChange={(e) => setScaleVisible(e.target.checked)}
                            />{' '}
                            Arată gama
                          </label>
                        </div>
                        <Fretboard
                          chord={selected}
                          voicing={showVoicing ? voicing : undefined}
                          scaleNotes={scaleVisible ? keyNotes(project.key) : []}
                          onNote={(midi) => {
                            if (!playing) preview([midi]);
                          }}
                        />
                        <div className="fretboard-legend">
                          <span>
                            <i className="legend-dot lime" /> Fundamentală
                          </span>
                          <span>
                            <i className="legend-dot note" /> Notă din acord
                          </span>
                          <span>
                            <i className="legend-ring" /> Poziție selectată
                          </span>
                          <span className="fret-hint">Atinge o notă pentru a o asculta</span>
                        </div>
                        <div className="voicing-controls">
                          <div>
                            <span className="mini-label">VOICE LEADING</span>
                            <p>
                              {previous
                                ? 'Poziții ordonate după deplasarea față de acordul anterior.'
                                : 'Poziții ordonate după întindere și registru.'}
                            </p>
                          </div>
                          {voicing ? (
                            <div className="voicing-choice">
                              <label className="voicing-toggle">
                                <input
                                  type="checkbox"
                                  checked={showVoicing}
                                  onChange={(e) => setShowVoicing(e.target.checked)}
                                />
                                Poziție
                              </label>
                              <IconButton
                                label="Poziția anterioară"
                                onClick={() => setVoicingIndex((i) => Math.max(0, i - 1))}
                                disabled={voicingIndex === 0}
                              >
                                <ArrowLeft size={15} />
                              </IconButton>
                              <span>
                                {voicingIndex + 1}/{voicings.length}
                              </span>
                              <IconButton
                                label="Poziția următoare"
                                onClick={() =>
                                  setVoicingIndex((i) => Math.min(voicings.length - 1, i + 1))
                                }
                                disabled={voicingIndex >= voicings.length - 1}
                              >
                                <ArrowRight size={15} />
                              </IconButton>
                              <button
                                className="button compact"
                                disabled={playing}
                                onClick={() => preview(voicingMidi(voicing))}
                              >
                                <Volume2 size={15} />
                                <span>{voicing.map((f) => (f === null ? '×' : f)).join(' ')}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="muted">Nicio poziție în limitele curente.</span>
                          )}
                        </div>
                        <p className="voicing-disclaimer">
                          Sugestii geometrice, tastele 0–12; digitarea și confortul trebuie
                          verificate pe instrument.
                        </p>
                      </section>
                    )}
                  </div>
                  <aside className="insight-column" aria-label="Analiză și recomandări">
                    <section className="panel analysis-panel">
                      <div className="panel-header">
                        <div className="section-title">
                          <span className="section-icon">
                            <BookOpen size={18} />
                          </span>
                          <h2>Înțelege armonia</h2>
                        </div>
                      </div>
                      {analysis && selected ? (
                        <div className="insight-body">
                          <div className="analysis-key">
                            <span>
                              ÎN {project.key.root}{' '}
                              {project.key.mode === 'major' ? 'MAJOR' : 'MINOR'}
                            </span>
                            <span className="tiny-dot" />
                          </div>
                          <div className="function-display">
                            <strong>{analysis.roman}</strong>
                            <span
                              className={
                                analysis.diatonic ? 'function-badge' : 'function-badge borrowed'
                              }
                            >
                              {analysis.function}
                            </span>
                          </div>
                          <p>{analysis.explanation}</p>
                          <div className="analysis-sequence">
                            {project.chords.map((c, i) => (
                              <span key={c.id} className={i === selectedIndex ? 'current' : ''}>
                                {i > 0 && <span className="sequence-arrow">→</span>}
                                {analyze(c, project.key).roman}
                              </span>
                            ))}
                          </div>
                          <div className="insight-footnote">
                            <CircleHelp size={14} />
                            <span>
                              Analiză bazată pe reguli, fără AI. Contextul muzical poate schimba
                              funcția.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="insight-body muted">
                          Selectează un acord pentru analiză.
                        </div>
                      )}
                    </section>
                    <section className="panel scales-panel">
                      <div className="panel-header">
                        <div className="section-title">
                          <span className="section-icon">
                            <Waves size={18} />
                          </span>
                          <h2>Game de explorat</h2>
                        </div>
                        <span className="subtle-badge">{scales.length}</span>
                      </div>
                      <div className="insight-body">
                        <p className="intro-text">
                          Puncte de plecare pentru improvizație pe{' '}
                          {selectedSymbol || 'acordul selectat'}.
                        </p>
                        {scales.map((scale, i) => (
                          <div className="scale-suggestion" key={scale.name}>
                            <div>
                              <strong>{scale.name}</strong>
                              {i === 0 && <span className="recommended">POTRIVIRE</span>}
                            </div>
                            <p>{scale.notes.join(' · ')}</p>
                            <small>{scale.reason}</small>
                          </div>
                        ))}
                        {!scales.length && (
                          <p className="muted">Nu există sugestii pentru selecția curentă.</p>
                        )}
                      </div>
                    </section>
                    <section className="panel substitutions-panel">
                      <div className="panel-header">
                        <div className="section-title">
                          <span className="section-icon">
                            <Sparkles size={17} />
                          </span>
                          <h2>O altă culoare</h2>
                        </div>
                      </div>
                      <div className="insight-body">
                        <p className="intro-text">
                          Încearcă o alternativă. Ascultă schimbarea în context.
                        </p>
                        {selected &&
                          substitutions(selected).map((s) => (
                            <div className="substitution" key={s.chord.root + s.chord.quality}>
                              <div>
                                <strong>{buildChord(s.chord).symbol}</strong>
                                <div>
                                  <IconButton
                                    label={`Ascultă alternativa ${buildChord(s.chord).symbol}`}
                                    disabled={playing}
                                    onClick={() => preview(buildChord(s.chord).midi)}
                                  >
                                    <Volume2 size={15} />
                                  </IconButton>
                                  <IconButton
                                    label={`Aplică alternativa ${buildChord(s.chord).symbol}`}
                                    disabled={changesDisabled}
                                    onClick={() => updateChord(s.chord)}
                                  >
                                    <ArrowUp size={16} />
                                  </IconButton>
                                </div>
                              </div>
                              <p>{s.reason}</p>
                            </div>
                          ))}
                        {selected && !substitutions(selected).length && (
                          <p className="muted">Explorează inversiunile acestui acord în editor.</p>
                        )}
                      </div>
                    </section>
                    <div className="studio-note">
                      <span>✦</span>
                      <p>
                        Lasă urechea să decidă.
                        <br />
                        <strong>Teoria îți arată posibilitățile.</strong>
                      </p>
                    </div>
                  </aside>
                </div>
              ) : (
                <>
                  <section className="panel shared-transport" aria-label="Transport compoziție">
                    {transport}
                  </section>
                  {workspaceTab === 'audio' ? (
                    <AudioStudio
                      key={project.id}
                      project={project}
                      disabled={playing || !loaded || exporting}
                      playing={playing}
                      cursor={audioCursor}
                      onCursor={setAudioCursor}
                      onChange={changeAudio}
                      onBusy={setMediaBusy}
                      onError={setNotice}
                      onRecordStart={() => beginPlayback(cursorRef.current, false)}
                      onRecordStop={stop}
                      onExport={() => void exportProject(true)}
                      onWav={() => void exportAudio('wav')}
                    />
                  ) : workspaceTab === 'ai' ? (
                    <AiAssistant
                      key={project.id}
                      project={project}
                      disabled={changesDisabled}
                      onApply={applyAi}
                      onError={setNotice}
                    />
                  ) : workspaceTab === 'solo' ? (
                    <SoloComposer
                      key={project.id}
                      project={project}
                      disabled={changesDisabled}
                      onChange={changeMelody}
                      onPreview={preview}
                    />
                  ) : (
                    <BackingStudio
                      project={project}
                      disabled={changesDisabled}
                      exporting={exporting}
                      onChange={(backing) => update((p) => ({ ...p, backing }))}
                      onMidi={() => exportAudio('midi')}
                      onWav={() => exportAudio('wav')}
                    />
                  )}
                </>
              )}
              <footer className="workspace-footer">
                <span>
                  <span className="status-dot" /> Teorie deterministă · Proiecte locale · AI
                  opțional
                </span>
                <span>Creat pentru momentele în care vrei să compui.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <input
        type="file"
        ref={fileInput}
        hidden
        accept=".json,.gcs.json,.gcsbundle,application/json,application/octet-stream"
        onChange={importFile}
      />
      {notice && (
        <div className="toast" role="status">
          <CircleHelp size={18} />
          <span>{notice}</span>
          <IconButton label="Închide notificarea" onClick={() => setNotice('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {modal === 'add' && (
        <Modal title="Un nou acord, o nouă direcție" onClose={() => setModal(null)}>
          <p className="modal-description">Construiește un acord sau identifică unul după note.</p>
          <div className="add-form">
            <label>
              Fundamentală
              <select
                aria-label="Fundamentală"
                value={root}
                onChange={(e) => setRoot(e.target.value)}
              >
                {ROOTS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Tip acord
              <select
                aria-label="Tip acord"
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
              >
                {QUALITIES.map((q) => (
                  <option value={q.suffix} key={q.suffix}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="chord-preview">
            <strong>
              {root}
              {quality}
            </strong>
            <span>{buildChord({ root, quality, inversion: 0 }).notes.join(' · ')}</span>
            <IconButton
              label="Ascultă noul acord"
              onClick={() => preview(buildChord({ root, quality, inversion: 0 }).midi)}
              disabled={playing}
            >
              <Volume2 size={21} />
            </IconButton>
          </div>
          <button
            className="button dark full-width"
            onClick={() => addChord({ root, quality, inversion: 0 })}
            disabled={changesDisabled}
          >
            <Plus size={17} /> Adaugă în progresie
          </button>
          <div className="identify-section">
            <h3>Ai deja notele?</h3>
            <label>
              Note în notație internațională, cu basul primul
              <input
                placeholder="Ex.: C E G B"
                value={identify}
                onChange={(e) => setIdentify(e.target.value)}
              />
            </label>
            {identify.trim() && (
              <div className="identify-results" aria-live="polite">
                {identifyChord(identify).length ? (
                  identifyChord(identify).map((name) => (
                    <span className="note-pill" key={name}>
                      {name}
                    </span>
                  ))
                ) : (
                  <p>
                    Niciun acord identificat. Folosește note precum C, F#, Bb, separate prin spații.
                  </p>
                )}
              </div>
            )}
            <p className="muted small">
              Identificarea poate oferi mai multe interpretări; prima notă este tratată ca bas.
            </p>
          </div>
        </Modal>
      )}
      {modal === 'history' && (
        <Modal title="Istoricul proiectului" onClose={() => setModal(null)}>
          <p className="modal-description">
            Salvarea automată păstrează starea curentă. Versiunile manuale sunt puncte la care poți
            reveni (maximum 30).
          </p>
          {!project.revisions.length && (
            <p className="empty-history">
              Nu ai salvat încă o versiune. Folosește „Salvează versiune”.
            </p>
          )}
          {project.revisions.length > 0 && (
            <button
              className="button"
              disabled={changesDisabled}
              onClick={() => {
                if (
                  !window.confirm(
                    'Ștergi toate versiunile din istoricul acestui proiect? Starea curentă rămâne; revenirea la versiunile vechi nu va mai fi posibilă.',
                  )
                )
                  return;
                update((p) => {
                  const used = new Set(
                    p.audio.tracks.flatMap((t) => t.clips.map((c) => c.assetId)),
                  );
                  return {
                    ...p,
                    revisions: [],
                    audio: { ...p.audio, assets: p.audio.assets.filter((a) => used.has(a.id)) },
                  };
                });
              }}
            >
              <Trash2 size={14} />
              Golește istoricul
            </button>
          )}
          {[...project.revisions].reverse().map((r) => (
            <div className="history-item" key={r.id}>
              <div>
                <strong>{r.label}</strong>
                <span>
                  {formatDate(r.createdAt)} · {r.arrangement.chords.length} acorduri
                </span>
              </div>
              <button
                className="button compact"
                disabled={changesDisabled}
                onClick={() => {
                  update((p) => ({ ...addRevision(p), ...structuredClone(r.arrangement) }));
                  setSelectedId('');
                  setModal(null);
                  setNotice('Versiune restaurată. Starea anterioară a fost păstrată în istoric.');
                }}
              >
                Restaurează
              </button>
            </div>
          ))}
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Bine ai venit în studio" onClose={() => setModal(null)}>
          <div className="help-content">
            <p>
              Începe cu progresia demonstrativă sau creează un proiect nou. Selectează un acord
              pentru a-i schimba tipul, inversiunea și durata.
            </p>
            <h3>Explorează, apoi ascultă</h3>
            <p>
              Analiza folosește tonalitatea aleasă explicit. Gamele includ notele acordului, dar nu
              garantează că fiecare tensiune se potrivește întregii progresii. Substituțiile sunt
              propuneri muzicale.
            </p>
            <h3>Grif și voice leading</h3>
            <p>
              Griful arată toate notele acordului. Cercurile conturate indică o poziție sugerată,
              iar butoanele săgeată schimbă poziția. × înseamnă coardă mută. Pozițiile sunt
              euristice, fără garanție de digitare fizică.
            </p>
            <h3>Proiectele îți aparțin</h3>
            <p>
              Salvare automată în IndexedDB, în acest browser. Exportă periodic proiectul; când
              conține audio sau conversații se folosește .gcsbundle, cu sursele incluse: ștergerea
              datelor browserului poate elimina proiectele. Importul creează o copie nouă. Poți
              transfera manual aceste fișiere pe iPhone.
            </p>
            <h3>Disponibil acum</h3>
            <p>
              Armonie, fretboard, editor melodic, acompaniament sintetizat, mixaj și export
              MIDI/WAV. Audio Studio oferă captură prin browser, clipuri și backup cu sursele
              incluse. Asistentul AI folosește Ollama local sau un API cloud opțional, cu propuneri
              validate înainte de aplicare. Accesul ASIO direct și pachetul Windows nativ necesită
              etapa desktop.
            </p>
            <h3>Offline pe iPhone</h3>
            <p>
              Deschide versiunea publicată prin HTTPS în Safari, apoi folosește „Adaugă pe ecranul
              principal”. După prima încărcare, interfața și teoria sunt disponibile offline.
              Inițierea redării necesită o atingere. Redarea se oprește când aplicația trece în
              fundal.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
