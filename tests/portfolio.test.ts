import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { newProject } from '../src/core/project';
import { localAdvice } from '../src/core/localAdvice';
import { applyAssistantReply } from '../src/core/assistant';

describe('autonomous local advisor', () => {
  it('builds major and minor cadences without any provider', () => {
    const p = newProject();
    expect(localAdvice(p, 'cadence').progression?.map((c) => c.root + c.quality)).toEqual([
      'Dm7',
      'G7',
      'Cmaj7',
    ]);
    p.key = { root: 'A', mode: 'minor' };
    expect(localAdvice(p, 'cadence').progression?.map((c) => c.root + c.quality)).toEqual([
      'Bm7b5',
      'E7',
      'Am',
    ]);
  });
  it('generates a deterministic melody for empty and existing projects', () => {
    const p = newProject(false);
    const reply = localAdvice(p, 'melody', 42);
    expect(reply.melody?.length).toBeGreaterThan(0);
    expect(reply.melody).toEqual(localAdvice(p, 'melody', 42).melody);
    expect(reply.progression).toHaveLength(3);
    const applied = applyAssistantReply(p, reply, { chords: true, melody: true });
    expect(applied.chords).toHaveLength(3);
    expect(applied.melody.length).toBeGreaterThan(0);
    expect(p.chords).toHaveLength(0);
  });
  it('explains real harmonic functions and never mutates the project', () => {
    const p = newProject(),
      before = JSON.stringify(p);
    expect(localAdvice(p, 'analysis').answer).toContain('Imaj7');
    expect(localAdvice(p, 'analysis').answer).toContain('Tonică');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('does not truncate long progressions when offering a variation', () => {
    const p = newProject();
    p.chords = Array.from({ length: 20 }, (_, i) => ({ ...p.chords[0], id: String(i) }));
    expect(localAdvice(p, 'variation').progression).toBeUndefined();
    expect(localAdvice(p, 'analysis').answer).toContain('primele 16');
  });
});
describe('downloadable portfolio releases', () => {
  it('ships a ready-to-open index, not the development source shell', () => {
    const zip = unzipSync(
      readFileSync(new URL('../release/Guitar-Composer-Studio.zip', import.meta.url)),
    );
    expect(Object.keys(zip).sort()).toEqual(['README.txt', 'index.html']);
    const html = strFromU8(zip['index.html']);
    expect(html).toContain('data-portable');
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(strFromU8(zip['README.txt'])).toContain('No ChatGPT account, Ollama');
  });
  it('ships deployable assets, PWA metadata and the public ZIP download together', () => {
    const zip = unzipSync(
      readFileSync(new URL('../release/Guitar-Composer-Studio-Web.zip', import.meta.url)),
    );
    expect(zip['index.html']).toBeDefined();
    expect(zip['.nojekyll']).toBeDefined();
    expect(zip['download/Guitar-Composer-Studio.zip']).toBeDefined();
    const html = strFromU8(zip['index.html']);
    expect(html).toMatch(/src="\.\/assets\//);
    const manifest = JSON.parse(strFromU8(zip['manifest.webmanifest']));
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.icons.every((i: { src: string }) => !i.src.startsWith('/'))).toBe(true);
    const info = JSON.parse(strFromU8(zip['portfolio-info.json']));
    expect(info.requiresAccount).toBe(false);
    expect(info.requiresOllama).toBe(false);
  });
});
