import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(
  new URL('../portable/Guitar-Composer-Studio.html', import.meta.url),
  'utf8',
);
describe('shipped portable document', () => {
  it('contains complete parseable inline scripts rather than replacement-expanded HTML', () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    expect(scripts).toHaveLength(2); // launcher and self-contained application
    for (const script of scripts) expect(() => new Script(script[1])).not.toThrow();
    expect(scripts[1][1]).not.toContain('</body>');
    expect(html.match(/<\/body>/gi)).toHaveLength(1);
  });
  it('ships styles and application code without external script/style fetches or redirect loops', () => {
    expect(html).toMatch(/<html[^>]*data-portable/);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<script[^>]+\bsrc\s*=/i);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/i);
    expect(html.length).toBeGreaterThan(100_000);
  });
});
