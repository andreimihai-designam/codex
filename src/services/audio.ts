import {
  arrangementBeats,
  chordTimeline,
  compositionEvents,
  type MusicEvent,
} from '../core/composition';
import type { Arrangement } from '../core/project';

type Source = AudioScheduledSourceNode;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.25), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      samples[i] = (seed >>> 0) / 2147483648 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}
/** Shared real-time and offline renderer. No sample downloads or network access. */
function scheduleEvent(
  ctx: BaseAudioContext,
  destination: AudioNode,
  event: MusicEvent,
  at: number,
  beatDuration: number,
  sources?: Set<Source>,
) {
  const count = event.notes.length;
  event.notes.forEach((midi, i) => {
    const begin = at + (event.channel === 'harmony' ? i * 0.012 : 0);
    const duration =
      event.drum === 'hat'
        ? 0.055
        : event.drum === 'snare'
          ? 0.15
          : event.drum === 'kick'
            ? 0.2
            : Math.max(0.06, event.duration * beatDuration - (begin - at));
    const envelope = ctx.createGain();
    const gain =
      event.velocity *
      (event.channel === 'harmony'
        ? 0.24 / Math.sqrt(count)
        : event.channel === 'bass'
          ? 0.35
          : event.channel === 'drums'
            ? 0.35
            : 0.19);
    envelope.gain.setValueAtTime(0.0001, begin);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), begin + 0.005);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain * 0.3),
      begin + duration * 0.6,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
    envelope.connect(destination);
    let source: OscillatorNode | AudioBufferSourceNode;
    let filter: BiquadFilterNode | undefined;
    if (event.drum === 'snare' || event.drum === 'hat') {
      source = ctx.createBufferSource();
      source.buffer = noise(ctx);
      filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = event.drum === 'hat' ? 6500 : 1200;
      source.connect(filter);
      filter.connect(envelope);
    } else {
      source = ctx.createOscillator();
      source.type = event.channel === 'bass' || event.drum === 'kick' ? 'sine' : 'triangle';
      source.frequency.setValueAtTime(
        event.drum === 'kick' ? 140 : 440 * 2 ** ((midi - 69) / 12),
        begin,
      );
      if (event.drum === 'kick') source.frequency.exponentialRampToValueAtTime(42, begin + 0.13);
      source.connect(envelope);
    }
    sources?.add(source);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      envelope.disconnect();
      sources?.delete(source);
    };
    source.start(begin);
    source.stop(begin + duration + 0.01);
  });
}
function mixBus(ctx: BaseAudioContext, volume: number) {
  const gain = ctx.createGain();
  gain.gain.value = volume;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.ratio.value = 8;
  gain.connect(compressor);
  compressor.connect(ctx.destination);
  return gain;
}

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private nodes = new Set<Source>();
  private timer?: ReturnType<typeof setInterval>;
  private volume = 0.6;
  private click = false;
  private stopCallback?: () => void;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = mixBus(this.context, this.volume);
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
  async preview(midi: number[]) {
    const ctx = await this.unlock();
    scheduleEvent(
      ctx,
      this.master!,
      { beat: 0, duration: 1.6, notes: midi, velocity: 0.7, channel: 'harmony' },
      ctx.currentTime + 0.025,
      1,
      this.nodes,
    );
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
    const beats = arrangementBeats(arrangement);
    if (!beats) return;
    const ctx = await this.unlock();
    const secondsPerBeat = 60 / arrangement.bpm;
    const cycleDuration = beats * secondsPerBeat;
    const events = compositionEvents(arrangement);
    const timeline = chordTimeline(arrangement);
    let cycle = 0,
      eventIndex = 0,
      nextClick = 0;
    const start = ctx.currentTime + 0.08;
    let lastTick = ctx.currentTime;
    let previousPosition = '';
    this.stopCallback = onStop;
    const tick = () => {
      const now = ctx.currentTime;
      if (ctx.state !== 'running' || now - lastTick > 0.25) {
        this.stop();
        return;
      }
      lastTick = now;
      const elapsed = now - start;
      if (!loop && elapsed >= cycleDuration + 0.05) {
        this.stop();
        return;
      }
      if (elapsed >= 0) {
        const beat = loop
          ? (elapsed / secondsPerBeat) % beats
          : Math.min(beats - 0.0001, elapsed / secondsPerBeat);
        const item = timeline.find((c) => beat >= c.start && beat < c.end);
        const position = `${item?.index ?? -1}:${Math.floor(beat)}`;
        if (position !== previousPosition) {
          previousPosition = position;
          onPosition(item?.index ?? -1, Math.floor(beat) % 4);
        }
      }
      const horizon = now + 0.15;
      while (events.length) {
        const event = events[eventIndex];
        const time = start + cycle * cycleDuration + event.beat * secondsPerBeat;
        if (time >= horizon || (!loop && cycle > 0)) break;
        scheduleEvent(
          ctx,
          this.master!,
          event,
          Math.max(now + 0.002, time),
          secondsPerBeat,
          this.nodes,
        );
        eventIndex++;
        if (eventIndex === events.length) {
          eventIndex = 0;
          cycle++;
        }
      }
      while (start + nextClick * secondsPerBeat < horizon && (loop || nextClick < beats)) {
        if (this.click)
          scheduleEvent(
            ctx,
            this.master!,
            {
              beat: 0,
              duration: 0.04,
              notes: [nextClick % 4 === 0 ? 96 : 89],
              velocity: 0.3,
              channel: 'melody',
            },
            Math.max(now + 0.002, start + nextClick * secondsPerBeat),
            1,
            this.nodes,
          );
        nextClick++;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
}

/** Complete arrangement, one pass, no metronome. Bound memory before allocating. */
export async function renderWav(
  arrangement: Arrangement,
  volume = 0.6,
): Promise<Uint8Array<ArrayBuffer>> {
  const duration = (arrangementBeats(arrangement) * 60) / arrangement.bpm;
  if (!duration) throw new Error('Adaugă acorduri sau note înainte de export.');
  if (duration > 180)
    throw new Error(
      'Exportul WAV este limitat la 3 minute per proiect în această versiune. Exportă MIDI pentru proiecte mai lungi.',
    );
  const ctx = new OfflineAudioContext(2, Math.ceil((duration + 0.6) * 44100), 44100);
  const master = mixBus(ctx, volume);
  for (const event of compositionEvents(arrangement))
    scheduleEvent(
      ctx,
      master,
      event,
      0.02 + (event.beat * 60) / arrangement.bpm,
      60 / arrangement.bpm,
    );
  const buffer = await ctx.startRendering();
  return encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], buffer.sampleRate);
}
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  if (
    !channels.length ||
    !channels[0].length ||
    channels.some((c) => c.length !== channels[0].length)
  )
    throw new Error('Canale audio invalide.');
  const samples = channels[0].length;
  const bytes = new Uint8Array(44 + samples * channels.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, bytes.length - 44, true);
  let peak = 1;
  for (const channel of channels)
    for (const value of channel) {
      if (!Number.isFinite(value)) throw new Error('Eșantion audio invalid.');
      peak = Math.max(peak, Math.abs(value));
    }
  for (let i = 0; i < samples; i++)
    for (let c = 0; c < channels.length; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] / peak));
      view.setInt16(
        44 + (i * channels.length + c) * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    }
  return bytes;
}
