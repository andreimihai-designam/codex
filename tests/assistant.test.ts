import { afterEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '../src/core/project';
import { applyAssistantReply, assistantContext, parseAssistantReply } from '../src/core/assistant';
import { askAi, endpointUrl, listAiModels, type AiConfig } from '../src/services/assistant';
const local: AiConfig = {
  provider: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  maxTokens: 256,
};
describe('validated AI suggestions', () => {
  it('validates actual chords and notes and applies only explicitly selected parts', () => {
    const p = newProject();
    const result = parseAssistantReply(
      JSON.stringify({
        answer: 'Încearcă ii–V–I.',
        progression: [
          { root: 'D', quality: 'm7', beats: 4 },
          { root: 'G', quality: '7', beats: 4 },
          { root: 'C', quality: 'maj7', beats: 4 },
        ],
        melody: [{ midi: 64, start: 0, duration: 0.5, velocity: 0.8 }],
      }),
      p,
    );
    const next = applyAssistantReply(p, result, { chords: true, melody: false });
    expect(next.chords.map((c) => c.root)).toEqual(['D', 'G', 'C']);
    expect(next.melody).toEqual([]);
    expect(p.chords).toHaveLength(4);
    expect(next.audio).toEqual(p.audio);
  });
  it('rejects invented chords, invalid timing and malformed output before mutation', () => {
    const p = newProject(),
      before = JSON.stringify(p);
    for (const value of [
      { answer: 'x', progression: [{ root: 'H', quality: 'm', beats: 4 }] },
      { answer: 'x', melody: [{ midi: 200, start: 0, duration: 1 }] },
      { answer: 'x', melody: [{ midi: 64, start: 0.1, duration: 1 }] },
      { answer: 'x', progression: [{ root: 'C', quality: 'unknown' }] },
    ])
      expect(() => parseAssistantReply(JSON.stringify(value), p)).toThrow();
    expect(() => parseAssistantReply('not JSON', p)).toThrow('JSON');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('excludes audio bytes, file names and project names from the model context', () => {
    const p = newProject();
    p.name = 'private-name';
    p.audio.assets = [
      {
        id: 'secret',
        name: 'private-recording.wav',
        duration: 1,
        sampleRate: 44100,
        channels: 1,
        peaks: [0],
      },
    ];
    const context = assistantContext(p);
    expect(context).not.toContain('private');
    expect(context).not.toContain('peaks');
    expect(context).toContain('Cmaj7');
  });
  it('restricts local AI to loopback and rejects insecure cloud or credential URLs', () => {
    expect(endpointUrl(local).hostname).toBe('127.0.0.1');
    for (const endpoint of [
      'http://remote.example',
      'file:///x',
      'http://user:password@localhost:11434',
      'http://localhost:11434?key=x',
    ])
      expect(() => endpointUrl({ ...local, endpoint })).toThrow();
    expect(() =>
      endpointUrl({ ...local, provider: 'cloud', endpoint: 'http://example.com' }),
    ).toThrow('HTTPS');
  });
});
describe('AI provider protocol (mocked HTTP; not model inference)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses Ollama chat/schema/token controls and validates returned suggestions', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              answer: 'Propun C major.',
              progression: [{ root: 'C', quality: '', beats: 4 }],
            }),
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const reply = await askAi(
      newProject(),
      [],
      'Propune un acord',
      local,
      '',
      new AbortController().signal,
    );
    expect(reply.progression?.[0].root).toBe('C');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(false);
    expect(body.options.num_predict).toBe(256);
    expect(body.format.required).toContain('answer');
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBeUndefined();
  });
  it('sends cloud credentials only in the chosen HTTPS request header', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"answer":"Explicație."}' } }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    await askAi(
      newProject(),
      [],
      'Explică',
      { ...local, provider: 'cloud', endpoint: 'https://api.example/v1', model: 'chosen-model' },
      ' test-key ',
      new AbortController().signal,
    );
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer test-key');
    expect(options.body).not.toContain('test-key');
    expect(JSON.parse(options.body).max_tokens).toBe(256);
  });
  it('handles available models and access/model errors distinctly', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"models":[{"name":"qwen2.5:3b"}]}', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    expect(await listAiModels(local, '', new AbortController().signal)).toEqual(['qwen2.5:3b']);
    await expect(
      askAi(newProject(), [], 'test', local, '', new AbortController().signal),
    ).rejects.toThrow('negăsit');
  });
});
