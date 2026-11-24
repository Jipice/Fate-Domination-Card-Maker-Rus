// Хранилище библиотеки в браузере (IndexedDB, без внешних библиотек).
// Версия 2: добавлены папки и поле folderId у карт.

export type PageKey =
  | "master-card"
  | "servant-card"
  | "master-token"
  | "master-standee"
  | "master-box"
  | "command-seal";

export type CardRecord = {
  id: string;
  page: PageKey;
  name: string;
  savedAt: number;
  form: Record<string, unknown>;
  folderId?: string | null; // null / undefined = без папки
  thumbnail?: string | null; // small PNG data URL of the card
};

// a card without its picture and form, used for lists
export type CardSummary = Omit<CardRecord, "form" | "thumbnail">;

export type FolderRecord = {
  id: string;
  name: string;
  createdAt: number;
  parentId?: string | null; // null / undefined = корень
};

const DB_NAME = "fate-card-library";
const VERSION = 2;
const CARDS = "cards";
const FOLDERS = "folders";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CARDS)) {
        db.createObjectStore(CARDS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FOLDERS)) {
        db.createObjectStore(FOLDERS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ---- cards

export async function putCard(record: CardRecord): Promise<void> {
  await run(CARDS, "readwrite", (store) => store.put(record));
}

export async function getCard(id: string): Promise<CardRecord | undefined> {
  return run<CardRecord | undefined>(CARDS, "readonly", (store) => store.get(id));
}

export async function deleteCard(id: string): Promise<void> {
  await run(CARDS, "readwrite", (store) => store.delete(id));
}

export async function listCards(): Promise<CardRecord[]> {
  return run<CardRecord[]>(CARDS, "readonly", (store) => store.getAll());
}

export async function getThumbnail(id: string): Promise<string | null> {
  const record = await getCard(id);
  return record?.thumbnail ?? null;
}

export async function moveCard(id: string, folderId: string | null): Promise<void> {
  const record = await getCard(id);
  if (!record) return;
  await putCard({ ...record, folderId });
}

// ---- folders

export async function listFolders(): Promise<FolderRecord[]> {
  return run<FolderRecord[]>(FOLDERS, "readonly", (store) => store.getAll());
}

export async function putFolder(folder: FolderRecord): Promise<void> {
  await run(FOLDERS, "readwrite", (store) => store.put(folder));
}

export async function moveFolder(id: string, parentId: string | null): Promise<void> {
  const folders = await listFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return;
  await putFolder({ ...folder, parentId });
}

// Deleting a folder removes its subfolders too; their cards go back to "Без папки".
export async function deleteFolder(id: string): Promise<void> {
  const folders = await listFolders();
  const toDelete = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        grew = true;
      }
    }
  }
  const cards = await listCards();
  for (const card of cards) {
    if (card.folderId && toDelete.has(card.folderId)) {
      await putCard({ ...card, folderId: null });
    }
  }
  for (const folderId of toDelete) {
    await run(FOLDERS, "readwrite", (store) => store.delete(folderId));
  }
}
