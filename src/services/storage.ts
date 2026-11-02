import { validateProject, type Project } from '../core/project';
const DB_NAME = 'guitar-composer-studio';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('projects', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', mode);
    const req = operation(tx.objectStore('projects'));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error ?? req.error ?? new Error('Salvarea locală a eșuat.'));
    };
  });
}
export async function saveProject(project: Project) {
  await transaction('readwrite', (s) => s.put(validateProject(project)));
}
export async function listProjects(): Promise<Project[]> {
  const values = await transaction('readonly', (s) => s.getAll());
  return values.map(validateProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function deleteProject(id: string) {
  await transaction('readwrite', (s) => s.delete(id));
}
