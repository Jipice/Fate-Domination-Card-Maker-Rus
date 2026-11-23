"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FaFolder, FaFolderPlus, FaArrowUp } from "react-icons/fa";
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
import { PAGE_INFO } from "./library";
import { supabase } from "../cloud/supabase";

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
const dangerClass = "import-export-button bg-gray-700 hover:bg-red-800 justify-center";

// what a dragged item carries: a card or a folder
const CARD_DRAG = "application/x-library-card";
const FOLDER_DRAG = "application/x-library-folder";

// the folder itself and every folder inside it, at any depth
function subtreeIds(id: string, folders: FolderRecord[]): Set<string> {
  const ids = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const f of folders) {
      if ((f.parentId ?? null) === current && !ids.has(f.id)) {
        ids.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return ids;
}

// all folders with their depth, for the "Папка" dropdowns
function flatFolders(folders: FolderRecord[]): { folder: FolderRecord; depth: number }[] {
  const out: { folder: FolderRecord; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    const kids = folders
      .filter((f) => (f.parentId ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    for (const folder of kids) {
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
  // null = the library root, otherwise the id of the open folder
  const [current, setCurrent] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | PageKey>("all");
  const [sort, setSort] = useState<SortKey>("date-desc");
  // undefined = still checking the sign-in state, so we do not show "log in" by mistake
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);

  // Sign-in state first (it is local and fast), then cards and folders together.
  // A newer reload makes older answers be ignored.
  const reload = async () => {
    const id = ++requestId.current;
    try {
      const email = await accountEmail();
      if (id !== requestId.current) return;
      setAccount(email);
      const [list, fl] = await Promise.all([listCards(), listFolders()]);
      if (id !== requestId.current) return;
      setCards(list);
      setFolders(fl);
      setLoaded(true);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoaded(true);
      setMessage(err instanceof Error ? `Не удалось загрузить библиотеку: ${err.message}` : "Не удалось загрузить библиотеку");
    }
  };

  useEffect(() => {
    reload();
    // reload when the user signs in or out
    const { data } = supabase.auth.onAuthStateChange(() => {
      reload();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folderById = (id: string | null) => folders.find((f) => f.id === id);

  // path from the root to the open folder, for the breadcrumbs
  const path = useMemo(() => {
    const chain: FolderRecord[] = [];
    let id = current;
    while (id) {
      const f = folderById(id);
      if (!f) break;
      chain.unshift(f);
      id = f.parentId ?? null;
    }
    return chain;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, folders]);

  // folders shown in the open place
  const subfolders = useMemo(
    () =>
      folders
        .filter((f) => (f.parentId ?? null) === current)
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [folders, current],
  );

  // cards that belong to the open place (not to a subfolder)
  const visible = useMemo(() => {
    const list = cards.filter(
      (c) => (c.folderId ?? null) === current && (typeFilter === "all" || c.page === typeFilter),
    );
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
  }, [cards, current, typeFilter, sort]);

  // number of cards in a folder, including its subfolders
  const countIn = (id: string) => {
    const ids = subtreeIds(id, folders);
    return cards.filter((c) => c.folderId && ids.has(c.folderId)).length;
  };

  const flat = useMemo(() => flatFolders(folders), [folders]);

  // ---- folders

  const createFolder = async () => {
    const name = window.prompt(
      current ? `Новая папка внутри «${folderById(current)?.name}»:` : "Новая папка:",
    )?.trim();
    if (!name) return;
    await putFolder({ id: crypto.randomUUID(), name, createdAt: Date.now(), parentId: current });
    reload();
  };

  const renameFolder = async (folder: FolderRecord) => {
    const name = window.prompt("Новое название папки:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    await putFolder({ ...folder, name });
    reload();
  };

  const removeFolder = async (folder: FolderRecord) => {
    if (!window.confirm(`Удалить папку «${folder.name}» и все папки внутри? Карты переедут в корень библиотеки.`)) return;
    // step out of the folder first if it is the one being deleted
    if (current && subtreeIds(folder.id, folders).has(current)) setCurrent(folder.parentId ?? null);
    await deleteFolder(folder.id);
    reload();
  };

  // ---- moving things

  const moveCardTo = async (cardId: string, folderId: string | null) => {
    await moveCard(cardId, folderId);
    reload();
  };

  // a folder can go into another folder, but never into itself or into its own subfolders
  const moveFolderTo = async (folderId: string, targetId: string | null) => {
    if (targetId && subtreeIds(folderId, folders).has(targetId)) {
      setMessage("Папку нельзя положить саму в себя или в её подпапку.");
      return;
    }
    await moveFolder(folderId, targetId);
    reload();
  };

  const dropOn = (e: DragEvent, targetId: string | null) => {
    e.preventDefault();
    setDropTarget(null);
    const cardId = e.dataTransfer.getData(CARD_DRAG);
    const folderId = e.dataTransfer.getData(FOLDER_DRAG);
    if (cardId) moveCardTo(cardId, targetId);
    if (folderId) moveFolderTo(folderId, targetId);
  };

  const allowDrop = (e: DragEvent, targetId: string | null) => {
    e.preventDefault();
    setDropTarget(targetId ?? "root");
  };

  // ---- cards

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
          folderId: current,
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

  // ---- render

  const tileClass = (highlight: boolean) =>
    `flex flex-col items-center gap-1 w-36 p-2 rounded border cursor-pointer select-none ${
      highlight ? "border-yellow-400 bg-blue-900" : "border-transparent hover:bg-blue-900/60"
    }`;

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Библиотека Карт</h1>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} onClick={createFolder}>
            <FaFolderPlus />
            Новая папка
          </button>
          <button className={buttonClass} onClick={() => fileInput.current?.click()}>
            Импорт JSON
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" multiple onChange={importFiles} className="hidden" />
        </div>
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

      {/* breadcrumbs: every part is a drop target too */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          onDragOver={(e) => allowDrop(e, null)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => dropOn(e, null)}
          onClick={() => setCurrent(null)}
          className={`px-2 py-1 rounded ${dropTarget === "root" ? "ring-2 ring-yellow-400" : ""} ${current === null ? "bg-blue-500" : "hover:bg-blue-900"}`}
        >
          Библиотека
        </button>
        {path.map((f) => (
          <span key={f.id} className="flex items-center gap-1">
            <span>›</span>
            <button
              onDragOver={(e) => allowDrop(e, f.id)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => dropOn(e, f.id)}
              onClick={() => setCurrent(f.id)}
              className={`px-2 py-1 rounded ${dropTarget === f.id ? "ring-2 ring-yellow-400" : ""} ${f.id === current ? "bg-blue-500" : "hover:bg-blue-900"}`}
            >
              {f.name}
            </button>
          </span>
        ))}
        {current && (
          <button
            className="ml-2 px-2 py-1 rounded hover:bg-blue-900 flex items-center gap-1"
            onClick={() => setCurrent(folderById(current)?.parentId ?? null)}
          >
            <FaArrowUp /> Вверх
          </button>
        )}
      </div>

      {message && <p className="italic">{message}</p>}

      {/* folders as tiles, like in Explorer */}
      <div className="flex flex-wrap gap-2">
        {subfolders.map((folder) => (
          <div
            key={folder.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(FOLDER_DRAG, folder.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => allowDrop(e, folder.id)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => dropOn(e, folder.id)}
            onDoubleClick={() => setCurrent(folder.id)}
            onClick={() => setCurrent(folder.id)}
            className={tileClass(dropTarget === folder.id)}
          >
            <FaFolder size={56} className="text-yellow-400" />
            <span className="text-sm text-center truncate w-full" title={folder.name}>{folder.name}</span>
            <span className="text-xs text-gray-400">{countIn(folder.id)} карт</span>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button className="text-xs underline text-blue-300" onClick={() => renameFolder(folder)}>
                Переименовать
              </button>
              <button className="text-xs underline text-red-300" onClick={() => removeFolder(folder)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
        {!loaded && <p className="italic text-gray-400">Загружаем карты…</p>}
        {loaded && subfolders.length === 0 && visible.length === 0 && (
          <p className="italic text-gray-400">
            Здесь пусто. Создайте папку сверху или перетащите сюда карты из другой папки.
          </p>
        )}
      </div>

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

      {/* cards of the open place: drag them onto a folder or a breadcrumb */}
      <ul className="flex flex-col gap-2">
        {visible.map((record) => (
          <li
            key={record.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(CARD_DRAG, record.id);
              e.dataTransfer.effectAllowed = "move";
            }}
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
                  {PAGE_INFO[record.page].label} · {new Date(record.savedAt).toLocaleString("ru-RU")}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Папка карты"
                value={record.folderId ?? ""}
                onChange={(e) => moveCardTo(record.id, e.target.value || null)}
              >
                <option value="">Корень библиотеки</option>
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
              <button className={dangerClass} onClick={() => removeRecord(record)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LibraryPage;
