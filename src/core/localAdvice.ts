import { analyze, buildChord, keyNotes, substitutions } from './theory';
import { generateMelody } from './composition';
import type { Project } from './project';
import { parseAssistantReply, type AssistantReply } from './assistant';
export type AdviceIntent = 'analysis' | 'cadence' | 'melody' | 'variation';
/** Transparent music rules. No model, network call, inferred user data or credentials. */
export function localAdvice(project: Project, intent: AdviceIntent, seed = 42): AssistantReply {
  const notes = keyNotes(project.key),
    minor = project.key.mode === 'minor';
  const cadence = [
    { root: notes[1], quality: minor ? 'm7b5' : 'm7', inversion: 0, beats: 4 },
    { root: notes[4], quality: '7', inversion: 0, beats: 4 },
    { root: project.key.root, quality: minor ? 'm' : 'maj7', inversion: 0, beats: 4 },
  ];
  let value: unknown;
  if (intent === 'cadence')
    value = {
      answer: `Cadență ${minor ? 'iiø7–V7–i' : 'ii7–V7–Imaj7'} în ${project.key.root} ${project.key.mode}. Predominanta pregătește dominanta, apoi tonica. ${minor ? 'Dominanta majoră folosește sensibila ridicată, din minorul armonic.' : ''} Ascultă tensiunea și rezolvarea înainte de a înlocui progresia.`,
      progression: cadence,
    };
  else if (intent === 'melody') {
    const base = project.chords.length
      ? project
      : ({
          ...project,
          chords: cadence.map((c, i) => ({ ...c, id: `local-${i}`, section: 'A' })),
        } as Project);
    value = {
      answer: `Schiță reproductibilă (seed ${seed}): ținte din acord pe timpi și note ale gamei între timpi. Registru MIDI 60–79, maximum 64 de note. Ajustează frazarea în editorul melodic.${project.chords.length ? '' : ' Este propusă și o cadență pentru proiectul gol.'}`,
      melody: generateMelody(base, seed).slice(0, 64),
      ...(project.chords.length ? {} : { progression: cadence }),
    };
  } else if (intent === 'variation') {
    if (project.chords.length > 16)
      return {
        answer:
          'Pentru o progresie cu peste 16 acorduri, modifică acordul selectat în Harmony Studio; nu înlocuiesc automat întreaga progresie cu o versiune trunchiată.',
      };
    const first = project.chords[0],
      alternative = first ? substitutions(first)[0] : undefined;
    value =
      alternative && project.chords.length <= 16
        ? {
            answer: `Pentru primul acord, ${buildChord(first).symbol}, poți încerca ${buildChord(alternative.chord).symbol}. ${alternative.reason} Restul progresiei rămâne propus în aceeași ordine.`,
            progression: project.chords
              .slice(0, 16)
              .map((c, i) => ({ ...(i === 0 ? alternative.chord : c), beats: c.beats })),
          }
        : {
            answer:
              project.chords.length > 16
                ? 'Pentru progresii de peste 16 acorduri, schimbă primul acord direct în Harmony Studio; această recomandare nu înlocuiește și nu scurtează progresia.'
                : 'Nu există o substituție din setul curent de reguli pentru primul acord. Încearcă o inversiune în Harmony Studio sau construiește o cadență.',
          };
  } else {
    value = {
      answer: project.chords.length
        ? `${project.chords.length > 16 ? 'Analizez primele 16 acorduri.\n\n' : ''}Tonalitate aleasă: ${project.key.root} ${project.key.mode}, ${project.bpm} BPM.${project.chords.length > 16 ? ' Analizez primele 16 acorduri.' : ''}\n\n${project.chords
            .slice(0, 16)
            .map((c) => {
              const a = analyze(c, project.key);
              return `${buildChord(c).symbol} → ${a.roman} · ${a.function}. ${a.explanation}`;
            })
            .join(
              '\n\n',
            )}\n\nInterpretările sunt contextuale; ascultarea și frazarea rămân esențiale.`
        : 'Proiectul este gol. Folosește „Construiește o cadență” pentru a începe, apoi explorează griful, melodia și backing-ul. Nu este necesar un serviciu AI.',
    };
  }
  return parseAssistantReply(JSON.stringify(value), project);
}
