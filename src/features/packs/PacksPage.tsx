"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../cloud/supabase";
import { CARD_BACK_PRESETS, presetForUrl } from "./cardBacks";
import { Pack, parseTts } from "./parseTts";
import { countNonLinkImages, DEFAULT_FIGURE_BASE, DEFAULT_FIGURE_SCALE, toTts } from "./toTts";
import { makeThumbnail, makeZip } from "./zip";
import { listCards } from "../library/storage";
import type { CardRecord } from "../library/db";

// ---- data shapes

type Item = { id: string; name: string; face: string; back: string | null };
type Category = { id: string; title: string; cards: Item[] };
type Tile = { name: string; image: string };

// the saved form of a pack: used for publishing and for the downloaded .json
type PackData = {
  format: "fate-pack";
  version: 1;
  name: string;
  author: string | null;
  cover?: string | null;
  boxImage?: string | null;
  token: string | null;
  figure: string | null;
  figureBack?: string | null;
  figureBase?: string | null;
  figureScale?: number | null;
  defaultBack?: string | null; // old packs only: it is copied onto the cards without a back when such a pack is opened
  tiles: Tile[];
  categories: { title: string; cards: { name: string; face: string; back: string | null }[] }[];
};

type Loaded = {
  name: string;
  author: string | null;
  cover: string | null;
  boxImage: string | null;
  token: string | null;
  figure: string | null;
  figureBack: string | null;
  figureBase: string;
  figureScale: number;
  tiles: Tile[];
  categories: Category[];
  isPublic: boolean;
  readOnly?: boolean; // opened from the shared list by someone else: view and download only
};

type CloudPack = {
  id: string;
  ownerId: string;
  data: PackData;
  isPublic: boolean;
  createdAt: string;
};

type NewCard = { name: string; face: string; back: string | null };

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";
const dangerClass = "import-export-button bg-gray-700 hover:bg-red-800 justify-center";

// a picture is either a web link or a small picture uploaded from the computer
const isImageSrc = (value: string) => /^https?:\/\//.test(value) || /^data:image\//.test(value);

// largest pack that will be sent to the cloud (uploaded pictures make it heavy)
const MAX_PACK_BYTES = 4_000_000;

// shrinks an uploaded picture so the pack stays small
function resizeImage(file: File, size = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(size / img.width, size / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("не удалось открыть картинку"));
    };
    img.src = url;
  });
}

const totalCards = (l: Loaded) => l.categories.reduce((n, c) => n + c.cards.length, 0);

function emptyPack(): Loaded {
  return {
    name: "Новый пак",
    author: null,
    cover: null,
    boxImage: null,
    token: null,
    figure: null,
    figureBack: null,
    figureBase: DEFAULT_FIGURE_BASE,
    figureScale: DEFAULT_FIGURE_SCALE,
    tiles: [],
    categories: [{ id: uid(), title: "Карты", cards: [] }],
    isPublic: true,
  };
}

function fromParsed(p: Pack): Loaded {
  const categories: Category[] = p.decks.map((d) => ({
    id: uid(),
    title: d.title,
    cards: d.cards.map((c) => ({ id: uid(), name: c.name, face: c.face, back: c.back })),
  }));
  if (p.singles.length) {
    categories.push({
      id: uid(),
      title: "Отдельные карты",
      cards: p.singles.map((c) => ({ id: uid(), name: c.name, face: c.face, back: c.back })),
    });
  }
  if (!categories.length) categories.push({ id: uid(), title: "Карты", cards: [] });
  return {
    name: p.name,
    author: null,
    cover: null,
    boxImage: p.boxImage,
    token: p.token,
    figure: p.figure,
    figureBack: p.figureBack,
    figureBase: p.figureBase ?? DEFAULT_FIGURE_BASE,
    figureScale: p.figureScale ?? DEFAULT_FIGURE_SCALE,
    tiles: p.tiles,
    categories,
    isPublic: true,
  };
}

function fromData(d: PackData, isPublic: boolean): Loaded {
  const categories: Category[] = d.categories.map((c) => ({
    id: uid(),
    title: c.title,
    cards: c.cards.map((card) => ({ id: uid(), ...card, back: card.back ?? d.defaultBack ?? null })),
  }));
  if (!categories.length) categories.push({ id: uid(), title: "Карты", cards: [] });
  return {
    name: d.name,
    author: d.author,
    cover: d.cover ?? null,
    boxImage: d.boxImage ?? null,
    token: d.token,
    figure: d.figure,
    figureBack: d.figureBack ?? null,
    figureBase: d.figureBase ?? DEFAULT_FIGURE_BASE,
    figureScale: d.figureScale ?? DEFAULT_FIGURE_SCALE,
    tiles: d.tiles,
    categories,
    isPublic,
  };
}

function toData(l: Loaded, author: string | null): PackData {
  return {
    format: "fate-pack",
    version: 1,
    name: l.name,
    author,
    cover: l.cover,
    boxImage: l.boxImage,
    token: l.token,
    figure: l.figure,
    figureBack: l.figureBack,
    figureBase: l.figureBase,
    figureScale: l.figureScale,
    tiles: l.tiles,
    categories: l.categories.map((c) => ({
      title: c.title,
      cards: c.cards.map(({ name, face, back }) => ({ name, face, back })),
    })),
  };
}

function fileSafe(name: string) {
  return (name || "pack").replace(/[\\/:*?"<>|]/g, "_").trim() || "pack";
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---- small pieces

const CardImage = ({
  src,
  alt,
  testId,
  onOpen,
}: {
  src: string;
  alt: string;
  testId: string;
  onOpen?: (src: string, alt: string) => void;
}) => (
  <img
    src={src}
    alt={alt}
    data-testid={testId}
    loading="lazy"
    onClick={() => onOpen?.(src, alt)}
    title="Нажмите, чтобы увеличить"
    className={`w-24 h-36 object-contain rounded border border-black bg-black/40 ${onOpen ? "cursor-zoom-in" : ""}`}
  />
);

// choice of a card back: one of the standard backs, none, or your own (a link or a file)
const BackSelect = ({
  value,
  onChange,
  onError,
  compact = false,
}: {
  value: string | null;
  onChange: (back: string | null) => void;
  onError: (text: string) => void;
  compact?: boolean;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [customMode, setCustomMode] = useState(() => !!value && !presetForUrl(value));
  const [linkText, setLinkText] = useState(() => (value && /^https?:\/\//.test(value) && !presetForUrl(value) ? value : ""));

  const preset = presetForUrl(value);
  const mode = preset ? preset.id : value || customMode ? "custom" : "none";
  const linkInvalid = linkText.trim() !== "" && !/^https?:\/\//.test(linkText.trim());

  const choose = (id: string) => {
    if (id === "none") {
      setCustomMode(false);
      setLinkText("");
      onChange(null);
    } else if (id === "custom") {
      setCustomMode(true);
      if (preset) onChange(null);
    } else {
      const picked = CARD_BACK_PRESETS.find((p) => p.id === id);
      setCustomMode(false);
      setLinkText("");
      onChange(picked ? picked.url : null);
    }
  };

  const typeLink = (text: string) => {
    setLinkText(text);
    const link = text.trim();
    onChange(/^https?:\/\//.test(link) ? link : null);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await resizeImage(file, 700, 0.85);
      setLinkText("");
      onChange(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не удалось загрузить картинку");
    }
  };

  const selectStyle = compact ? { width: "7rem", height: "28px", padding: "0 4px" } : undefined;

  return (
    <div className={compact ? "flex flex-col gap-1 items-center" : "flex flex-wrap items-center gap-2"}>
      <select
        aria-label="Рубашка"
        value={mode}
        onChange={(e) => choose(e.target.value)}
        className={compact ? "text-xs" : undefined}
        style={selectStyle}
      >
        <option value="none">Без рубашки</option>
        {CARD_BACK_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
        <option value="custom">Своя (ссылка или файл)</option>
      </select>
      {mode === "custom" && (
        <>
          <input
            type="text"
            aria-label="Ссылка на рубашку"
            placeholder={value?.startsWith("data:") ? "загружен файл" : "https://..."}
            value={linkText}
            onChange={(e) => typeLink(e.target.value)}
            className={compact ? "text-xs" : "flex-1 min-w-[12rem]"}
            style={compact ? { width: "7rem", height: "28px", padding: "0 4px" } : undefined}
          />
          <button
            type="button"
            className={buttonClass}
            style={compact ? { width: "7rem", height: "26px", fontSize: "0.7rem" } : undefined}
            onClick={() => fileRef.current?.click()}
          >
            Файлом
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              pickFile(file);
            }}
          />
          {linkInvalid && <span className="text-xs text-red-400">Ссылка должна начинаться с http:// или https://</span>}
        </>
      )}
    </div>
  );
};

// form under every category: add a card by a link or by uploading pictures
const AddCardForm = ({ onAdd }: { onAdd: (card: NewCard) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [face, setFace] = useState("");
  const [name, setName] = useState("");
  // the chosen back goes to every card added with this form
  const [back, setBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const faceUrl = face.trim();
    if (!isImageSrc(faceUrl)) {
      setError("Вставьте ссылку на картинку карты (начинается с http:// или https://) или загрузите файл.");
      return;
    }
    onAdd({ name: name.trim(), face: faceUrl, back });
    setFace("");
    setName("");
    setError(null);
  };

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    try {
      for (const file of Array.from(files)) {
        const data = await resizeImage(file, 700, 0.85);
        onAdd({ name: file.name.replace(/\.[^.]+$/, ""), face: data, back });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить картинку");
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-black pt-2">
      <span className="text-sm text-gray-400">Добавить карту</span>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Ссылка на картинку карты"
          value={face}
          onChange={(e) => setFace(e.target.value)}
          className="flex-1 min-w-[14rem]"
        />
        <input
          type="text"
          placeholder="Название (необязательно)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[10rem]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Рубашка:</span>
        <BackSelect value={back} onChange={setBack} onError={setError} />
        {back && (
          <img src={back} alt="Рубашка" className="w-8 h-12 object-contain rounded border border-black bg-black/40" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} onClick={add}>Добавить по ссылке</button>
        <button className={buttonClass} onClick={() => fileRef.current?.click()}>Загрузить файлы</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            upload(files).finally(() => {
              e.target.value = "";
            });
          }}
        />
        <span className="text-xs text-gray-500">
          Выбранная рубашка ставится на все карты, которые вы добавляете этими кнопками. Стандартные рубашки и ссылки
          легче: загруженные файлы сжимаются, но всё равно увеличивают размер пака.
        </span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

// ---- page

const PacksPage = () => {
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // id of the cloud pack that is being edited; null = a new pack that is not saved yet
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [packs, setPacks] = useState<CloudPack[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libCards, setLibCards] = useState<CardRecord[]>([]);
  const [libCategory, setLibCategory] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [tileName, setTileName] = useState("");
  const [tileImage, setTileImage] = useState("");

  // everything public, plus the signed-in person's own packs (including hidden ones)
  const loadPacks = useCallback(async (me: string | null) => {
    let query = supabase
      .from("packs")
      .select("id,user_id,data,is_public,created_at")
      .order("created_at", { ascending: false });
    query = me ? query.or(`is_public.eq.true,user_id.eq.${me}`) : query.eq("is_public", true);
    const { data, error } = await query;
    if (error) {
      setMessage(`Не удалось загрузить список паков: ${error.message}`);
      return;
    }
    setPacks(
      (data ?? []).map((row) => ({
        id: row.id as string,
        ownerId: row.user_id as string,
        data: row.data as PackData,
        isPublic: !!row.is_public,
        createdAt: row.created_at as string,
      })),
    );
  }, []);

  useEffect(() => {
    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    };
    syncUser();
    try {
      setNickname(localStorage.getItem("pack-nickname") ?? "");
    } catch {
      /* ignore */
    }
    const { data } = supabase.auth.onAuthStateChange(() => syncUser());
    return () => data.subscription.unsubscribe();
  }, []);

  // reload the list when the signed-in person changes, so their hidden packs appear
  useEffect(() => {
    loadPacks(userId);
  }, [userId, loadPacks]);

  const changeNickname = (value: string) => {
    setNickname(value);
    try {
      localStorage.setItem("pack-nickname", value);
    } catch {
      /* ignore */
    }
  };

  // Esc closes the zoomed picture
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const openZoom = (src: string, alt: string) => {
    setScale(1);
    setZoom({ src, alt });
  };

  const isOwner = (pack: CloudPack) => !!userId && pack.ownerId === userId;
  const myPacks = packs.filter(isOwner);
  const publicPacks = packs.filter((p) => p.isPublic);

  // ---- starting a pack

  const createNew = () => {
    setLoaded(emptyPack());
    setEditingId(null);
    setMessage("Новый пак. Добавляйте карты по ссылке или файлом, затем сохраните в облако.");
  };

  const importFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseTts(JSON.parse(String(reader.result)));
        if (!parsed) {
          setLoaded(null);
          setEditingId(null);
          setMessage("В файле не нашлось коробки. Нужен файл Tabletop Simulator (.json) из папки Documents\\My Games\\Tabletop Simulator\\Saves.");
          return;
        }
        setLoaded(fromParsed(parsed));
        setEditingId(null);
        setMessage(null);
      } catch {
        setLoaded(null);
        setEditingId(null);
        setMessage("Не удалось прочитать файл: это не JSON.");
      }
    };
    reader.readAsText(file);
  };

  // someone else's pack: view it, or take a copy that belongs to you
  const openCopy = (pack: CloudPack) => {
    setLoaded({ ...fromData(pack.data, true), readOnly: true });
    setEditingId(null);
    setMessage(`Открыт пак «${pack.data.name}» только для просмотра. Скачать его можно кнопкой «Скачать для Tabletop».`);
  };

  // your own pack: edit it in place
  const openForEdit = (pack: CloudPack) => {
    setLoaded(fromData(pack.data, pack.isPublic));
    setEditingId(pack.id);
    if (!nickname.trim() && pack.data.author) changeNickname(pack.data.author);
    setMessage(`Редактирование пака «${pack.data.name}». Изменения попадут в облако после «Сохранить изменения».`);
  };

  const closePack = () => {
    setLoaded(null);
    setEditingId(null);
  };

  // ---- editing

  const update = (fn: (l: Loaded) => Loaded) => setLoaded((prev) => (prev ? fn(prev) : prev));

  const setCover = async (file: File | undefined) => {
    if (!file) return;
    try {
      const cover = await resizeImage(file);
      update((l) => ({ ...l, cover }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить картинку");
    }
  };

  const renameCategory = (id: string, title: string) =>
    update((l) => ({ ...l, categories: l.categories.map((c) => (c.id === id ? { ...c, title } : c)) }));

  const openLibrary = async () => {
    const list = await listCards();
    setLibCards(list.sort((a, b) => b.savedAt - a.savedAt));
    setLibCategory((prev) => prev || (loaded?.categories[0]?.id ?? ""));
    setLibOpen(true);
  };

  // a library card becomes a card of the pack; its small preview is used as the picture
  const addFromLibrary = (record: CardRecord) => {
    if (!loaded) return;
    if (!record.thumbnail) {
      setMessage(`У карты «${record.name}» нет превью: откройте её в редакторе и сохраните, тогда она появится в паке.`);
      return;
    }
    const target = libCategory || loaded.categories[0]?.id;
    if (!target) return;
    update((l) => ({
      ...l,
      categories: l.categories.map((c) =>
        c.id === target
          ? { ...c, cards: [...c.cards, { id: uid(), name: record.name, face: record.thumbnail as string, back: null }] }
          : c,
      ),
    }));
    setMessage(`Карта «${record.name}» добавлена.`);
  };

  const addCategory = () =>
    update((l) => ({
      ...l,
      categories: [...l.categories, { id: uid(), title: `Категория ${l.categories.length + 1}`, cards: [] }],
    }));

  const removeCategory = (id: string) =>
    update((l) => {
      if (l.categories.length <= 1) return l;
      const target = l.categories.find((c) => c.id !== id)!;
      const moving = l.categories.find((c) => c.id === id)?.cards ?? [];
      return {
        ...l,
        categories: l.categories
          .filter((c) => c.id !== id)
          .map((c) => (c.id === target.id ? { ...c, cards: [...c.cards, ...moving] } : c)),
      };
    });

  const addCard = (catId: string, card: NewCard) =>
    update((l) => ({
      ...l,
      categories: l.categories.map((c) =>
        c.id === catId ? { ...c, cards: [...c.cards, { id: uid(), ...card }] } : c,
      ),
    }));

  const removeCard = (cardId: string) =>
    update((l) => ({
      ...l,
      categories: l.categories.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== cardId) })),
    }));

  const renameCard = (cardId: string, name: string) =>
    update((l) => ({
      ...l,
      categories: l.categories.map((c) => ({
        ...c,
        cards: c.cards.map((x) => (x.id === cardId ? { ...x, name } : x)),
      })),
    }));

  const setCardBack = (cardId: string, back: string | null) =>
    update((l) => ({
      ...l,
      categories: l.categories.map((c) => ({
        ...c,
        cards: c.cards.map((x) => (x.id === cardId ? { ...x, back } : x)),
      })),
    }));

  const moveCard = (cardId: string, toId: string) =>
    update((l) => {
      let moved: Item | undefined;
      const without = l.categories.map((c) => {
        const found = c.cards.find((x) => x.id === cardId);
        if (found) moved = found;
        return { ...c, cards: c.cards.filter((x) => x.id !== cardId) };
      });
      if (!moved) return l;
      return {
        ...l,
        categories: without.map((c) => (c.id === toId ? { ...c, cards: [...c.cards, moved!] } : c)),
      };
    });

  const addTile = () => {
    const image = tileImage.trim();
    if (!isImageSrc(image)) {
      setMessage("Для плитки нужна ссылка на картинку (начинается с http:// или https://).");
      return;
    }
    update((l) => ({ ...l, tiles: [...l.tiles, { name: tileName.trim() || "Плитка", image }] }));
    setTileName("");
    setTileImage("");
  };

  const removeTile = (index: number) =>
    update((l) => ({ ...l, tiles: l.tiles.filter((_, i) => i !== index) }));

  // ---- saving, publishing, removing

  // a file that Tabletop Simulator can spawn, with the picture for the list of saved objects
  const downloadTts = async (data: PackData) => {
    const notLinks = countNonLinkImages(data);
    if (notLinks > 0) {
      setMessage(
        `Для Tabletop нельзя: ${notLinks} картинок загружены файлом или заданы не ссылкой, а игра берёт картинки только по ссылке. Замените их ссылками и скачайте снова.`,
      );
      return;
    }
    const fileName = fileSafe(data.name);
    const json = new TextEncoder().encode(JSON.stringify(toTts(data), null, 2));
    // the front picture of the box is the picture of the pack
    const png = await makeThumbnail(data.cover ?? null);
    const noTexture = data.boxImage ? "" : " Текстура коробки не задана, поэтому в игре коробка будет белой.";
    if (png) {
      saveBlob(
        makeZip([
          { name: `${fileName}.json`, data: json },
          { name: `${fileName}.png`, data: png },
        ]),
        `${fileName}.zip`,
      );
      setMessage(
        `Скачан архив ${fileName}.zip. Распакуйте оба файла (.json и .png) в Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects: картинка станет иконкой в списке.${noTexture}`,
      );
    } else {
      saveBlob(new Blob([json as BlobPart], { type: "application/json" }), `${fileName}.json`);
      setMessage(
        `Скачан файл ${fileName}.json. Положите его в Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects. Иконки не будет: у пака нет «Картинки пака».${noTexture}`,
      );
    }
  };

  // returns the text of the first problem, or null when the pack can be saved
  const problemWithPack = (l: Loaded): string | null => {
    if (!email || !userId) return "Сначала войдите в аккаунт.";
    if (!nickname.trim()) return "Введите ник: так вас увидят в общем списке.";
    if (l.token && !isImageSrc(l.token)) return "Ссылка на жетон должна начинаться с http:// или https://";
    if (l.figure && !isImageSrc(l.figure)) return "Ссылка на фигурку должна начинаться с http:// или https://";
    if (l.figureBack && !isImageSrc(l.figureBack)) return "Ссылка на заднюю сторону фигурки должна начинаться с http:// или https://";
    if (l.boxImage && !isImageSrc(l.boxImage)) return "Ссылка на текстуру коробки должна начинаться с http:// или https://";
    const size = new Blob([JSON.stringify(toData(l, nickname.trim()))]).size;
    if (size > MAX_PACK_BYTES) {
      return `Пак слишком тяжёлый (${(size / 1_000_000).toFixed(1)} МБ, максимум ${MAX_PACK_BYTES / 1_000_000} МБ). Используйте ссылки вместо загруженных файлов.`;
    }
    return null;
  };

  // saves the open pack as a NEW cloud pack that belongs to you
  const saveAsNew = async () => {
    if (!loaded) return;
    const problem = problemWithPack(loaded);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("packs")
      .insert({
        user_id: userId,
        name: loaded.name || "Без названия",
        data: toData(loaded, nickname.trim()),
        is_public: loaded.isPublic,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setMessage(`Не удалось сохранить: ${error?.message ?? "нет ответа от сервера"}`);
      return;
    }
    setEditingId(data.id as string);
    setMessage(
      loaded.isPublic
        ? "Пак сохранён и виден всем. Дальше правьте его и жмите «Сохранить изменения»."
        : "Пак сохранён и виден только вам. Дальше правьте его и жмите «Сохранить изменения».",
    );
    loadPacks(userId);
  };

  // writes the changes into the pack that is being edited (only the owner is allowed to)
  const saveChanges = async () => {
    if (!loaded || !editingId) return;
    const problem = problemWithPack(loaded);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("packs")
      .update({
        name: loaded.name || "Без названия",
        data: toData(loaded, nickname.trim()),
        is_public: loaded.isPublic,
      })
      .eq("id", editingId)
      .select("id");
    setBusy(false);
    if (error) {
      setMessage(`Не удалось сохранить: ${error.message}`);
      return;
    }
    // the database silently skips rows that are not yours, so an empty answer means "no access"
    if (!data || data.length === 0) {
      setMessage("Не удалось сохранить: этот пак не ваш или уже удалён.");
      return;
    }
    setMessage("Изменения сохранены.");
    loadPacks(userId);
  };

  const removePack = async (pack: CloudPack) => {
    if (!window.confirm(`Удалить пак «${pack.data.name}» навсегда?`)) return;
    const { data, error } = await supabase.from("packs").delete().eq("id", pack.id).select("id");
    if (error) {
      setMessage(`Не удалось удалить: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setMessage("Не удалось удалить: этот пак не ваш.");
      return;
    }
    if (editingId === pack.id) closePack();
    setMessage("Пак удалён.");
    loadPacks(userId);
  };

  // ---- render helpers

  const renderRow = (pack: CloudPack) => (
    <div
      key={pack.id}
      className="flex flex-wrap items-center justify-between gap-3 border border-black rounded p-3 bg-primary-dark-blue"
    >
      <div className="flex items-center gap-3 min-w-0">
        {pack.data.cover ? (
          <img src={pack.data.cover} alt="" className="w-16 h-16 object-cover rounded border border-black shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded border border-dashed border-gray-500 shrink-0" />
        )}
        <div className="flex flex-col">
          <span className="font-semibold">
            {pack.data.name}
            {!pack.isPublic && <span className="ml-2 text-xs text-gray-400">(виден только вам)</span>}
          </span>
          <span className="text-sm text-gray-400">
            автор: {pack.data.author ?? "неизвестен"} · карт:{" "}
            {pack.data.categories.reduce((n, c) => n + c.cards.length, 0)} · категорий:{" "}
            {pack.data.categories.length}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isOwner(pack) ? (
          <button className={buttonClass} onClick={() => openForEdit(pack)}>Редактировать</button>
        ) : (
          <button className={buttonClass} onClick={() => openCopy(pack)}>Открыть</button>
        )}
        <button className={buttonClass} onClick={() => downloadTts(pack.data)}>Скачать для Tabletop</button>
        {isOwner(pack) && (
          <button className={dangerClass} onClick={() => removePack(pack)}>Удалить</button>
        )}
      </div>
    </div>
  );

  // ---- render

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      {libOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLibOpen(false)}
        >
          <div
            className="flex flex-col gap-3 w-full max-w-3xl max-h-[85vh] bg-primary-dark-blue border border-black rounded p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Карты из библиотеки</h2>
              <button className={dangerClass} onClick={() => setLibOpen(false)}>Закрыть</button>
            </div>
            {loaded && loaded.categories.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="field-header">Добавить в категорию</span>
                <select value={libCategory} onChange={(e) => setLibCategory(e.target.value)}>
                  {loaded.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="overflow-y-auto flex flex-col gap-2">
              {libCards.length === 0 && <p className="italic text-gray-400">В библиотеке пока нет карт.</p>}
              {libCards.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-3 border border-black rounded p-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {record.thumbnail ? (
                      <img src={record.thumbnail} alt="" className="w-12 h-auto rounded border border-black shrink-0" />
                    ) : (
                      <div className="w-12 h-16 rounded border border-dashed border-gray-500 shrink-0" />
                    )}
                    <span className="truncate">{record.name}</span>
                  </div>
                  <button className={buttonClass} onClick={() => addFromLibrary(record)}>Добавить</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center gap-3 p-4"
          onClick={() => setZoom(null)}
          onWheel={(e) => setScale((s) => Math.min(4, Math.max(0.5, s - e.deltaY * 0.001)))}
        >
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button className={buttonClass} onClick={() => setScale((s) => Math.max(0.5, s - 0.5))}>−</button>
            <span className="text-white w-16 text-center">{Math.round(scale * 100)}%</span>
            <button className={buttonClass} onClick={() => setScale((s) => Math.min(4, s + 0.5))}>+</button>
            <button className={dangerClass} onClick={() => setZoom(null)}>Закрыть</button>
          </div>
          <div className="overflow-auto max-h-[78vh] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.src} alt={zoom.alt} style={{ width: `${scale * 420}px`, height: "auto" }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Мастерская</h1>
        <div className="flex flex-wrap gap-2">
          {loaded && (
            <>
              <button
                className={buttonClass}
                onClick={() => downloadTts(toData(loaded, nickname.trim() || loaded.author))}
              >
                Скачать для Tabletop
              </button>
              {loaded.readOnly ? null : email ? (
                <>
                  {editingId && (
                    <button className={buttonClass} onClick={saveChanges} disabled={busy}>
                      Сохранить изменения
                    </button>
                  )}
                  <button className={buttonClass} onClick={saveAsNew} disabled={busy}>
                    {editingId ? "Сохранить как новый" : "Сохранить в облако"}
                  </button>
                </>
              ) : (
                <Link href="/account" className={buttonClass}>Войти, чтобы сохранить</Link>
              )}
              <button className={dangerClass} onClick={closePack}>Закрыть</button>
            </>
          )}
          {!loaded?.readOnly && (
            <>
              <button className={buttonClass} onClick={createNew}>Создать пак</button>
              <button className={buttonClass} onClick={() => fileInput.current?.click()}>Загрузить пак из Tabletop</button>
            </>
          )}
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={importFile} className="hidden" />
        </div>
      </div>

      {message && <p className="italic">{message}</p>}

      {!loaded && (
        <p className="italic text-gray-400">
          Нажмите «Создать пак», чтобы собрать пак прямо на сайте, или загрузите файл Tabletop (.json) из папки{" "}
          <b>Documents\My Games\Tabletop Simulator\Saves</b> (объекты из Saved Objects лежат в подпапке). Свои паки
          можно в любой момент открыть из списка ниже и поправить.
        </p>
      )}

      {loaded && (
        <fieldset disabled={!!loaded.readOnly} className="contents">
          <div className="flex flex-wrap gap-4 border border-black rounded p-3 bg-primary-dark-blue">
            <div className="flex flex-col gap-2 items-start">
              {loaded.cover ? (
                <img src={loaded.cover} alt="Картинка пака" className="w-32 h-32 object-cover rounded border border-black" />
              ) : (
                <div className="w-32 h-32 rounded border border-dashed border-gray-500 flex items-center justify-center text-xs text-gray-500 text-center">
                  нет картинки
                </div>
              )}
              <button className={buttonClass} onClick={() => coverInput.current?.click()}>
                Картинка пака (перед коробки)
              </button>
              {loaded.cover && (
                <button className={dangerClass} onClick={() => update((l) => ({ ...l, cover: null }))}>
                  Убрать
                </button>
              )}
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  setCover(file);
                }}
              />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[16rem]">
              <label className="flex flex-col gap-1">
                <span className="field-header">Название пака</span>
                <input
                  type="text"
                  value={loaded.name}
                  onChange={(e) => update((l) => ({ ...l, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-header">Ник автора (виден в общем списке)</span>
                <input
                  type="text"
                  value={nickname}
                  maxLength={30}
                  placeholder="Например, Jipice"
                  onChange={(e) => changeNickname(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={loaded.isPublic}
                  onChange={(e) => update((l) => ({ ...l, isPublic: e.target.checked }))}
                  style={{ width: "auto" }}
                />
                <span>Виден всем в общем списке (без галочки видите только вы)</span>
              </label>
              <span className="text-sm text-gray-400">
                Карт: {totalCards(loaded)} · категорий: {loaded.categories.length} · плиток: {loaded.tiles.length}
                {editingId && " · вы редактируете сохранённый пак"}
              </span>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Жетон и фигурка</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2 flex-1 min-w-[14rem]">
                <label className="flex flex-col gap-1">
                  <span className="field-header">Жетон (ссылка на картинку)</span>
                  <input
                    type="text"
                    value={loaded.token ?? ""}
                    placeholder="https://..."
                    onChange={(e) => update((l) => ({ ...l, token: e.target.value.trim() || null }))}
                  />
                </label>
                {loaded.token && isImageSrc(loaded.token) && (
                  <CardImage src={loaded.token} alt="Жетон" testId="token" onOpen={openZoom} />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-[14rem]">
                <label className="flex flex-col gap-1">
                  <span className="field-header">Текстура коробки для игры (ссылка)</span>
                  <input
                    type="text"
                    value={loaded.boxImage ?? ""}
                    placeholder="https://... (со страницы «Коробка мастера»)"
                    onChange={(e) => update((l) => ({ ...l, boxImage: e.target.value.trim() || null }))}
                  />
                </label>
                {loaded.boxImage && isImageSrc(loaded.boxImage) && (
                  <CardImage src={loaded.boxImage} alt="Текстура коробки" testId="box-image" onOpen={openZoom} />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-[14rem]">
                <label className="flex flex-col gap-1">
                  <span className="field-header">Фигурка (ссылка на картинку)</span>
                  <input
                    type="text"
                    value={loaded.figure ?? ""}
                    placeholder="https://..."
                    onChange={(e) => update((l) => ({ ...l, figure: e.target.value.trim() || null }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="field-header">Задняя сторона фигурки (ссылка, необязательно)</span>
                  <input
                    type="text"
                    value={loaded.figureBack ?? ""}
                    placeholder="если пусто, сзади та же картинка"
                    onChange={(e) => update((l) => ({ ...l, figureBack: e.target.value.trim() || null }))}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {loaded.figure && isImageSrc(loaded.figure) && (
                    <CardImage src={loaded.figure} alt="Фигурка" testId="figure" onOpen={openZoom} />
                  )}
                  {loaded.figureBack && isImageSrc(loaded.figureBack) && (
                    <CardImage src={loaded.figureBack} alt="Задняя сторона фигурки" testId="figure-back" onOpen={openZoom} />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="field-header font-semibold">Подставка (нижняя часть)</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      aria-label="Цвет подставки"
                      value={loaded.figureBase}
                      onChange={(e) => update((l) => ({ ...l, figureBase: e.target.value }))}
                      style={{ width: "3rem", height: "2.25rem", padding: 0, cursor: "pointer" }}
                    />
                    <span className="text-sm text-gray-300">{loaded.figureBase}</span>
                    {["#ffffff", "#4a7bd0", "#c0392b", "#2e8b57", "#222222"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Цвет подставки ${c}`}
                        onClick={() => update((l) => ({ ...l, figureBase: c }))}
                        style={{ background: c, width: "1.75rem", height: "1.75rem" }}
                        className="rounded-full border border-gray-400 cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="field-header font-semibold">
                    Размер фигурки на подставке: ×{loaded.figureScale.toFixed(1)}
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.1}
                    value={loaded.figureScale}
                    onChange={(e) => update((l) => ({ ...l, figureScale: Number(e.target.value) }))}
                    style={{ width: "14rem" }}
                  />
                  <span className="text-xs text-gray-500">
                    Подставка остаётся прежнего размера, меняется только сама картинка. Обычно хватает 1.5–2.
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Плитки</h2>
            {loaded.tiles.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {loaded.tiles.map((tile, i) => (
                  <div key={i} className="flex flex-col gap-1 items-start">
                    <CardImage src={tile.image} alt={tile.name} testId="tile" onOpen={openZoom} />
                    <span className="text-xs text-gray-400">{tile.name}</span>
                    <button className={dangerClass} onClick={() => removeTile(i)}>Убрать</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Ссылка на картинку плитки"
                value={tileImage}
                onChange={(e) => setTileImage(e.target.value)}
                className="flex-1 min-w-[14rem]"
              />
              <input
                type="text"
                placeholder="Название (необязательно)"
                value={tileName}
                onChange={(e) => setTileName(e.target.value)}
                className="flex-1 min-w-[10rem]"
              />
              <button className={buttonClass} onClick={addTile}>Добавить плитку</button>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Категории</h2>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} onClick={openLibrary}>Добавить из библиотеки</button>
                <button className={buttonClass} onClick={addCategory}>Добавить категорию</button>
              </div>
            </div>

            {loaded.categories.map((cat) => (
              <div key={cat.id} className="flex flex-col gap-2 border border-black rounded p-3 bg-primary-dark-blue">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    aria-label="Название категории"
                    value={cat.title}
                    onChange={(e) => renameCategory(cat.id, e.target.value)}
                    className="flex-1 min-w-[12rem]"
                  />
                  <span className="text-sm text-gray-400">{cat.cards.length} шт.</span>
                  <button
                    className={dangerClass}
                    onClick={() => removeCategory(cat.id)}
                    disabled={loaded.categories.length <= 1}
                    title="Карты переедут в первую оставшуюся категорию"
                  >
                    Удалить категорию
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {cat.cards.map((card) => (
                    <div key={card.id} className="flex flex-col gap-1 items-center w-28">
                      <CardImage src={card.face} alt={card.name || "Карта"} testId="card" onOpen={openZoom} />
                      {card.back && <CardImage src={card.back} alt="Рубашка" testId="back" onOpen={openZoom} />}
                      <BackSelect
                        compact
                        value={card.back}
                        onChange={(back) => setCardBack(card.id, back)}
                        onError={setMessage}
                      />
                      <input
                        type="text"
                        aria-label="Название карты"
                        placeholder="Название"
                        value={card.name}
                        onChange={(e) => renameCard(card.id, e.target.value)}
                        className="text-xs"
                        style={{ width: "7rem", height: "28px", padding: "0 4px" }}
                      />
                      {loaded.categories.length > 1 && (
                        <select
                          aria-label="Переместить в категорию"
                          value={cat.id}
                          onChange={(e) => moveCard(card.id, e.target.value)}
                          className="text-xs"
                          style={{ width: "7rem", height: "28px", padding: "0 4px" }}
                        >
                          {loaded.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      )}
                      <button
                        className={dangerClass}
                        onClick={() => removeCard(card.id)}
                        style={{ width: "7rem" }}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>

                <AddCardForm onAdd={(card) => addCard(cat.id, card)} />
              </div>
            ))}
          </section>
        </fieldset>
      )}

      {email && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Мои паки</h2>
          {myPacks.length === 0 && (
            <p className="italic text-gray-400">У вас пока нет сохранённых паков. Создайте новый или загрузите файл.</p>
          )}
          {myPacks.map(renderRow)}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Общий список</h2>
        {publicPacks.length === 0 && (
          <p className="italic text-gray-400">Пока никто ничего не опубликовал.</p>
        )}
        {publicPacks.map(renderRow)}
      </section>
    </div>
  );
};

export default PacksPage;
