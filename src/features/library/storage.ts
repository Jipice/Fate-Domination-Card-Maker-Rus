// One place the library reads and writes through.
// Signed in: the account in the cloud. Signed out: this browser (IndexedDB).
import { supabase } from "../cloud/supabase";
import * as cloud from "../cloud/cloud";
import * as local from "./db";

export type { CardRecord, CardSummary, FolderRecord, PageKey } from "./db";

async function signedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

// light list: no pictures
export async function listCards(): Promise<local.CardSummary[]> {
  return (await signedIn()) ? cloud.cloudListCards() : local.listCards();
}

// one card in full (form and picture): used when a card is opened or exported
export async function getCard(id: string) {
  return (await signedIn()) ? cloud.cloudGetCard(id) : local.getCard(id);
}

// only the small picture of one card
export async function getThumbnail(id: string): Promise<string | null> {
  return (await signedIn()) ? cloud.cloudGetThumbnail(id) : local.getThumbnail(id);
}

export async function putCard(record: local.CardRecord) {
  return (await signedIn()) ? cloud.cloudPutCard(record) : local.putCard(record);
}

export async function deleteCard(id: string) {
  return (await signedIn()) ? cloud.cloudDeleteCard(id) : local.deleteCard(id);
}

export async function moveCard(id: string, folderId: string | null) {
  return (await signedIn()) ? cloud.cloudMoveCard(id, folderId) : local.moveCard(id, folderId);
}

export async function listFolders() {
  return (await signedIn()) ? cloud.cloudListFolders() : local.listFolders();
}

export async function putFolder(folder: local.FolderRecord) {
  return (await signedIn()) ? cloud.cloudPutFolder(folder) : local.putFolder(folder);
}

export async function moveFolder(id: string, parentId: string | null) {
  return (await signedIn()) ? cloud.cloudMoveFolder(id, parentId) : local.moveFolder(id, parentId);
}

export async function deleteFolder(id: string) {
  return (await signedIn()) ? cloud.cloudDeleteFolder(id) : local.deleteFolder(id);
}

export async function accountEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}
