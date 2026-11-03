import { useEffect, useRef, useState } from 'react';
import { Download, Mic2, Plus, Scissors, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import type { Project } from '../core/project';
import { arrangementBeats } from '../core/composition';
import { splitClip, type AudioClip, type AudioSession, type AudioTrack } from '../core/studio';
import {
  BrowserRecorder,
  decodeAudio,
  inputDevices,
  type ImportedAudio,
} from '../services/recording';
import { getAsset, putAsset } from '../services/mediaStore';

function Waveform({ peaks }: { peaks: number[] }) {
  const values = peaks.length ? peaks : [0];
  const upper = values
    .map((v, i) => `${(i * 100) / Math.max(1, values.length - 1)},${20 - v * 18}`)
    .join(' ');
  const lower = [...values]
    .reverse()
    .map((v, i) => `${100 - (i * 100) / Math.max(1, values.length - 1)},${20 + v * 18}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={upper + ' ' + lower} />
    </svg>
  );
}
export default function AudioStudio({
  project,
  disabled,
  playing,
  cursor,
  onCursor,
  onChange,
  onBusy,
  onError,
  onRecordStart,
  onRecordStop,
  onExport,
  onWav,
}: {
  project: Project;
  disabled: boolean;
  playing: boolean;
  cursor: number;
  onCursor: (beat: number) => void;
  onChange: (audio: AudioSession, checkpoint?: boolean) => void;
  onBusy: (busy: boolean) => void;
  onError: (text: string) => void;
  onRecordStart: () => Promise<void>;
  onRecordStop: () => void;
  onExport: () => void;
  onWav: () => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(''),
    [channel, setChannel] = useState<'stereo' | '1' | '2'>('1');
  const [monitor, setMonitor] = useState(false),
    [backing, setBacking] = useState(true),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const [trackId, setTrackId] = useState(''),
    [clipId, setClipId] = useState(''),
    [zoom, setZoom] = useState(28),
    [captureInfo, setCaptureInfo] = useState('');
  const recorder = useRef(new BrowserRecorder()),
    file = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  const track = project.audio.tracks.find((t) => t.id === trackId) ?? project.audio.tracks[0];
  const clip = track?.clips.find((c) => c.id === clipId),
    asset = project.audio.assets.find((a) => a.id === clip?.assetId);
  const total = arrangementBeats(project),
    width = Math.max(600, Math.ceil(Math.max(16, total) / 4) * 4 * zoom);
  const locked = disabled || busy;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current.cancel();
      onBusy(false);
    };
  }, [onBusy]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(recorder.current.elapsed), 100);
    return () => clearInterval(timer);
  }, [recording]);
  function status(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  function report(error: unknown) {
    onError(error instanceof Error ? error.message : 'Operația audio a eșuat.');
  }
  function updateTrack(patch: Partial<AudioTrack>, checkpoint = false) {
    if (track)
      onChange(
        {
          ...project.audio,
          tracks: project.audio.tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)),
        },
        checkpoint,
      );
  }
  function updateClip(patch: Partial<AudioClip>) {
    if (!track || !clip || !asset) return;
    const next = { ...clip, ...patch };
    if (
      next.start < 0 ||
      next.start > 2048 ||
      next.trimStart < 0 ||
      next.trimEnd > asset.duration + 0.001 ||
      next.trimEnd - next.trimStart < 0.02
    )
      return;
    updateTrack({ clips: track.clips.map((c) => (c.id === clip.id ? next : c)) });
  }
  async function addSource(result: ImportedAudio, start: number, targetId?: string) {
    if (!mounted.current) return;
    if (project.audio.tracks.reduce((n, t) => n + t.clips.length, 0) >= 128)
      throw new Error('Limita este de 128 clipuri.');
    let target = project.audio.tracks.find((t) => t.id === targetId);
    if (!target && project.audio.tracks.length >= 16) throw new Error('Limita este de 16 piste.');
    await putAsset(project.id, result.asset.id, result.blob);
    const nextClip: AudioClip = {
      id: crypto.randomUUID(),
      assetId: result.asset.id,
      start,
      trimStart: 0,
      trimEnd: result.asset.duration,
      gain: 1,
    };
    if (!target)
      target = {
        id: crypto.randomUUID(),
        name: `Pista ${project.audio.tracks.length + 1}`,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        clips: [],
      };
    const existing = project.audio.tracks.some((t) => t.id === target!.id);
    const tracks = existing
      ? project.audio.tracks.map((t) =>
          t.id === target!.id ? { ...t, clips: [...t.clips, nextClip] } : t,
        )
      : [...project.audio.tracks, { ...target, clips: [nextClip] }];
    const used = new Set(tracks.flatMap((t) => t.clips.map((c) => c.assetId)));
    const assets = [...project.audio.assets.filter((a) => used.has(a.id)), result.asset];
    if (mounted.current) {
      onChange({ assets, tracks }, true);
      setTrackId(target.id);
      setClipId(nextClip.id);
    }
  }
  async function importAudio(input: File) {
    status(true);
    try {
      await addSource(await decodeAudio(input, input.name), cursor, track?.id);
    } catch (e) {
      report(e);
    } finally {
      if (mounted.current) status(false);
    }
  }
  async function startRecord() {
    status(true);
    const position = cursor,
      target = track?.id;
    try {
      const info = await recorder.current.start(device, channel, monitor);
      if (!mounted.current) {
        recorder.current.cancel();
        return;
      }
      setCaptureInfo(
        `${info.sampleRate} Hz · ${info.channels} canale expuse${info.echoCancellation ? ' · procesare browser activă' : ''}`,
      );
      const finished = recorder.current.finished();
      setRecording(true);
      setElapsed(0);
      if (backing)
        await onRecordStart().catch((e) => {
          onError(
            'Înregistrarea continuă fără acompaniament: ' +
              (e instanceof Error ? e.message : 'redare indisponibilă'),
          );
        });
      const result = await finished;
      onRecordStop();
      if (mounted.current) {
        setRecording(false);
        await addSource(result, position, target);
      }
    } catch (e) {
      recorder.current.cancel();
      onRecordStop();
      if (mounted.current) {
        setRecording(false);
        report(e);
      }
    } finally {
      if (mounted.current) status(false);
    }
  }
  function addTrack() {
    if (project.audio.tracks.length >= 16) return;
    const t: AudioTrack = {
      id: crypto.randomUUID(),
      name: `Pista ${project.audio.tracks.length + 1}`,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      clips: [],
    };
    onChange({ ...project.audio, tracks: [...project.audio.tracks, t] });
    setTrackId(t.id);
    setClipId('');
  }
  async function downloadSource() {
    if (!asset) return;
    try {
      const blob = await getAsset(project.id, asset.id),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = asset.name.replace(/[^\p{L}\p{N}_-]/gu, '-') + '.wav';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      report(e);
    }
  }
  return (
    <div className="audio-layout">
      <section className="panel audio-main">
        <div className="panel-header">
          <div className="section-title">
            <Mic2 size={18} />
            <h2>Audio Studio</h2>
            <span className="subtle-badge">{project.audio.tracks.length}/16 piste</span>
          </div>
          <div className="audio-actions">
            <button
              className="button compact"
              disabled={locked || project.audio.tracks.length >= 16}
              onClick={addTrack}
            >
              <Plus size={14} />
              Pistă nouă
            </button>
            <button
              className="button compact"
              disabled={locked}
              onClick={() => file.current?.click()}
            >
              <Upload size={14} />
              Importă audio
            </button>
          </div>
        </div>
        <div className="composer-intro">
          <h3>Înregistrează. Aranjează. Ascultă împreună.</h3>
          <p>
            Clipuri nedistructive, poziție în timpi, trim în secunde și mixaj separat. Sunetul
            original rămâne disponibil după tăiere.
          </p>
        </div>
        <div className="capture-panel">
          <div className="capture-fields">
            <label>
              Intrare audio
              <select
                aria-label="Dispozitiv înregistrare"
                value={device}
                disabled={locked}
                onChange={(e) => setDevice(e.target.value)}
              >
                <option value="">Dispozitivul implicit al sistemului</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Intrare audio'}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button compact"
              disabled={locked}
              onClick={async () => {
                status(true);
                try {
                  setDevices(await inputDevices());
                } catch (e) {
                  report(e);
                } finally {
                  if (mounted.current) status(false);
                }
              }}
            >
              Detectează intrări
            </button>
            <label>
              Canal
              <select
                aria-label="Canal înregistrare"
                value={channel}
                disabled={locked}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="1">Canal 1 · mono duplicat</option>
                <option value="2">Canal 2 · mono duplicat</option>
                <option value="stereo">Stereo · 1 și 2</option>
              </select>
            </label>
          </div>
          <div className="record-controls">
            <button
              className={recording ? 'record-button active' : 'record-button'}
              disabled={
                !recording &&
                (locked || project.audio.tracks.reduce((n, t) => n + t.clips.length, 0) >= 128)
              }
              onClick={() => (recording ? recorder.current.stop() : void startRecord())}
            >
              {recording ? (
                <Square size={16} fill="currentColor" />
              ) : (
                <span className="record-dot" />
              )}
              {recording ? 'Oprește înregistrarea' : 'Înregistrează'}
            </button>
            <span className="record-time">
              {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
            </span>
            <label className="switch-label">
              <input
                type="checkbox"
                aria-label="Acompaniament la înregistrare"
                checked={backing}
                disabled={locked}
                onChange={(e) => setBacking(e.target.checked)}
              />
              Cu redare de la cursor
            </label>
            <label className="switch-label">
              <input
                type="checkbox"
                aria-label="Monitorizare software"
                checked={monitor}
                onChange={(e) => {
                  setMonitor(e.target.checked);
                  recorder.current.setMonitor(e.target.checked);
                }}
              />
              Monitorizare în căști
            </label>
          </div>
          <p className="capture-note">
            {captureInfo ||
              'Permisiunea microfonului este cerută doar când detectezi intrări sau înregistrezi.'}{' '}
            · Maximum 3 minute per captură. Dacă interfața ta oferă direct monitoring, îl poți
            folosi; nu activa și monitorizarea software dacă auzi dublu.
          </p>
        </div>
        <div className="timeline-tools">
          <label>
            Cursor (timpi)
            <input
              type="number"
              aria-label="Cursor audio"
              min="0"
              max="2048"
              step="0.25"
              value={Math.round(cursor * 100) / 100}
              disabled={locked || playing}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0 && n <= 2048) onCursor(n);
              }}
            />
          </label>
          <label>
            Zoom
            <select
              aria-label="Zoom timeline"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              <option value={14}>Compact</option>
              <option value={28}>Normal</option>
              <option value={56}>Detaliat</option>
            </select>
          </label>
          <span>
            {Math.round((total * 60) / project.bpm)} secunde ·{' '}
            {project.audio.tracks.reduce((n, t) => n + t.clips.length, 0)} clipuri
          </span>
        </div>
        <div
          className="audio-timeline"
          tabIndex={0}
          role="group"
          aria-label="Timeline audio cu derulare"
        >
          <div className="audio-timeline-inner" style={{ width: 180 + width }}>
            <div className="audio-ruler">
              <span>PISTE / 4/4</span>
              <div style={{ width }}>
                {Array.from({ length: Math.ceil(width / zoom / 4) }, (_, i) => (
                  <button
                    key={i}
                    style={{ left: i * 4 * zoom }}
                    disabled={locked || playing}
                    aria-label={`Cursor la măsura ${i + 1}`}
                    onClick={() => onCursor(i * 4)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            {project.audio.tracks.map((t) => (
              <div
                className={`audio-track-row ${track?.id === t.id ? 'track-selected' : ''}`}
                key={t.id}
              >
                <button
                  className="audio-track-label"
                  onClick={() => {
                    setTrackId(t.id);
                    setClipId('');
                  }}
                >
                  <strong>{t.name}</strong>
                  <span>
                    {t.clips.length} clipuri {t.muted ? '· MUTE' : ''}
                    {t.solo ? ' · SOLO' : ''}
                  </span>
                </button>
                <div
                  className="audio-track-lane"
                  style={{ width, backgroundSize: `${zoom * 4}px 100%,${zoom}px 100%` }}
                >
                  {t.clips.map((c) => {
                    const a = project.audio.assets.find((a) => a.id === c.assetId)!;
                    const sliced = a.peaks.slice(
                      Math.floor((c.trimStart / a.duration) * a.peaks.length),
                      Math.max(1, Math.ceil((c.trimEnd / a.duration) * a.peaks.length)),
                    );
                    return (
                      <button
                        key={c.id}
                        className={`audio-clip ${clip?.id === c.id ? 'clip-selected' : ''}`}
                        style={{
                          left: c.start * zoom,
                          width: Math.max(
                            12,
                            (((c.trimEnd - c.trimStart) * project.bpm) / 60) * zoom,
                          ),
                        }}
                        aria-label={`Clip ${a.name} pe ${t.name}`}
                        onClick={() => {
                          setTrackId(t.id);
                          setClipId(c.id);
                        }}
                      >
                        <span>{a.name}</span>
                        <Waveform peaks={sliced} />
                      </button>
                    );
                  })}
                  <i className="audio-playhead" style={{ left: cursor * zoom }} />
                </div>
              </div>
            ))}
            {!project.audio.tracks.length && (
              <div className="audio-empty">
                Importă o sursă audio sau înregistrează prima pistă.
              </div>
            )}
          </div>
        </div>
        <p className="mixer-help">
          Redarea de sus pornește de la cursor în Audio Studio. Tempo-ul mută grila și pozițiile în
          timpi; audio nu este time-stretched. Alinierea înregistrării prin browser este
          aproximativă și poate fi ajustată din poziție/trim.
        </p>
      </section>
      <aside className="composer-side">
        <section className="panel">
          <div className="panel-header">
            <h2>{track ? 'Mixaj · ' + track.name : 'Selectează o pistă'}</h2>
          </div>
          <div className="note-properties">
            {track ? (
              <>
                <label>
                  Nume pistă
                  <input
                    aria-label="Nume pistă audio"
                    maxLength={80}
                    value={track.name}
                    disabled={locked}
                    onChange={(e) => {
                      if (e.target.value.trim()) updateTrack({ name: e.target.value });
                    }}
                  />
                </label>
                <label>
                  Volum
                  <input
                    aria-label="Volum pistă audio"
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume * 100}
                    disabled={locked}
                    onChange={(e) => updateTrack({ volume: Number(e.target.value) / 100 })}
                  />
                </label>
                <label>
                  Panoramare
                  <input
                    aria-label="Panoramare pistă"
                    type="range"
                    min="-100"
                    max="100"
                    value={track.pan * 100}
                    disabled={locked}
                    onChange={(e) => updateTrack({ pan: Number(e.target.value) / 100 })}
                  />
                </label>
                <div className="mix-buttons">
                  <button
                    aria-label="Mute pistă audio"
                    aria-pressed={track.muted}
                    className={track.muted ? 'pressed' : ''}
                    disabled={locked}
                    onClick={() => updateTrack({ muted: !track.muted })}
                  >
                    M
                  </button>
                  <button
                    aria-label="Solo pistă audio"
                    aria-pressed={track.solo}
                    className={track.solo ? 'pressed solo' : ''}
                    disabled={locked}
                    onClick={() => updateTrack({ solo: !track.solo })}
                  >
                    S
                  </button>
                </div>
                <button
                  className="button"
                  disabled={locked}
                  onClick={() => {
                    onChange(
                      {
                        ...project.audio,
                        tracks: project.audio.tracks.filter((t) => t.id !== track.id),
                      },
                      true,
                    );
                    setTrackId('');
                    setClipId('');
                  }}
                >
                  <Trash2 size={14} />
                  Șterge pista
                </button>
              </>
            ) : (
              <p>Alege o pistă din timeline sau adaugă una.</p>
            )}
          </div>
        </section>
        {clip && asset && (
          <section className="panel">
            <div className="panel-header">
              <h2>Editează clipul</h2>
            </div>
            <div className="note-properties">
              <p>
                {asset.name}
                <br />
                {asset.duration.toFixed(2)} sec · {asset.sampleRate} Hz · {asset.channels} canale
              </p>
              <label>
                Poziție în timpi
                <input
                  aria-label="Poziție clip"
                  type="number"
                  min="0"
                  max="2048"
                  step="0.25"
                  disabled={locked}
                  value={clip.start}
                  onChange={(e) => updateClip({ start: Number(e.target.value) })}
                />
              </label>
              <label>
                Trim început (secunde)
                <input
                  aria-label="Trim început"
                  type="number"
                  min="0"
                  max={clip.trimEnd - 0.02}
                  step="0.01"
                  disabled={locked}
                  value={clip.trimStart}
                  onChange={(e) => updateClip({ trimStart: Number(e.target.value) })}
                />
              </label>
              <label>
                Trim sfârșit (secunde)
                <input
                  aria-label="Trim sfârșit"
                  type="number"
                  min={clip.trimStart + 0.02}
                  max={asset.duration}
                  step="0.01"
                  disabled={locked}
                  value={clip.trimEnd}
                  onChange={(e) => updateClip({ trimEnd: Number(e.target.value) })}
                />
              </label>
              <label>
                Gain clip
                <input
                  aria-label="Gain clip"
                  type="range"
                  min="0"
                  max="200"
                  disabled={locked}
                  value={clip.gain * 100}
                  onChange={(e) => updateClip({ gain: Number(e.target.value) / 100 })}
                />
              </label>
              <button
                className="button"
                disabled={locked}
                onClick={() => {
                  try {
                    const pair = splitClip(clip, cursor, project.bpm, crypto.randomUUID());
                    updateTrack(
                      { clips: track.clips.flatMap((c) => (c.id === clip.id ? pair : [c])) },
                      true,
                    );
                  } catch (e) {
                    report(e);
                  }
                }}
              >
                <Scissors size={15} />
                Taie la cursor
              </button>
              <button
                className="button"
                disabled={
                  locked || project.audio.tracks.reduce((n, t) => n + t.clips.length, 0) >= 128
                }
                onClick={() =>
                  updateTrack(
                    {
                      clips: [
                        ...track.clips,
                        {
                          ...clip,
                          id: crypto.randomUUID(),
                          start: clip.start + ((clip.trimEnd - clip.trimStart) * project.bpm) / 60,
                        },
                      ],
                    },
                    true,
                  )
                }
              >
                <Plus size={15} />
                Duplică după clip
              </button>
              <button
                className="button"
                disabled={locked}
                onClick={() => {
                  updateTrack({ clips: track.clips.filter((c) => c.id !== clip.id) }, true);
                  setClipId('');
                }}
              >
                <Trash2 size={15} />
                Șterge clipul
              </button>
              <button className="button" disabled={locked} onClick={downloadSource}>
                <Download size={15} />
                Descarcă sursa WAV
              </button>
            </div>
          </section>
        )}
        <section className="panel">
          <div className="panel-header">
            <div className="section-title">
              <Volume2 size={17} />
              <h2>Salvare și export</h2>
            </div>
          </div>
          <div className="note-properties">
            <button className="button dark" disabled={locked} onClick={onExport}>
              <Download size={15} />
              Backup complet .gcsbundle
            </button>
            <button className="button" disabled={locked || !total} onClick={onWav}>
              <Download size={15} />
              Exportă mix WAV
            </button>
            <p>
              Backup-ul include proiectul, istoricul, conversația AI și sursele audio. Salvarea
              automată este locală; MIDI nu poate conține înregistrările.
            </p>
            <small>
              Browserul folosește intrările expuse de sistemul de operare, nu ASIO direct. Funcțiile
              și nivelurile native trebuie verificate pe interfața reală.
            </small>
          </div>
        </section>
      </aside>
      <input
        ref={file}
        type="file"
        hidden
        accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.flac"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = '';
          if (selected) void importAudio(selected);
        }}
      />
    </div>
  );
}
