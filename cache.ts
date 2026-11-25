// The library kept in memory for the whole site (light list: no pictures).
// Loaded in the background as soon as any page opens, so the library shows at once.
import type { CardSummary, FolderRecord } from "./db";
import { accountEmail, listCards, listFolders } from "./storage";
import { supabase } from "../cloud/supabase";

export type LibrarySnapshot = {
  cards: CardSummary[];
  folders: FolderRecord[];
  email: string | null;
  at: number;
};

// several triggers at once (page open, sign-in event, sidebar) reload only once
const FRESH_MS = 3000;

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

// Loads the library from the browser or the account.
// force = true always asks the server (used after saves).
export function refreshLibrary(options: { force?: boolean } = {}): Promise<LibrarySnapshot> {
  if (!options.force && snapshot && Date.now() - snapshot.at < FRESH_MS) return Promise.resolve(snapshot);
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

// Changes shown at once; the server is updated by the caller, and reloads only if it fails.
export function patchCard(id: string, patch: Partial<CardSummary>): void {
  if (!snapshot) return;
  snapshot = {
    ...snapshot,
    cards: snapshot.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
  notify();
}

export function removeCardFromCache(id: string): void {
  if (!snapshot) return;
  snapshot = { ...snapshot, cards: snapshot.cards.filter((c) => c.id !== id) };
  notify();
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
    refreshLibrary({ force: event === "SIGNED_IN" || event === "SIGNED_OUT" }).catch(() => {});
  });
}
