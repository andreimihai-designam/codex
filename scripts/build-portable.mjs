import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// A distribution for opening directly from disk. No service worker or server.
// The normal production build remains the installable HTTPS PWA.
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  root,
  configFile: false,
  plugins: [
    {
      name: 'portable-no-service-worker',
      resolveId(id) {
        if (id === 'virtual:pwa-register') return '\0portable-sw';
      },
      load(id) {
        if (id === '\0portable-sw')
          return 'export function registerSW() { return () => Promise.resolve(); }';
      },
    },
  ],
  build: {
    write: false,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const bundle = Array.isArray(result) ? result[0] : result;
if (!('output' in bundle)) throw new Error('Unexpected bundler output.');
const htmlAsset = bundle.output.find(
  (file) => file.type === 'asset' && file.fileName === 'index.html',
);
const scripts = bundle.output.filter((file) => file.type === 'chunk');
const styles = bundle.output.filter(
  (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
);
if (!htmlAsset || scripts.length !== 1 || !styles.length)
  throw new Error('Portable build requires one self-contained script and styles.');
let html = String(htmlAsset.source)
  .replace('<html lang="ro">', '<html lang="ro" data-portable>')
  .replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/gi, '')
  .replace(/<link\b[^>]*>/gi, '');
const css = styles
  .map((file) => String(file.source))
  .join('\n')
  .replace(/<\/style/gi, '<\\/style');
const js = scripts[0].code.replace(/<\/script/gi, '<\\/script');
html = html
  .replace('</head>', `<style>${css}</style></head>`)
  .replace('</body>', `<script type="module">${js}</script></body>`);
html = html.replace(/^[\t ]+$/gm, '');
await mkdir(new URL('../portable/', import.meta.url), { recursive: true });
await writeFile(new URL('../portable/Guitar-Composer-Studio.html', import.meta.url), html);
console.log('Portable application: portable/Guitar-Composer-Studio.html');
