"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FaChevronDown,
  FaChevronRight,
  FaFolder,
  FaFolderPlus,
} from "react-icons/fa";
import type { CardRecord, FolderRecord, PageKey } from "./db";
import {
  deleteCard,
  deleteFolder,
  listCards,
  listFolders,
  moveCard,
  moveFolder,
  putCard,
  putFolder,
  accountEmail,
} from "./storage";
import { supabase } from "../cloud/supabase";
import { PAGE_INFO } from "./library";

type Selection = "all" | "none" | string; // string = folder id

type SortKey = "date-desc" | "date-asc" | "name" | "type";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Сначала новые" },
  { value: "date-asc", label: "Сначала старые" },
  { value: "name", label: "По названию" },
  { value: "type", label: "По типу" },
];

const TYPE_FILTERS: { value: "all" | PageKey; label: string }[] = [
  { value: "all", label: "Все типы" },
  ...(Object.keys(PAGE_INFO) as PageKey[]).map((key) => ({
    value: key,
    label: PAGE_INFO[key].label,
  })),
];

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";

// ---- folder tree helpers

// children of every folder, sorted by name; key null = root
function childrenMap(folders: FolderRecord[]): Map<string | null, FolderRecord[]> {
  const map = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    map.set(key, [...(map.get(key) ?? []), folder]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  return map;
}

// the folder itself and every folder inside it, at any depth
function subtreeIds(id: string, folders: FolderRecord[]): Set<string> {
  const children = childrenMap(folders);
  const ids = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of children.get(current) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return ids;
}

// all folders in tree order with their depth (used for the "Папка" dropdowns)
function flatFolders(folders: FolderRecord[]): { folder: FolderRecord; depth: number }[] {
  const children = childrenMap(folders);
  const out: { folder: FolderRecord; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}


// Accepts a library export ({ record: {...} }), a plain library record,
// or a card saved from the editor's "Сохранить" button (just the form).
function parseImport(data: unknown): {
  page: PageKey;
  name: string;
  form: Record<string, unknown>;
  thumbnail: string | null;
} | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const record = (obj.record ?? obj) as Record<string, unknown>;

  if (typeof record.page === "string" && record.page in PAGE_INFO && record.form && typeof record.form === "object") {
    const page = record.page as PageKey;
    return {
      page,
      name: String(record.name || PAGE_INFO[page].label),
      form: record.form as Record<string, unknown>,
      thumbnail: typeof record.thumbnail === "string" ? record.thumbnail : null,
    };
  }

  // editor JSON: the form itself
  if ("cardToMake" in record) {
    const page: PageKey = record.cardToMake === "servant" ? "servant-card" : "master-card";
    const name = String(record.masterName || record.name || PAGE_INFO[page].label);
    return { page, name, form: record, thumbnail: null };
  }
  return null;
}

const LibraryPage = () => {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [selection, setSelection] = useState<Selection>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<"all" | PageKey>("all");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // undefined = still checking the sign-in state, so we do not show "log in" by mistake
  const [account, setAccount] = useState<string | null | undefined>(undefined);

  const reload = async () => {
    setCards(await listCards());
    setFolders(await listFolders());
    setAccount(await accountEmail());
  };

  useEffect(() => {
    reload();
    // reload when the user signs in or out
    const { data } = supabase.auth.onAuthStateChange(() => {
      reload();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const children = useMemo(() => childrenMap(folders), [folders]);
  const flat = useMemo(() => flatFolders(folders), [folders]);
  const activeFolder = folders.find((f) => f.id === selection);

  // card counts per folder, including cards in subfolders
  const totals = useMemo(() => {
    const result = new Map<string, number>();
    for (const folder of folders) {
      const ids = subtreeIds(folder.id, folders);
      result.set(folder.id, cards.filter((c) => c.folderId && ids.has(c.folderId)).length);
    }
    return result;
  }, [cards, folders]);

  const visible = useMemo(() => {
    const inFolder = (card: CardRecord) => {
      if (selection === "all") return true;
      if (selection === "none") return !card.folderId;
      return subtreeIds(selection, folders).has(card.folderId ?? "");
    };
    const list = cards.filter((c) => inFolder(c) && (typeFilter === "all" || c.page === typeFilter));
    switch (sort) {
      case "date-desc":
        return list.sort((a, b) => b.savedAt - a.savedAt);
      case "date-asc":
        return list.sort((a, b) => a.savedAt - b.savedAt);
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      case "type":
        return list.sort(
          (a, b) =>
            PAGE_INFO[a.page].label.localeCompare(PAGE_INFO[b.page].label, "ru") ||
            b.savedAt - a.savedAt,
        );
    }
  }, [cards, folders, selection, typeFilter, sort]);

  // ---- folders

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createFolder = async () => {
    const name = window.prompt(
      activeFolder ? `Новая папка внутри «${activeFolder.name}»:` : "Новая папка:",
    )?.trim();
    if (!name) return;
    await putFolder({
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      parentId: activeFolder ? activeFolder.id : null,
    });
    if (activeFolder) setCollapsed((prev) => { const n = new Set(prev); n.delete(activeFolder.id); return n; });
    reload();
  };

  const renameFolder = async (folder: FolderRecord) => {
    const name = window.prompt("Новое название папки:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    await putFolder({ ...folder, name });
    reload();
  };

  const changeParent = async (folder: FolderRecord, parentId: string | null) => {
    await moveFolder(folder.id, parentId);
    reload();
  };

  const removeFolder = async (folder: FolderRecord) => {
    if (!window.confirm(`Удалить папку «${folder.name}» и все папки внутри? Карты переедут в «Без папки».`)) return;
    await deleteFolder(folder.id);
    setSelection("all");
    reload();
  };

  // ---- cards

  const moveTo = async (cardId: string, folderId: string | null) => {
    await moveCard(cardId, folderId);
    reload();
  };

  const onDragStart = (e: DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropOnFolder = (e: DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDropTarget(null);
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) moveTo(cardId, folderId);
  };

  const exportRecord = (record: CardRecord) => {
    const blob = new Blob(
      [JSON.stringify({ format: "fate-card-library", version: 2, record }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${record.name || "card"}.library.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const removeRecord = async (record: CardRecord) => {
    if (!window.confirm(`Удалить «${record.name}» из библиотеки?`)) return;
    await deleteCard(record.id);
    reload();
  };

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  // Several files at once: each one is added on its own, bad ones are skipped and counted.
  const importFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    let added = 0;
    const skipped: string[] = [];
    for (const file of files) {
      try {
        const parsed = parseImport(JSON.parse(await readFileText(file)));
        if (!parsed) {
          skipped.push(file.name);
          continue;
        }
        await putCard({
          id: crypto.randomUUID(),
          page: parsed.page,
          name: parsed.name,
          savedAt: Date.now(),
          form: parsed.form,
          folderId: null,
          thumbnail: parsed.thumbnail,
        });
        added += 1;
      } catch {
        skipped.push(file.name);
      }
    }

    const parts = [`Добавлено карт: ${added}`];
    if (skipped.length) parts.push(`пропущено: ${skipped.length} (${skipped.join(", ")})`);
    setMessage(parts.join(". "));
    reload();
  };

  // ---- tree rendering

  const rowClass = (active: boolean, over: boolean) =>
    `flex items-center gap-2 px-2 py-1 rounded cursor-pointer select-none ${
      active ? "bg-blue-500" : "hover:bg-blue-900"
    } ${over ? "ring-2 ring-yellow-400" : ""}`;

  const renderFolders = (parent: string | null, depth: number): React.ReactNode =>
    (children.get(parent) ?? []).map((folder) => {
      const hasChildren = (children.get(folder.id) ?? []).length > 0;
      const open = !collapsed.has(folder.id);
      return (
        <div key={folder.id}>
          <div
            className={rowClass(selection === folder.id, dropTarget === folder.id)}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => setSelection(folder.id)}
            onDragOver={(e) => { e.preventDefault(); setDropTarget(folder.id); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => onDropOnFolder(e, folder.id)}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={open ? "Свернуть" : "Развернуть"}
                onClick={(e) => { e.stopPropagation(); toggle(folder.id); }}
                className="w-4 shrink-0 flex items-center justify-center"
              >
                {open ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <FaFolder className="shrink-0" />
            <span className="truncate flex-1">{folder.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{totals.get(folder.id) ?? 0}</span>
          </div>
          {hasChildren && open && renderFolders(folder.id, depth + 1)}
        </div>
      );
    });

  // folders that can become the parent of the active folder (not itself, not its own subfolders)
  const parentOptions = activeFolder
    ? flat.filter(({ folder }) => !subtreeIds(activeFolder.id, folders).has(folder.id))
    : [];

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Библиотека карт</h1>
        <button className={buttonClass} onClick={() => fileInput.current?.click()}>
          Импорт JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          multiple
          onChange={importFiles}
          className="hidden"
        />
      </div>

      <p className="text-sm">
        {account === undefined ? (
          <>Проверяем вход…</>
        ) : account ? (
          <>Карты в аккаунте <b>{account}</b>. Они доступны с любого устройства.</>
        ) : (
          <>Карты сохранены в этом браузере. <Link href="/account" className="underline text-blue-300">Войдите</Link>, чтобы хранить их в аккаунте.</>
        )}
      </p>
      {message && <p className="italic">{message}</p>}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Folder tree */}
        <aside className="w-full md:w-72 shrink-0 flex flex-col gap-2 border border-black rounded p-2 bg-primary-dark-blue">
          <div
            className="max-h-[60vh] overflow-y-auto flex flex-col gap-0.5 pr-1"
          >
            <div
              className={rowClass(selection === "all", false)}
              onClick={() => setSelection("all")}
            >
              <span className="w-4 shrink-0" />
              <span className="truncate flex-1">Все карты</span>
              <span className="text-xs text-gray-400">{cards.length}</span>
            </div>
            <div
              className={rowClass(selection === "none", dropTarget === "none")}
              onClick={() => setSelection("none")}
              onDragOver={(e) => { e.preventDefault(); setDropTarget("none"); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDropOnFolder(e, null)}
            >
              <span className="w-4 shrink-0" />
              <span className="truncate flex-1">Без папки</span>
              <span className="text-xs text-gray-400">{cards.filter((c) => !c.folderId).length}</span>
            </div>
            <div className="border-t border-gray-600 my-1" />
            {folders.length === 0 && (
              <p className="text-sm text-gray-400 px-2 py-1">Папок пока нет</p>
            )}
            {renderFolders(null, 0)}
          </div>

          <button className={buttonClass} onClick={createFolder}>
            <FaFolderPlus />
            Новая папка
          </button>
          <p className="text-xs text-gray-400">
            {activeFolder ? `Создастся внутри «${activeFolder.name}»` : "Создастся в корне"}
          </p>

          {activeFolder && (
            <div className="flex flex-col gap-2 border-t border-gray-600 pt-2">
              <button className={buttonClass} onClick={() => renameFolder(activeFolder)}>
                Переименовать
              </button>
              <div className="flex flex-col gap-1">
                <label htmlFor="folderParent" className="field-header">Положить в</label>
                <select
                  id="folderParent"
                  value={activeFolder.parentId ?? ""}
                  onChange={(e) => changeParent(activeFolder, e.target.value || null)}
                >
                  <option value="">Корень</option>
                  {parentOptions.map(({ folder, depth }) => (
                    <option key={folder.id} value={folder.id}>
                      {"· ".repeat(depth)}{folder.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="import-export-button bg-gray-700 hover:bg-red-800"
                onClick={() => removeFolder(activeFolder)}
              >
                Удалить папку
              </button>
            </div>
          )}
        </aside>

        {/* Cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="libraryType" className="field-header">Тип</label>
              <select id="libraryType" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | PageKey)}>
                {TYPE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="librarySort" className="field-header">Сортировка</label>
              <select id="librarySort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {visible.length === 0 && (
            <p className="italic text-gray-400">
              Здесь пока пусто. Нажмите «В библиотеку» на любой странице редактора или перетащите карту сюда.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {visible.map((record) => (
              <li
                key={record.id}
                draggable
                onDragStart={(e) => onDragStart(e, record.id)}
                className="flex flex-wrap items-center justify-between gap-3 border border-black rounded p-3 bg-primary-dark-blue cursor-grab"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {record.thumbnail ? (
                    <img src={record.thumbnail} alt="" className="w-16 h-auto rounded border border-black shrink-0" />
                  ) : (
                    <div className="w-16 h-24 rounded border border-dashed border-gray-500 shrink-0 flex items-center justify-center text-xs text-gray-500 text-center">
                      нет превью
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold truncate">{record.name}</span>
                    <span className="text-sm text-gray-400">
                      {PAGE_INFO[record.page].label}
                      {" · "}
                      {new Date(record.savedAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Папка карты"
                    value={record.folderId ?? ""}
                    onChange={(e) => moveTo(record.id, e.target.value || null)}
                  >
                    <option value="">Без папки</option>
                    {flat.map(({ folder, depth }) => (
                      <option key={folder.id} value={folder.id}>
                        {"· ".repeat(depth)}{folder.name}
                      </option>
                    ))}
                  </select>
                  <Link href={`${PAGE_INFO[record.page].path}?library=${record.id}`} className={buttonClass}>
                    Открыть
                  </Link>
                  <button className={buttonClass} onClick={() => exportRecord(record)}>
                    Экспорт
                  </button>
                  <button className="import-export-button bg-gray-700 hover:bg-red-800" onClick={() => removeRecord(record)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LibraryPage;
