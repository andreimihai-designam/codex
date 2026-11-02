import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const launcher = source.match(/<script id="offline-launcher">([\s\S]*?)<\/script>/)?.[1];
if (!launcher) throw new Error('Missing offline launcher.');

function launch(href: string, portable = false): string | undefined {
  let destination: string | undefined;
  runInNewContext(launcher!, {
    URL,
    window: {
      location: {
        href,
        protocol: new URL(href).protocol,
        replace: (url: string) => {
          destination = url;
        },
      },
    },
    document: { documentElement: { hasAttribute: () => portable } },
  });
  return destination;
}

describe('offline source launcher', () => {
  it('forwards the reported Windows source path to the bundled application', () => {
    expect(launch('file:///D:/Codex/codex-feat-guitar-composer-studio/index.html')).toBe(
      'file:///D:/Codex/codex-feat-guitar-composer-studio/portable/Guitar-Composer-Studio.html',
    );
  });
  it('preserves folders containing spaces', () => {
    expect(launch('file:///C:/Codex%20Projects/Guitar/index.html')).toBe(
      'file:///C:/Codex%20Projects/Guitar/portable/Guitar-Composer-Studio.html',
    );
  });
  it('does not redirect the bundled file or the hosted application', () => {
    expect(launch('file:///D:/Codex/portable/Guitar-Composer-Studio.html', true)).toBeUndefined();
    expect(launch('https://studio.example/index.html')).toBeUndefined();
    expect(launch('http://localhost:5173')).toBeUndefined();
  });
});
