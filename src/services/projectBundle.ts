import { parseProject, validateProject, type Project } from '../core/project';
import { getAsset, loadChat, putAsset, saveChat, deleteMedia, type ChatEntry } from './mediaStore';
const MAX = 256_000_000;
async function digest(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export function audioAssetIds(project: Project): string[] {
  return [
    ...new Set(
      [project, ...project.revisions.map((r) => r.arrangement)].flatMap((p) =>
        p.audio.assets.map((a) => a.id),
      ),
    ),
  ];
}
export async function exportBundle(project: Project): Promise<Blob> {
  const blobs: Blob[] = [],
    files: { id: string; bytes: number; sha256: string }[] = [];
  let total = 0;
  for (const id of audioAssetIds(project)) {
    const blob = await getAsset(project.id, id);
    total += blob.size;
    if (total > MAX)
      throw new Error(
        'Backup-ul depășește 256 MB. Descarcă sursele WAV, golește istoricul dacă nu mai ai nevoie de el sau împarte proiectul în sesiuni mai mici.',
      );
    blobs.push(blob);
    files.push({ id, bytes: blob.size, sha256: await digest(blob) });
  }
  const chat = await loadChat(project.id);
  const json = new TextEncoder().encode(
    JSON.stringify({ format: 'GCSB', version: 1, project: validateProject(project), files, chat }),
  );
  if (json.length > 8_000_000) throw new Error('Metadatele backup-ului depășesc 8 MB.');
  const header = new Uint8Array(8);
  header.set([71, 67, 83, 66]);
  new DataView(header.buffer).setUint32(4, json.length, true);
  return new Blob([header, json, ...blobs], { type: 'application/octet-stream' });
}
export async function importBundle(file: File): Promise<Project> {
  if (file.size > MAX + 8_000_008) throw new Error('Backup prea mare (maximum 264 MB).');
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (header.length !== 8 || String.fromCharCode(...header.slice(0, 4)) !== 'GCSB')
    throw new Error('Backup audio invalid.');
  const length = new DataView(header.buffer).getUint32(4, true);
  if (length > 8_000_000 || length < 2 || length + 8 > file.size)
    throw new Error('Metadate de backup invalide.');
  const manifest = JSON.parse(await file.slice(8, 8 + length).text());
  if (
    manifest.format !== 'GCSB' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 4096
  )
    throw new Error('Format de backup incompatibil.');
  const project = parseProject(JSON.stringify(manifest.project));
  const required = new Set(audioAssetIds(project)),
    seen = new Set<string>();
  let offset = 8 + length;
  const parts: { id: string; blob: Blob }[] = [];
  for (const entry of manifest.files) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      !required.has(entry.id) ||
      seen.has(entry.id) ||
      !Number.isInteger(entry.bytes) ||
      entry.bytes < 44 ||
      entry.bytes > 64_000_000 ||
      offset + entry.bytes > file.size
    )
      throw new Error('Index audio invalid în backup.');
    const blob = file.slice(offset, offset + entry.bytes, 'audio/wav');
    const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (
      String.fromCharCode(...signature.slice(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...signature.slice(8, 12)) !== 'WAVE'
    )
      throw new Error('Sursă WAV invalidă în backup.');
    if (
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      (await digest(blob)) !== entry.sha256
    )
      throw new Error('Integritatea sursei audio nu corespunde backup-ului (SHA-256).');
    parts.push({ id: entry.id, blob });
    seen.add(entry.id);
    offset += entry.bytes;
  }
  if (offset !== file.size || seen.size !== required.size)
    throw new Error('Backup incomplet sau date suplimentare nepermise.');
  const id = crypto.randomUUID();
  try {
    for (const part of parts) await putAsset(id, part.id, part.blob);
    if (Array.isArray(manifest.chat))
      await saveChat(
        id,
        manifest.chat.filter(
          (m: ChatEntry) =>
            m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string',
        ),
      );
  } catch (e) {
    await deleteMedia(id).catch(() => {});
    throw e;
  }
  return { ...project, id, updatedAt: new Date().toISOString() };
}
