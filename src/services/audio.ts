import { buildChord } from '../core/theory';
import type { Arrangement } from '../core/project';

/** All audible events use AudioContext time; UI timers only feed the lookahead. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private nodes = new Set<OscillatorNode>();
  private timer?: ReturnType<typeof setInterval>;
  private volume = 0.6;
  private click = false;
  private stopCallback?: () => void;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.context.state !== 'running')
      throw new Error('Audio indisponibil. Atinge din nou butonul de redare.');
    return this.context;
  }
  setVolume(volume: number) {
    this.volume = volume;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
  }
  setMetronome(value: boolean) {
    this.click = value;
  }
  private note(
    midi: number,
    at: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'triangle',
  ) {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain * 0.25),
      at + Math.max(0.02, duration * 0.65),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(envelope);
    envelope.connect(this.master!);
    this.nodes.add(osc);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
      this.nodes.delete(osc);
    };
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
  private chord(midi: number[], at: number, duration: number) {
    midi.forEach((note, i) =>
      this.note(
        note,
        at + i * 0.012,
        Math.max(0.1, duration - i * 0.012),
        0.22 / Math.sqrt(midi.length),
      ),
    );
  }
  async preview(midi: number[]) {
    const ctx = await this.unlock();
    this.chord(midi, ctx.currentTime + 0.025, 1.6);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.nodes.clear();
    const callback = this.stopCallback;
    this.stopCallback = undefined;
    callback?.();
  }
  async play(
    arrangement: Arrangement,
    loop: boolean,
    onPosition: (index: number, beat: number) => void,
    onStop: () => void,
  ) {
    this.stop();
    if (!arrangement.chords.length) return;
    const ctx = await this.unlock();
    const beatDuration = 60 / arrangement.bpm;
    let nextTime = ctx.currentTime + 0.08;
    let chordIndex = 0,
      beat = 0,
      globalBeat = 0;
    let finishedAt: number | undefined;
    const positions: { at: number; index: number; beat: number }[] = [];
    this.stopCallback = onStop;
    const tick = () => {
      // Never burst missed events after a suspended browser tab.
      if (ctx.state !== 'running' || nextTime < ctx.currentTime - 0.25) {
        this.stop();
        return;
      }
      while (positions.length && positions[0].at <= ctx.currentTime) {
        const position = positions.shift()!;
        onPosition(position.index, position.beat);
      }
      if (finishedAt !== undefined) {
        if (ctx.currentTime >= finishedAt) this.stop();
        return;
      }
      while (nextTime < ctx.currentTime + 0.15) {
        const chord = arrangement.chords[chordIndex];
        if (beat === 0)
          this.chord(buildChord(chord).midi, nextTime, chord.beats * beatDuration * 0.95);
        if (this.click) this.note(globalBeat % 4 === 0 ? 96 : 89, nextTime, 0.045, 0.09, 'sine');
        positions.push({ at: nextTime, index: chordIndex, beat: globalBeat % 4 });
        nextTime += beatDuration;
        beat++;
        globalBeat++;
        if (beat >= chord.beats) {
          beat = 0;
          chordIndex++;
          if (chordIndex >= arrangement.chords.length) {
            if (loop) chordIndex = 0;
            else {
              finishedAt = nextTime;
              break;
            }
          }
        }
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
}
