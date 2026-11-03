import type { AudioAsset } from '../core/studio';
import { encodeWav } from './audio';
export interface ImportedAudio {
  asset: AudioAsset;
  blob: Blob;
}
function describe(buffer: AudioBuffer, name: string): ImportedAudio {
  if (buffer.duration < 0.02 || buffer.duration > 180.1)
    throw new Error('O sursă audio trebuie să aibă între 0,02 și 180 secunde.');
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) =>
    buffer.getChannelData(c),
  );
  const peaks = Array.from({ length: 128 }, (_, i) => {
    const start = Math.floor((i * buffer.length) / 128),
      end = Math.floor(((i + 1) * buffer.length) / 128);
    let peak = 0;
    for (const channel of channels)
      for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(channel[j]));
    return Math.round(Math.min(1, peak) * 1000) / 1000;
  });
  return {
    asset: {
      id: crypto.randomUUID(),
      name: name.slice(0, 150),
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: channels.length,
      peaks,
    },
    blob: new Blob([encodeWav(channels, buffer.sampleRate)], { type: 'audio/wav' }),
  };
}
export async function decodeAudio(file: Blob, name: string): Promise<ImportedAudio> {
  if (file.size > 64_000_000) throw new Error('Fișierul audio depășește 64 MB.');
  const ctx = new OfflineAudioContext(2, 1, 44100);
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('Format audio nerecunoscut de browser. Încearcă WAV, MP3, Ogg sau WebM.');
  }
  return describe(buffer, name);
}
export async function inputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      'Captura audio nu este disponibilă în acest browser/origine. Folosește Chrome/Edge și permite accesul la microfon.',
    );
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
}
export class BrowserRecorder {
  private stream?: MediaStream;
  private ctx?: AudioContext;
  private recorder?: MediaRecorder;
  private monitor?: GainNode;
  private timeout?: ReturnType<typeof setTimeout>;
  private resolve?: (result: ImportedAudio) => void;
  private reject?: (error: unknown) => void;
  private chunks: Blob[] = [];
  private started = 0;
  private bytes = 0;
  private stopping = false;
  async start(
    deviceId: string,
    channel: 'stereo' | '1' | '2',
    monitor: boolean,
  ): Promise<{ sampleRate: number; channels: number; echoCancellation?: boolean }> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('Browserul nu oferă înregistrare audio. Folosește Chrome/Edge actualizat.');
    if (this.stream) throw new Error('Înregistrarea este deja activă.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: { ideal: 2 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      const settings = this.stream.getAudioTracks()[0].getSettings();
      if (channel === '2' && (settings.channelCount ?? 1) < 2)
        throw new Error(
          'Dispozitivul expune doar un canal în browser. Alege canalul 1 sau stereo.',
        );
      this.ctx = new AudioContext();
      await this.ctx.resume();
      const source = this.ctx.createMediaStreamSource(this.stream);
      const destination = this.ctx.createMediaStreamDestination();
      this.monitor = this.ctx.createGain();
      this.monitor.gain.value = monitor ? 0.35 : 0;
      this.monitor.connect(this.ctx.destination);
      if (channel === 'stereo') {
        source.connect(destination);
        source.connect(this.monitor);
      } else {
        const splitter = this.ctx.createChannelSplitter(2),
          merger = this.ctx.createChannelMerger(2),
          index = Number(channel) - 1;
        source.connect(splitter);
        splitter.connect(merger, index, 0);
        splitter.connect(merger, index, 1);
        merger.connect(destination);
        merger.connect(this.monitor);
      }
      const mime = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find((t) => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(destination.stream, mime ? { mimeType: mime } : undefined);
      this.chunks = [];
      this.bytes = 0;
      this.stopping = false;
      this.started = performance.now();
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) {
          this.chunks.push(e.data);
          this.bytes += e.data.size;
          if (this.bytes > 16_000_000 && !this.stopping) this.stop();
        }
      };
      this.recorder.onstop = async () => {
        const mimeType = this.recorder?.mimeType ?? 'audio/webm';
        this.release();
        try {
          const result = await decodeAudio(
            new Blob(this.chunks, { type: mimeType }),
            'Înregistrare ' + new Date().toLocaleTimeString('ro-RO'),
          );
          this.resolve?.(result);
        } catch (error) {
          this.reject?.(error);
        } finally {
          this.resolve = undefined;
          this.reject = undefined;
          this.chunks = [];
        }
      };
      this.recorder.onerror = () => {
        this.reject?.(new Error('Dispozitivul a întrerupt înregistrarea.'));
        this.cancel();
      };
      this.stream.getAudioTracks()[0].onended = () => {
        if (!this.stopping) this.stop();
      };
      this.recorder.start(250);
      this.timeout = setTimeout(() => this.stop(), 180_000);
      return {
        sampleRate: this.ctx.sampleRate,
        channels: settings.channelCount ?? 1,
        echoCancellation: settings.echoCancellation,
      };
    } catch (e) {
      this.release();
      throw e;
    }
  }
  get elapsed() {
    return this.started ? (performance.now() - this.started) / 1000 : 0;
  }
  finished(): Promise<ImportedAudio> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  setMonitor(value: boolean) {
    if (this.ctx && this.monitor)
      this.monitor.gain.setTargetAtTime(value ? 0.35 : 0, this.ctx.currentTime, 0.02);
  }
  stop() {
    if (!this.recorder || this.recorder.state === 'inactive') return;
    this.stopping = true;
    this.recorder.stop();
  }
  cancel() {
    this.resolve = undefined;
    this.reject = undefined;
    if (this.recorder) {
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      try {
        if (this.recorder.state !== 'inactive') this.recorder.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.release();
    this.chunks = [];
  }
  private release() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = undefined;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = undefined;
    }
    this.monitor = undefined;
  }
}
