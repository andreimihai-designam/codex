import { afterEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '../src/core/project';
import { exportBundle, importBundle } from '../src/services/projectBundle';
import { getAsset, loadChat, putAsset, saveChat } from '../src/services/mediaStore';
import { encodeWav } from '../src/services/audio';
vi.mock('../src/services/mediaStore', () => ({
  getAsset: vi.fn(),
  loadChat: vi.fn(),
  putAsset: vi.fn(),
  saveChat: vi.fn(),
  deleteMedia: vi.fn(),
}));
function fixture() {
  const p = newProject(false);
  p.audio = {
    assets: [
      {
        id: 'asset-1',
        name: 'guitar.wav',
        duration: 0.1,
        sampleRate: 44100,
        channels: 1,
        peaks: [0.1],
      },
    ],
    tracks: [
      {
        id: 'track-1',
        name: 'Guitar',
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        clips: [
          { id: 'clip-1', assetId: 'asset-1', start: 0, trimStart: 0, trimEnd: 0.1, gain: 1 },
        ],
      },
    ],
  };
  return p;
}
describe('complete studio backup', () => {
  afterEach(() => vi.resetAllMocks());
  it('round-trips actual WAV bytes and chat under a new project namespace', async () => {
    const wav = new Blob([encodeWav([new Float32Array(4410).fill(0.1)], 44100)], {
      type: 'audio/wav',
    });
    vi.mocked(getAsset).mockResolvedValue(wav);
    vi.mocked(loadChat).mockResolvedValue([{ role: 'assistant', content: 'O idee.' }]);
    const original = fixture(),
      archive = await exportBundle(original),
      restored = await importBundle(new File([archive], 'song.gcsbundle'));
    expect(restored.id).not.toBe(original.id);
    expect(restored.audio).toEqual(original.audio);
    expect(putAsset).toHaveBeenCalledOnce();
    const args = vi.mocked(putAsset).mock.calls[0];
    expect(args[0]).toBe(restored.id);
    expect(args[1]).toBe('asset-1');
    expect(new Uint8Array(await args[2].arrayBuffer())).toEqual(
      new Uint8Array(await wav.arrayBuffer()),
    );
    expect(saveChat).toHaveBeenCalledWith(restored.id, [{ role: 'assistant', content: 'O idee.' }]);
  });
  it('rejects corrupt source samples before any persistent write', async () => {
    vi.mocked(getAsset).mockResolvedValue(new Blob([encodeWav([new Float32Array(4410)], 44100)]));
    vi.mocked(loadChat).mockResolvedValue([]);
    const bytes = new Uint8Array(await (await exportBundle(fixture())).arrayBuffer());
    bytes[bytes.length - 1] ^= 1;
    await expect(importBundle(new File([bytes], 'bad.gcsbundle'))).rejects.toThrow('SHA-256');
    expect(putAsset).not.toHaveBeenCalled();
  });
  it('rejects invalid headers and bounded metadata lengths', async () => {
    await expect(importBundle(new File(['invalid'], 'bad.gcsbundle'))).rejects.toThrow('invalid');
    const header = new Uint8Array([71, 67, 83, 66, 0, 0, 0, 0]);
    new DataView(header.buffer).setUint32(4, 9_000_000, true);
    await expect(importBundle(new File([header], 'bad.gcsbundle'))).rejects.toThrow('Metadate');
    expect(putAsset).not.toHaveBeenCalled();
  });
});
