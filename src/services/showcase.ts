import { newProject, type Project } from '../core/project';
import { generateMelody } from '../core/composition';
import { renderWav } from './audio';
import { decodeAudio } from './recording';
import { putAsset } from './mediaStore';
/** Original locally synthesized content; no recordings, models, accounts or downloads. */
export async function showcaseProject(): Promise<Project> {
  const p = newProject();
  p.name = 'Nocturne · demo de portofoliu';
  p.bpm = 88;
  p.backing.enabled = true;
  p.backing.style = 'ballad';
  p.melody = generateMelody(p, 42).map((n) => ({ ...n, id: crypto.randomUUID() }));
  const solo = structuredClone(p);
  solo.backing.enabled = false;
  solo.backing.mix.harmony.muted = true;
  const wav = await renderWav(solo, 0.65);
  const source = await decodeAudio(
    new Blob([wav], { type: 'audio/wav' }),
    'Exemplu original · lead sintetizat',
  );
  await putAsset(p.id, source.asset.id, source.blob);
  p.audio = {
    assets: [source.asset],
    tracks: [
      {
        id: crypto.randomUUID(),
        name: 'Textură lead · sinteză',
        volume: 0.25,
        pan: 0.1,
        muted: false,
        solo: false,
        clips: [
          {
            id: crypto.randomUUID(),
            assetId: source.asset.id,
            start: 0,
            trimStart: 0,
            trimEnd: (16 * 60) / p.bpm,
            gain: 1,
          },
        ],
      },
    ],
  };
  p.backing.mix.melody.muted = false; // Quiet audio doubling; the editable melody remains audible.
  return p;
}
