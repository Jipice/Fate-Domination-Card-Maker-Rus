// The library kept in memory for the whole site.
// It is loaded in the background as soon as any page opens (the sidebar is on every page),
// so the library page shows the last known cards at once and refreshes them quietly.
import type { CardRecord, FolderRecord } from "./db";
import { accountEmail, listCards, listFolders } from "./storage";
import { supabase } from "../cloud/supabase";

export type LibrarySnapshot = {
  cards: CardRecord[];
  folders: FolderRecord[];
  email: string | null;
  at: number;
};

let snapshot: LibrarySnapshot | null = null;
let inflight: Promise<LibrarySnapshot> | null = null;
let watching = false;
const listeners = new Set<(s: LibrarySnapshot | null) => void>();

const notify = () => {
  for (const fn of listeners) fn(snapshot);
};

export const getSnapshot = (): LibrarySnapshot | null => snapshot;

export function subscribeLibrary(fn: (s: LibrarySnapshot | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Loads the library from the browser or the account. Two calls at the same time share one request.
export function refreshLibrary(): Promise<LibrarySnapshot> {
  if (inflight) return inflight;
  inflight = (async () => {
    const email = await accountEmail();
    const [cards, folders] = await Promise.all([listCards(), listFolders()]);
    const fresh: LibrarySnapshot = { cards, folders, email, at: Date.now() };
    snapshot = fresh;
    notify();
    return fresh;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function clearLibraryCache(): void {
  snapshot = null;
  notify();
}

// Keeps the cache in step with sign-in and sign-out. Started once, from the sidebar.
export function watchLibraryAuth(): void {
  if (watching) return;
  watching = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") clearLibraryCache();
    refreshLibrary().catch(() => {});
  });
}
