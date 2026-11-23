import { supabase } from "./supabase";
import type { CardRecord, FolderRecord, PageKey } from "../library/db";
import * as local from "../library/db";

type CardRow = {
  id: string;
  page: PageKey;
  name: string;
  form: Record<string, unknown>;
  thumbnail: string | null;
  folder_id: string | null;
  saved_at: number;
};

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

const toCard = (r: CardRow): CardRecord => ({
  id: r.id,
  page: r.page,
  name: r.name,
  form: r.form,
  thumbnail: r.thumbnail,
  folderId: r.folder_id,
  savedAt: Number(r.saved_at),
});

const fromCard = (c: CardRecord) => ({
  id: c.id,
  page: c.page,
  name: c.name,
  form: c.form,
  thumbnail: c.thumbnail ?? null,
  folder_id: c.folderId ?? null,
  saved_at: c.savedAt,
});

const toFolder = (r: FolderRow): FolderRecord => ({
  id: r.id,
  name: r.name,
  parentId: r.parent_id,
  createdAt: new Date(r.created_at).getTime(),
});

const fromFolder = (f: FolderRecord) => ({
  id: f.id,
  name: f.name,
  parent_id: f.parentId ?? null,
  created_at: new Date(f.createdAt).toISOString(),
});

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---- cards

export async function cloudListCards(): Promise<CardRecord[]> {
  const rows = check(await supabase.from("cards").select("*"));
  return (rows as CardRow[]).map(toCard);
}

export async function cloudGetCard(id: string): Promise<CardRecord | undefined> {
  const row = check(await supabase.from("cards").select("*").eq("id", id).maybeSingle());
  return row ? toCard(row as CardRow) : undefined;
}

export async function cloudPutCard(card: CardRecord): Promise<void> {
  check(await supabase.from("cards").upsert(fromCard(card)));
}

export async function cloudDeleteCard(id: string): Promise<void> {
  check(await supabase.from("cards").delete().eq("id", id));
}

export async function cloudMoveCard(id: string, folderId: string | null): Promise<void> {
  check(await supabase.from("cards").update({ folder_id: folderId }).eq("id", id));
}

// ---- folders

export async function cloudListFolders(): Promise<FolderRecord[]> {
  const rows = check(await supabase.from("folders").select("*"));
  return (rows as FolderRow[]).map(toFolder);
}

export async function cloudPutFolder(folder: FolderRecord): Promise<void> {
  check(await supabase.from("folders").upsert(fromFolder(folder)));
}

export async function cloudMoveFolder(id: string, parentId: string | null): Promise<void> {
  check(await supabase.from("folders").update({ parent_id: parentId }).eq("id", id));
}

// Deleting a folder also removes its subfolders; cards in them go to "no folder" (set in SQL).
export async function cloudDeleteFolder(id: string): Promise<void> {
  check(await supabase.from("folders").delete().eq("id", id));
}

// ---- moving the browser library into the account

export async function copyLocalToCloud(): Promise<{ folders: number; cards: number }> {
  const folders = await local.listFolders();
  const cards = await local.listCards();

  // parents first, so every parent_id points to a folder that already exists in the cloud
  const ids = new Set(folders.map((f) => f.id));
  const inserted = new Set<string>();
  const pending = [...folders];
  let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const f = pending[i];
      const parentReady = !f.parentId || !ids.has(f.parentId) || inserted.has(f.parentId);
      if (parentReady) {
        const parentId = f.parentId && ids.has(f.parentId) ? f.parentId : null;
        await cloudPutFolder({ ...f, parentId });
        inserted.add(f.id);
        pending.splice(i, 1);
        progress = true;
      }
    }
  }
  // folders stuck in a loop (should not happen) are put at the root
  for (const f of pending) await cloudPutFolder({ ...f, parentId: null });
  for (const f of pending) inserted.add(f.id);

  for (const card of cards) {
    const folderOk = !card.folderId || inserted.has(card.folderId);
    await cloudPutCard({ ...card, folderId: folderOk ? card.folderId : null });
  }
  return { folders: folders.length, cards: cards.length };
}
