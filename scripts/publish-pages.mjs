/** Publish only built public assets. Does not change source checkout/index or repository visibility. */
import { mkdtemp, rm, access, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root = fileURLToPath(new URL('../', import.meta.url)),
  dist = path.join(root, 'dist');
await access(path.join(dist, 'portfolio-info.json'));
await access(path.join(dist, 'download/Guitar-Composer-Studio.zip'));
const git = (args, options = {}) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
const dir = await mkdtemp(path.join(os.tmpdir(), 'gcs-pages-'));
try {
  const check = process.argv.includes('--dry-run');
  const probe = check
    ? { status: 2, stderr: '' }
    : spawnSync('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/gh-pages'], {
        cwd: root,
        encoding: 'utf8',
      });
  if (probe.status !== 0 && probe.status !== 2)
    throw new Error('Cannot read deployment branch: ' + probe.stderr);
  const parents = [];
  if (probe.status === 0) {
    git(['fetch', 'origin', 'gh-pages']);
    let previous;
    try {
      previous = JSON.parse(git(['show', 'FETCH_HEAD:portfolio-info.json']));
    } catch {
      throw new Error(
        'Existing gh-pages is not a recognized Guitar Composer Studio deployment. Refusing to overwrite it.',
      );
    }
    if (previous.name !== 'Guitar Composer Studio')
      throw new Error('Existing gh-pages belongs to another site.');
    if (git(['ls-tree', '--name-only', 'FETCH_HEAD', 'CNAME']) === 'CNAME')
      await writeFile(path.join(dist, 'CNAME'), git(['show', 'FETCH_HEAD:CNAME']) + '\n');
    parents.push('-p', git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}']));
  }
  const env = { ...process.env, GIT_INDEX_FILE: path.join(dir, 'index') };
  git(['read-tree', '--empty'], { env });
  git(['--work-tree=' + dist, 'add', '--all', '--force'], { env, cwd: dist });
  const tree = git(['write-tree'], { env });
  if (check) {
    console.log('Deployment files:\n' + git(['ls-tree', '-r', '--name-only', tree]));
    console.log('Dry run: no commit or push performed.');
  } else {
    const source = git(['rev-parse', 'HEAD']);
    const commit = git(
      [
        '-c',
        'user.name=Codex',
        '-c',
        'user.email=codex@localhost',
        'commit-tree',
        tree,
        ...parents,
      ],
      { input: `Publish Guitar Composer Studio portfolio from ${source}\n` },
    );
    execFileSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], {
      cwd: root,
      stdio: 'inherit',
    });
    console.log(
      'Built site pushed to gh-pages. In GitHub Settings → Pages choose Deploy from a branch → gh-pages → / (root).',
    );
    console.log('This command does not enable Pages or establish that a public URL is live.');
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
