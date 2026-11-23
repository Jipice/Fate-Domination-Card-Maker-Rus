"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../cloud/supabase";
import { Pack, parseTts } from "./parseTts";

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
  token: string | null;
  figure: string | null;
  tiles: Tile[];
  categories: { title: string; cards: { name: string; face: string; back: string | null }[] }[];
};

type Loaded = {
  name: string;
  author: string | null;
  token: string | null;
  figure: string | null;
  tiles: Tile[];
  categories: Category[];
};

type PublicPack = { id: string; ownerId: string; data: PackData; createdAt: string };

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";
const dangerClass = "import-export-button bg-gray-700 hover:bg-red-800 justify-center";

const totalCards = (l: Loaded) => l.categories.reduce((n, c) => n + c.cards.length, 0);

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
  return { name: p.name, author: null, token: p.token, figure: p.figure, tiles: p.tiles, categories };
}

function fromData(d: PackData): Loaded {
  return {
    name: d.name,
    author: d.author,
    token: d.token,
    figure: d.figure,
    tiles: d.tiles,
    categories: d.categories.map((c) => ({
      id: uid(),
      title: c.title,
      cards: c.cards.map((card) => ({ id: uid(), ...card })),
    })),
  };
}

function toData(l: Loaded, author: string | null): PackData {
  return {
    format: "fate-pack",
    version: 1,
    name: l.name,
    author,
    token: l.token,
    figure: l.figure,
    tiles: l.tiles,
    categories: l.categories.map((c) => ({
      title: c.title,
      cards: c.cards.map(({ name, face, back }) => ({ name, face, back })),
    })),
  };
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

// ---- page

const PacksPage = () => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [publicPacks, setPublicPacks] = useState<PublicPack[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [scale, setScale] = useState(1);

  const loadPublic = async () => {
    const { data, error } = await supabase
      .from("packs")
      .select("id,user_id,data,created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(`Не удалось загрузить общий список: ${error.message}`);
      return;
    }
    setPublicPacks(
      (data ?? []).map((row) => ({
        id: row.id as string,
        ownerId: row.user_id as string,
        data: row.data as PackData,
        createdAt: row.created_at as string,
      })),
    );
  };

  useEffect(() => {
    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    };
    syncUser();
    loadPublic();
    try {
      setNickname(localStorage.getItem("pack-nickname") ?? "");
    } catch {
      /* ignore */
    }
    const { data } = supabase.auth.onAuthStateChange(() => syncUser());
    return () => data.subscription.unsubscribe();
  }, []);

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

  // ---- loading a file

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
          setMessage("В файле не нашлось коробки. Нужен .json из папки Documents\\My Games\\Tabletop Simulator\\Saves.");
          return;
        }
        setLoaded(fromParsed(parsed));
        setMessage(null);
      } catch {
        setLoaded(null);
        setMessage("Не удалось прочитать файл: это не JSON.");
      }
    };
    reader.readAsText(file);
  };

  const openPublic = (pack: PublicPack) => {
    setLoaded(fromData(pack.data));
    setMessage(`Открыт пак «${pack.data.name}». Изменения сохраняются только если его скачать или опубликовать.`);
  };

  // ---- editing categories

  const update = (fn: (l: Loaded) => Loaded) => setLoaded((prev) => (prev ? fn(prev) : prev));

  const renameCategory = (id: string, title: string) =>
    update((l) => ({ ...l, categories: l.categories.map((c) => (c.id === id ? { ...c, title } : c)) }));

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

  // ---- saving, publishing, removing

  const download = () => {
    if (!loaded) return;
    const blob = new Blob([JSON.stringify(toData(loaded, nickname.trim() || loaded.author), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${loaded.name || "pack"}.fate-pack.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const publish = async () => {
    if (!loaded || !email) return;
    if (!nickname.trim()) {
      setMessage("Введите ник: так вас увидят в общем списке.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("packs").insert({
      name: loaded.name || "Без названия",
      data: toData(loaded, nickname.trim()),
      is_public: true,
    });
    setBusy(false);
    setMessage(error ? `Не удалось опубликовать: ${error.message}` : "Пак опубликован и виден всем.");
    if (!error) loadPublic();
  };

  const removePublic = async (pack: PublicPack) => {
    if (!window.confirm(`Удалить «${pack.data.name}» из общего списка?`)) return;
    const { error } = await supabase.from("packs").delete().eq("id", pack.id);
    setMessage(error ? `Не удалось удалить: ${error.message}` : "Пак удалён из общего списка.");
    if (!error) loadPublic();
  };

  const isOwner = (pack: PublicPack) => !!userId && pack.ownerId === userId;

  // ---- render

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
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
        <h1 className="text-xl font-semibold">Паки</h1>
        <div className="flex flex-wrap gap-2">
          {loaded && (
            <>
              <button className={buttonClass} onClick={download}>Скачать файл</button>
              {email ? (
                <button className={buttonClass} onClick={publish} disabled={busy}>Опубликовать</button>
              ) : (
                <Link href="/account" className={buttonClass}>Войти, чтобы опубликовать</Link>
              )}
              <button className={dangerClass} onClick={() => setLoaded(null)}>Закрыть</button>
            </>
          )}
          <button className={buttonClass} onClick={() => fileInput.current?.click()}>Загрузить пак</button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={importFile} className="hidden" />
        </div>
      </div>

      {message && <p className="italic">{message}</p>}

      {!loaded && (
        <p className="italic text-gray-400">
          Загрузите .json из папки <b>Documents\My Games\Tabletop Simulator\Saves</b> (объекты из Saved Objects лежат
          в подпапке). Сайт покажет коробку пака, и её можно будет поделить по категориям.
        </p>
      )}

      {loaded && (
        <>
          <div className="flex flex-col gap-2 border border-black rounded p-3 bg-primary-dark-blue">
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
            <span className="text-sm text-gray-400">
              Карт: {totalCards(loaded)} · категорий: {loaded.categories.length} · плиток: {loaded.tiles.length}
            </span>
          </div>

          {(loaded.token || loaded.figure) && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Жетон и фигурка</h2>
              <div className="flex flex-wrap gap-4">
                {loaded.token && <CardImage src={loaded.token} alt="Жетон" testId="token" onOpen={openZoom} />}
                {loaded.figure && <CardImage src={loaded.figure} alt="Фигурка" testId="figure" onOpen={openZoom} />}
              </div>
            </section>
          )}

          {loaded.tiles.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Плитки</h2>
              <div className="flex flex-wrap gap-4">
                {loaded.tiles.map((tile, i) => (
                  <div key={i} className="flex flex-col gap-1 items-start">
                    <CardImage src={tile.image} alt={tile.name} testId="tile" onOpen={openZoom} />
                    <span className="text-xs text-gray-400">{tile.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Категории</h2>
              <button className={buttonClass} onClick={addCategory}>Добавить категорию</button>
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
                      {card.name && (
                        <span className="text-xs text-gray-400 text-center truncate w-28" title={card.name}>
                          {card.name}
                        </span>
                      )}
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Общий список</h2>
        {publicPacks.length === 0 && (
          <p className="italic text-gray-400">Пока никто ничего не опубликовал.</p>
        )}
        {publicPacks.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-black rounded p-3 bg-primary-dark-blue"
          >
            <div className="flex flex-col">
              <span className="font-semibold">{pack.data.name}</span>
              <span className="text-sm text-gray-400">
                автор: {pack.data.author ?? "неизвестен"} · карт:{" "}
                {pack.data.categories.reduce((n, c) => n + c.cards.length, 0)} · категорий:{" "}
                {pack.data.categories.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} onClick={() => openPublic(pack)}>Открыть</button>
              <button
                className={buttonClass}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(pack.data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${pack.data.name || "pack"}.fate-pack.json`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                Скачать
              </button>
              {isOwner(pack) && (
                <button className={dangerClass} onClick={() => removePublic(pack)}>Удалить</button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default PacksPage;
