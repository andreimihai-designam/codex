import { Download, Layers3, Waves } from 'lucide-react';
import {
  arrangementBeats,
  CHANNELS,
  channelGain,
  compositionEvents,
  type BackingSettings,
  type Channel,
} from '../core/composition';
import type { Project } from '../core/project';
const LABELS: Record<Channel, string> = {
  harmony: 'Armonie',
  melody: 'Melodie',
  bass: 'Bas',
  drums: 'Tobe',
};
export default function BackingStudio({
  project,
  disabled,
  exporting,
  onChange,
  onMidi,
  onWav,
}: {
  project: Project;
  disabled: boolean;
  exporting: boolean;
  onChange: (settings: BackingSettings) => void;
  onMidi: () => void;
  onWav: () => void;
}) {
  const beats = arrangementBeats(project);
  const duration = (beats * 60) / project.bpm;
  const events = compositionEvents(project);
  const setMix = (channel: Channel, patch: Partial<BackingSettings['mix'][Channel]>) =>
    onChange({
      ...project.backing,
      mix: { ...project.backing.mix, [channel]: { ...project.backing.mix[channel], ...patch } },
    });
  return (
    <div className="composition-layout">
      <section className="panel backing-panel">
        <div className="panel-header">
          <div className="section-title">
            <Layers3 size={18} />
            <h2>Backing Track Generator</h2>
          </div>
          <span className="subtle-badge">Sinteză locală</span>
        </div>
        <div className="composer-intro">
          <h3>Un ritm pentru ideea ta.</h3>
          <p>
            Basul urmărește fundamentala și cvinta acordurilor. Tobe sintetizate, trei groove-uri și
            mixaj separat pentru fiecare parte.
          </p>
        </div>
        <div className="backing-settings">
          <label className="backing-enable">
            <input
              type="checkbox"
              aria-label="Activează acompaniamentul"
              checked={project.backing.enabled}
              disabled={disabled}
              onChange={(e) => onChange({ ...project.backing, enabled: e.target.checked })}
            />
            Activează bas și tobe
          </label>
          <label>
            Groove
            <select
              aria-label="Stil acompaniament"
              disabled={disabled}
              value={project.backing.style}
              onChange={(e) =>
                onChange({ ...project.backing, style: e.target.value as BackingSettings['style'] })
              }
            >
              <option value="rock">Rock · optimi drepte</option>
              <option value="ballad">Ballad · aerisit</option>
              <option value="shuffle">Shuffle · optimi ternare</option>
            </select>
          </label>
        </div>
        <div className="mixer">
          {CHANNELS.map((channel) => {
            const mix = project.backing.mix[channel];
            const active =
              channelGain(project.backing, channel) > 0 &&
              (project.backing.enabled || channel === 'harmony' || channel === 'melody');
            return (
              <div className={`mixer-strip ${active ? 'audible' : ''}`} key={channel}>
                <div className="mixer-title">
                  <span className="legend-dot green" />
                  <strong>{LABELS[channel]}</strong>
                </div>
                <div className="mixer-meter" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={active && i / 10 < mix.volume ? 'filled' : ''} />
                  ))}
                </div>
                <span className="mixer-value">{Math.round(mix.volume * 100)}%</span>
                <input
                  aria-label={`Volum ${LABELS[channel]}`}
                  type="range"
                  min="0"
                  max="100"
                  disabled={disabled}
                  value={mix.volume * 100}
                  onChange={(e) => setMix(channel, { volume: Number(e.target.value) / 100 })}
                />
                <div className="mix-buttons">
                  <button
                    className={mix.muted ? 'pressed' : ''}
                    aria-label={`Mute ${LABELS[channel]}`}
                    aria-pressed={mix.muted}
                    disabled={disabled}
                    onClick={() => setMix(channel, { muted: !mix.muted })}
                  >
                    M
                  </button>
                  <button
                    className={mix.solo ? 'pressed solo' : ''}
                    aria-label={`Solo ${LABELS[channel]}`}
                    aria-pressed={mix.solo}
                    disabled={disabled}
                    onClick={() => setMix(channel, { solo: !mix.solo })}
                  >
                    S
                  </button>
                </div>
                <small>{events.filter((e) => e.channel === channel).length} evenimente</small>
              </div>
            );
          })}
        </div>
        <p className="mixer-help">
          M = mute · S = solo. Indicatoarele arată nivelurile setate, nu măsurători audio. Setările
          sunt aplicate la următoarea pornire și la export.
        </p>
      </section>
      <aside className="composer-side">
        <section className="panel export-panel">
          <div className="panel-header">
            <div className="section-title">
              <Download size={17} />
              <h2>Exportă compoziția</h2>
            </div>
          </div>
          <div className="note-properties">
            <p>
              {project.name}
              <br />
              {project.bpm} BPM · {Math.ceil(beats / 4)} măsuri · {Math.round(duration)} secunde
            </p>
            <button className="button dark" disabled={disabled || !beats} onClick={onMidi}>
              <Download size={16} />
              Exportă MIDI
            </button>
            <small>
              Fișier .mid cu tempo, măsură 4/4 și piste separate pentru armonie, melodie, bas și
              tobe. Respectă mute/solo și nivelurile.
            </small>
            <button
              className="button"
              disabled={disabled || !beats || duration > 180}
              onClick={onWav}
            >
              <Waves size={16} />
              {exporting ? 'Se randează…' : 'Exportă WAV'}
            </button>
            <small>
              Mix stereo PCM 16-bit / 44,1 kHz, o singură trecere, fără metronom. Limită: 3 minute
              pentru a controla memoria. Sunetele sunt sintetizate.
            </small>
            {duration > 180 && (
              <p className="export-warning">
                Proiectul depășește 3 minute. Folosește exportul MIDI.
              </p>
            )}
            <p>
              Exportul proiectului .gcs.json rămâne disponibil în bara de sus și păstrează toate
              datele editabile.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Ținta audio Windows</h2>
          </div>
          <div className="note-properties">
            <strong>Windows 11 · Scarlett 4i4</strong>
            <p>
              Înregistrarea, monitorizarea și driverele WASAPI/ASIO aparțin etapei native. Acest
              mixer controlează instrumentele sintetizate; nu captează intrarea interfeței.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
