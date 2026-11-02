/** Separate database: preserves the v1 project DB contract and stores actual audio bytes. */
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('guitar-composer-media', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('assets');
      r.result.createObjectStore('chats');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      r = fn(tx.objectStore(store));
    tx.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error ?? r.error ?? new Error('Stocarea media a eșuat.'));
    };
  });
}
export async function putAsset(projectId: string, assetId: string, blob: Blob) {
  await run('assets', 'readwrite', (s) => s.put(blob, `${projectId}:${assetId}`));
}
export async function getAsset(projectId: string, assetId: string): Promise<Blob> {
  const blob = await run('assets', 'readonly', (s) => s.get(`${projectId}:${assetId}`));
  if (!(blob instanceof Blob))
    throw new Error(
      'Fișier audio lipsă. Importă backup-ul .gcsbundle care conține înregistrările.',
    );
  return blob;
}
export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}
export async function loadChat(projectId: string): Promise<ChatEntry[]> {
  const chat = await run('chats', 'readonly', (s) => s.get(projectId));
  if (!Array.isArray(chat)) return [];
  return chat
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}
export async function saveChat(projectId: string, chat: ChatEntry[]) {
  await run('chats', 'readwrite', (s) =>
    s.put(
      chat.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
      projectId,
    ),
  );
}
export async function deleteMedia(projectId: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['assets', 'chats'], 'readwrite');
    tx.objectStore('chats').delete(projectId);
    const cursor = tx
      .objectStore('assets')
      .openKeyCursor(IDBKeyRange.bound(projectId + ':', projectId + ':\uffff'));
    cursor.onsuccess = () => {
      if (cursor.result) {
        tx.objectStore('assets').delete(cursor.result.key);
        cursor.result.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
