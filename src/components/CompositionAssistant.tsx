import { useState } from 'react';
import { BookOpen, Check, Layers3, Music2, Sparkles } from 'lucide-react';
import type { Project } from '../core/project';
import type { AssistantReply } from '../core/assistant';
import { localAdvice, type AdviceIntent } from '../core/localAdvice';
import { buildChord } from '../core/theory';
import AiAssistant from './AiAssistant';
export default function CompositionAssistant(props: {
  project: Project;
  disabled: boolean;
  onApply: (reply: AssistantReply, parts: { chords: boolean; melody: boolean }) => void;
  onError: (text: string) => void;
}) {
  const [external, setExternal] = useState(false),
    [reply, setReply] = useState(() => localAdvice(props.project, 'analysis')),
    [signature, setSignature] = useState(props.project.updatedAt),
    [seed, setSeed] = useState(42),
    [parts, setParts] = useState({ chords: true, melody: true });
  function run(intent: AdviceIntent) {
    try {
      setReply(localAdvice(props.project, intent, seed));
      setSignature(props.project.updatedAt);
      setParts({ chords: true, melody: true });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : 'Recomandarea nu a putut fi construită.');
    }
  }
  const stale = signature !== props.project.updatedAt;
  return (
    <>
      <div className="assistant-mode" role="group" aria-label="Mod asistent">
        <button
          className={!external ? 'selected' : ''}
          aria-pressed={!external}
          onClick={() => setExternal(false)}
        >
          <BookOpen size={16} />
          Recomandări locale
        </button>
        <button
          className={external ? 'selected' : ''}
          aria-pressed={external}
          onClick={() => setExternal(true)}
        >
          <Sparkles size={16} />
          AI extern (opțional)
        </button>
      </div>
      {external ? (
        <AiAssistant {...props} />
      ) : (
        <div className="local-advisor-layout">
          <section className="panel">
            <div className="panel-header">
              <div className="section-title">
                <BookOpen size={18} />
                <h2>Asistent de compoziție</h2>
              </div>
              <span className="subtle-badge">Reguli muzicale · local</span>
            </div>
            <div className="composer-intro">
              <h3>Idei muzicale, fără configurare.</h3>
              <p>
                Analize și sugestii deterministe, bazate pe teoria muzicală. Acest mod funcționează
                fără cont, server sau model AI. AI-ul generativ rămâne disponibil separat, dacă îl
                configurezi.
              </p>
            </div>
            <div className="advisor-actions">
              <button
                aria-label="Înțelege progresia"
                disabled={props.disabled}
                onClick={() => run('analysis')}
              >
                <BookOpen size={20} />
                <strong>Înțelege progresia</strong>
                <span>Funcții armonice și explicații în tonalitatea aleasă.</span>
              </button>
              <button
                aria-label="Construiește o cadență"
                disabled={props.disabled}
                onClick={() => run('cadence')}
              >
                <Layers3 size={20} />
                <strong>Construiește o cadență</strong>
                <span>O mișcare ii–V–I, adaptată gamei majore sau minore.</span>
              </button>
              <button
                aria-label="Propune o melodie"
                disabled={props.disabled}
                onClick={() => run('melody')}
              >
                <Music2 size={20} />
                <strong>Propune o melodie</strong>
                <span>Note din acord și gamă, cu seed reproductibil.</span>
              </button>
              <button
                aria-label="Încearcă altă culoare"
                disabled={props.disabled}
                onClick={() => run('variation')}
              >
                <Sparkles size={20} />
                <strong>Încearcă altă culoare</strong>
                <span>O substituție explicată, verificată de motorul muzical.</span>
              </button>
            </div>
            <div className="local-advice" role="status">
              <h3>Recomandare bazată pe reguli</h3>
              <p>{reply.answer}</p>
            </div>
            {(reply.progression || reply.melody) && (
              <div className="proposal-preview">
                <h3>Previzualizare</h3>
                {reply.progression && (
                  <label>
                    <input
                      type="checkbox"
                      checked={parts.chords}
                      disabled={props.disabled || stale}
                      onChange={(e) => setParts((p) => ({ ...p, chords: e.target.checked }))}
                    />
                    Progresie: {reply.progression.map((c) => buildChord(c).symbol).join(' → ')}
                  </label>
                )}
                {reply.melody && (
                  <label>
                    <input
                      type="checkbox"
                      checked={parts.melody}
                      disabled={props.disabled || stale}
                      onChange={(e) => setParts((p) => ({ ...p, melody: e.target.checked }))}
                    />
                    Melodie: {reply.melody.length} note
                  </label>
                )}
                {stale && (
                  <p>Proiectul s-a schimbat. Recalculează recomandarea înainte de aplicare.</p>
                )}
                <button
                  className="button dark"
                  disabled={
                    props.disabled ||
                    stale ||
                    !((parts.chords && reply.progression) || (parts.melody && reply.melody))
                  }
                  onClick={() => {
                    props.onApply(reply, parts);
                    setSignature('');
                  }}
                >
                  <Check size={16} />
                  Aplică recomandarea
                </button>
                <small>Starea anterioară este păstrată în Istoric.</small>
              </div>
            )}
          </section>
          <aside className="composer-side">
            <section className="panel">
              <div className="panel-header">
                <h2>Control creativ</h2>
              </div>
              <div className="note-properties">
                <label>
                  Seed pentru melodie
                  <input
                    aria-label="Seed recomandare locală"
                    type="number"
                    min="1"
                    max="999999"
                    value={seed}
                    disabled={props.disabled}
                    onChange={(e) =>
                      setSeed(Math.max(1, Math.min(999999, Number(e.target.value) || 1)))
                    }
                  />
                </label>
                <p>
                  Recomandările folosesc tonalitatea și acordurile proiectului. Nu interpretează
                  liber orice întrebare și nu sunt răspunsuri generate de un model lingvistic.
                </p>
                <p>
                  Poți prezenta întregul flux local fără Ollama sau ChatGPT. Pentru conversație
                  liberă, alege modul AI extern opțional și configurează furnizorul tău.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
