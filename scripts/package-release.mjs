import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
const root = fileURLToPath(new URL('../', import.meta.url));
const info = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const release = path.join(root, 'release'),
  dist = path.join(root, 'dist');
await mkdir(release, { recursive: true });
await mkdir(path.join(dist, 'download'), { recursive: true });
// Fixed archive timestamps make identical releases reproducible; not a build-date field.
const entry = (bytes) => [bytes, { mtime: new Date(2020, 0, 1, 0, 0, 0) }];
const html = new Uint8Array(
  await readFile(path.join(root, 'portable/Guitar-Composer-Studio.html')),
);
const readme = `GUITAR COMPOSER STUDIO ${info.version} - PORTFOLIO EDITION\n\n1. Extract this ZIP completely.\n2. Open index.html in Edge, Chrome or another modern desktop browser.\n3. Choose Demo complet for an original, locally generated composition.\n\nNo ChatGPT account, Ollama, Node.js, terminal or API key is required.\nThe default composition advisor uses music rules, not an AI language model.\nExternal AI is optional and uses your own provider setup.\n\nProjects are local to this browser. Export .gcsbundle backups to transfer them.\nFor iPhone, use the published HTTPS website and Add to Home Screen in Safari.\nMicrophone capture requires browser permission and supported browser APIs.\nThis browser edition does not provide native ASIO access.\n`;
const portable = zipSync(
  { 'index.html': entry(html), 'README.txt': entry(strToU8(readme)) },
  { level: 9 },
);
await writeFile(path.join(release, 'Guitar-Composer-Studio.zip'), portable);
await copyFile(
  path.join(release, 'Guitar-Composer-Studio.zip'),
  path.join(dist, 'download/Guitar-Composer-Studio.zip'),
);
await writeFile(path.join(dist, '.nojekyll'), '');
await writeFile(
  path.join(dist, 'portfolio-info.json'),
  JSON.stringify(
    {
      name: 'Guitar Composer Studio',
      version: info.version,
      requiresAccount: false,
      requiresOllama: false,
      externalAi: 'optional',
      projectStorage: 'browser-local',
    },
    null,
    2,
  ) + '\n',
);
async function files(folder, prefix = '') {
  const output = {};
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + item.name,
      p = path.join(folder, item.name);
    if (item.isDirectory()) Object.assign(output, await files(p, name + '/'));
    else if (item.isFile()) output[name] = entry(new Uint8Array(await readFile(p)));
  }
  return output;
}
await writeFile(
  path.join(release, 'Guitar-Composer-Studio-Web.zip'),
  zipSync(await files(dist), { level: 9 }),
);
console.log(`Portfolio release ${info.version}: standalone ZIP and deploy-ready Web ZIP.`);
