"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { listCards, getThumbnail } from "../library/storage";
import type { CardSummary } from "../library/db";
import { LazyThumb } from "../library/LazyThumb";
import ColorInput from "../master-assets/components/ColorInput";
import type { Color } from "@/src/types/colorTypes";

// ---- data

type Kind = "text" | "check" | "image";

export type SheetEl = {
  id: string;
  kind: Kind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  values: (string | number)[]; // text: one string per cell; check: 0 disabled, 1 off, 2 on
  font: number;
  align: "left" | "center" | "right";
  color: string; // "#rrggbb", picked with the paint-bucket picker
  counter: boolean; // text only: +/- buttons next to each cell
  locked: boolean; // in play mode the element cannot be changed
  size: number; // check: symbol size
  url: string; // image element
  rotation: number; // image element, degrees
};

type Board = {
  width: number;
  height: number;
  background: string; // picture the board is drawn on (empty = plain paper)
  naturalW: number; // size of the picture itself
  naturalH: number;
  lockRatio: boolean;
  elements: SheetEl[];
};

const KEY = "fate-extra-editor-current";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CHECK_SYMBOL: Record<number, string> = { 0: "◌", 1: "○", 2: "●" };

const defaultBoard = (): Board => ({
  width: 690,
  height: 791,
  background: "",
  naturalW: 690,
  naturalH: 791,
  lockRatio: true,
  elements: [],
});

function newElement(kind: Kind, index: number): SheetEl {
  const base = {
    id: uid(),
    kind,
    x: 40 + index * 12,
    y: 40 + index * 12,
    cols: 1,
    rows: 1,
    gapX: 0,
    gapY: 0,
    font: 24,
    align: "left" as const,
    color: "#000000",
    counter: false,
    locked: false,
    size: 28,
    url: "",
    rotation: 0,
  };
  if (kind === "text") return { ...base, name: "Текст", w: 220, h: 40, values: [""] };
  if (kind === "check") return { ...base, name: "Чекбокс", w: 36, h: 36, values: [1] };
  return { ...base, name: "Картинка", w: 140, h: 140, values: [] };
}

// keeps exactly cols*rows values for text and checks
function fitValues(el: SheetEl, values: (string | number)[]): (string | number)[] {
  if (el.kind === "image") return [];
  const count = el.cols * el.rows;
  const fill = el.kind === "check" ? 1 : "";
  return Array.from({ length: count }, (_, i) => values[i] ?? fill);
}

// position of cell i on the board
function cellPos(el: SheetEl, i: number) {
  return {
    left: el.x + (i % el.cols) * (el.w + el.gapX),
    top: el.y + Math.floor(i / el.cols) * (el.h + el.gapY),
  };
}

// a picture from a file, scaled down so it fits the storage in the browser
function readPicture(file: File, maxSide = 1600): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve({ url: canvas.toDataURL("image/jpeg", 0.9), width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("не удалось открыть картинку"));
    };
    img.src = objectUrl;
  });
}

// size of a picture given by a link (for library thumbnails)
function sizeOf(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("не удалось открыть картинку"));
    img.src = url;
  });
}

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";
const dangerClass = "import-export-button bg-gray-700 hover:bg-red-800 justify-center";

// ---- page

const ExtraEditorPage = () => {
  const [board, setBoard] = useState<Board>(defaultBoard());
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "play">("edit");
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [libCards, setLibCards] = useState<CardSummary[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const loaded = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // restore the last board, then keep saving every change in this browser
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Board;
        if (Array.isArray(data.elements)) setBoard(data);
      }
    } catch {
      /* nothing saved or unreadable */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(board));
    } catch {
      /* picture too big to keep: the board still works, it is just not remembered */
    }
  }, [board]);

  const current = board.elements.find((e) => e.id === selected) ?? null;

  const patchEl = (id: string, patch: Partial<SheetEl>) =>
    setBoard((b) => ({
      ...b,
      elements: b.elements.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        return { ...next, values: fitValues(next, next.values) };
      }),
    }));

  const setCell = (el: SheetEl, i: number, value: string | number) =>
    patchEl(el.id, { values: el.values.map((v, k) => (k === i ? value : v)) });

  const bump = (el: SheetEl, i: number, delta: number) => {
    const cur = parseFloat(String(el.values[i]));
    setCell(el, i, String((Number.isNaN(cur) ? 0 : cur) + delta));
  };

  // left click: off <-> on; right click: disabled <-> off
  const clickCheck = (el: SheetEl, i: number, right: boolean) => {
    const v = Number(el.values[i]);
    let next: number;
    if (right) next = v === 0 ? 1 : 0;
    else next = v === 1 ? 2 : 1;
    setCell(el, i, next);
  };

  const add = (kind: Kind) => {
    const el = newElement(kind, board.elements.length);
    setBoard((b) => ({ ...b, elements: [...b.elements, el] }));
    setSelected(el.id);
    setMode("edit");
  };

  const remove = (id: string) => {
    setBoard((b) => ({ ...b, elements: b.elements.filter((e) => e.id !== id) }));
    setSelected(null);
  };

  // dragging an element in edit mode
  const startDrag = (e: ReactPointerEvent, el: SheetEl) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelected(el.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = el.x;
    const oy = el.y;
    const move = (ev: PointerEvent) =>
      patchEl(el.id, { x: Math.round(ox + ev.clientX - startX), y: Math.round(oy + ev.clientY - startY) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- the picture under the board

  const setPicture = (url: string, width: number, height: number) =>
    setBoard((b) => ({
      ...b,
      background: url,
      naturalW: width,
      naturalH: height,
      width,
      height,
    }));

  const pickFromLibrary = async () => {
    setPickerOpen(true);
    setLibLoading(true);
    setMessage("Загружаем карты из библиотеки…");
    try {
      const list = await listCards();
      setLibCards(list.sort((a, b) => b.savedAt - a.savedAt));
      setMessage(null);
    } catch {
      setMessage("Не удалось загрузить библиотеку.");
    } finally {
      setLibLoading(false);
    }
  };

  const chooseLibraryCard = async (record: CardSummary) => {
    setMessage(`Загружаем картинку «${record.name}»…`);
    try {
      const thumb = await getThumbnail(record.id);
      if (!thumb) {
        setMessage(`У карты «${record.name}» нет превью.`);
        return;
      }
      const size = await sizeOf(thumb);
      setPicture(thumb, size.width, size.height);
      setPickerOpen(false);
      setMessage(`Картинка: «${record.name}».`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось открыть карту");
    }
  };

  const uploadPicture = async (file: File | undefined) => {
    if (!file) return;
    try {
      const pic = await readPicture(file);
      setPicture(pic.url, pic.width, pic.height);
      setMessage(`Картинка загружена: ${pic.width}×${pic.height}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить картинку");
    }
  };

  const removePicture = () =>
    setBoard((b) => ({ ...b, background: "", width: 690, height: 791, naturalW: 690, naturalH: 791 }));

  // ---- size and proportions

  // with the ratio locked, changing one side changes the other
  const setWidth = (value: number) =>
    setBoard((b) => {
      if (!Number.isFinite(value) || value <= 0) return b;
      const height = b.lockRatio ? Math.round(value * (b.height / b.width)) : b.height;
      return { ...b, width: Math.round(value), height };
    });

  const setHeight = (value: number) =>
    setBoard((b) => {
      if (!Number.isFinite(value) || value <= 0) return b;
      const width = b.lockRatio ? Math.round(value * (b.width / b.height)) : b.width;
      return { ...b, height: Math.round(value), width };
    });

  const useNaturalSize = () =>
    setBoard((b) => ({ ...b, width: b.naturalW, height: b.naturalH }));

  // ---- rendering of one element

  const renderEl = (el: SheetEl) => {
    const isSelected = selected === el.id && mode === "edit";

    if (el.kind === "image") {
      return (
        <div
          key={el.id}
          onPointerDown={(e) => startDrag(e, el)}
          className={`absolute ${mode === "edit" ? "cursor-move" : ""} ${isSelected ? "outline outline-2 outline-blue-500" : ""}`}
          style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)` }}
        >
          {el.url ? (
            <img src={el.url} alt={el.name} className="w-full h-full object-contain pointer-events-none" draggable={false} />
          ) : (
            <div className="w-full h-full border border-dashed border-gray-500 flex items-center justify-center text-xs text-gray-500">
              нет картинки
            </div>
          )}
        </div>
      );
    }

    const cells = Array.from({ length: el.cols * el.rows }, (_, i) => i);

    return cells.map((i) => {
      const { left, top } = cellPos(el, i);
      const value = el.values[i];

      if (el.kind === "text") {
        if (mode === "edit") {
          return (
            <div
              key={`${el.id}-${i}`}
              onPointerDown={(e) => startDrag(e, el)}
              className={`absolute cursor-move flex items-center border ${isSelected ? "border-blue-500 border-2" : "border-dashed border-gray-400"}`}
              style={{
                left,
                top,
                width: el.w,
                height: el.h,
                fontSize: el.font,
                color: el.color,
                justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
                padding: "0 4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {String(value ?? "")}
            </div>
          );
        }
        return (
          <div key={`${el.id}-${i}`}>
            <input
              type="text"
              value={String(value ?? "")}
              disabled={el.locked}
              onChange={(e) => setCell(el, i, e.target.value)}
              className="absolute bg-transparent border-none outline-none"
              style={{ left, top, width: el.w, height: el.h, fontSize: el.font, color: el.color, textAlign: el.align, padding: "0 4px" }}
            />
            {el.counter && !el.locked && (
              <div className="absolute flex flex-col" style={{ left: left + el.w + 2, top, width: 22, height: el.h }}>
                <button type="button" className="text-xs bg-blue-500 text-white rounded-t flex-1" onClick={() => bump(el, i, 1)}>+</button>
                <button type="button" className="text-xs bg-blue-500 text-white rounded-b flex-1" onClick={() => bump(el, i, -1)}>−</button>
              </div>
            )}
          </div>
        );
      }

      // check
      const v = Number(value);
      if (mode === "edit") {
        return (
          <div
            key={`${el.id}-${i}`}
            onPointerDown={(e) => startDrag(e, el)}
            className={`absolute cursor-move flex items-center justify-center border ${isSelected ? "border-blue-500 border-2" : "border-dashed border-gray-400"}`}
            style={{ left, top, width: el.w, height: el.h, fontSize: el.size, color: el.color }}
          >
            {CHECK_SYMBOL[v] ?? "○"}
          </div>
        );
      }
      return (
        <div
          key={`${el.id}-${i}`}
          onClick={() => !el.locked && clickCheck(el, i, false)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!el.locked) clickCheck(el, i, true);
          }}
          className={`absolute flex items-center justify-center select-none ${el.locked ? "" : "cursor-pointer"}`}
          style={{ left, top, width: el.w, height: el.h, fontSize: el.size, color: el.color }}
        >
          {CHECK_SYMBOL[v] ?? "○"}
        </div>
      );
    });
  };

  // ---- properties of the selected element

  const numField = (label: string, key: keyof SheetEl) =>
    current && (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <input
          type="number"
          className="w-24"
          value={Number(current[key])}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            const isCount = key === "cols" || key === "rows";
            patchEl(current.id, { [key]: isCount ? Math.max(1, Math.round(n)) : n } as Partial<SheetEl>);
          }}
        />
      </label>
    );

  const textField = (label: string, key: keyof SheetEl) =>
    current && (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <input type="text" className="w-40" value={String(current[key] ?? "")} onChange={(e) => patchEl(current.id, { [key]: e.target.value } as Partial<SheetEl>)} />
      </label>
    );

  const toggleField = (label: string, key: "counter" | "locked") =>
    current && (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <input type="checkbox" checked={!!current[key]} onChange={(e) => patchEl(current.id, { [key]: e.target.checked } as Partial<SheetEl>)} />
      </label>
    );

  // ---- render

  const ratio = board.width / board.height;

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Доп. Редактор</h1>
        <div className="flex flex-wrap gap-2">
          <button className={mode === "edit" ? buttonClass : dangerClass} onClick={() => setMode("edit")}>Редактирование</button>
          <button className={mode === "play" ? buttonClass : dangerClass} onClick={() => { setMode("play"); setSelected(null); }}>Игра</button>
        </div>
      </div>

      {/* the picture under everything: a card from the library or any photo */}
      <div className="flex flex-col gap-2 border border-black rounded p-3 bg-primary-dark-blue">
        <span className="field-header">Картинка-основа</span>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} onClick={pickFromLibrary} disabled={libLoading}>
            {libLoading ? "Загружаем…" : "Карта из библиотеки"}
          </button>
          <button className={buttonClass} onClick={() => fileInput.current?.click()}>Загрузить картинку</button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadPicture(f); }} />
          {board.background && <button className={dangerClass} onClick={removePicture}>Убрать картинку</button>}
        </div>
        {board.background && (
          <div className="flex flex-wrap items-center gap-2">
            <img src={board.background} alt="" className="w-16 h-auto rounded border border-black" />
            <span className="text-sm text-gray-400">Исходный размер: {board.naturalW}×{board.naturalH}</span>
            <button className={buttonClass} onClick={useNaturalSize}>Как у картинки</button>
          </div>
        )}
      </div>

      {/* resolution and proportions */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="field-header">Ширина</span>
          <input type="number" className="w-28" value={board.width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-header">Высота</span>
          <input type="number" className="w-28" value={board.height} onChange={(e) => setHeight(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={board.lockRatio} onChange={(e) => setBoard((b) => ({ ...b, lockRatio: e.target.checked }))} />
          Сохранять пропорции
        </label>
        <span className="pb-2 text-sm text-gray-400">Соотношение: {ratio.toFixed(3)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={() => add("text")}>Текст</button>
        <button className={buttonClass} onClick={() => add("check")}>Чекбокс</button>
        <button className={buttonClass} onClick={() => add("image")}>Картинка</button>
        <button
          className={dangerClass}
          onClick={() => {
            if (window.confirm("Очистить всё на листе? Картинка-основа тоже уберётся.")) {
              setBoard(defaultBoard());
              setSelected(null);
            }
          }}
        >
          Очистить
        </button>
      </div>

      {message && <p className="italic">{message}</p>}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="overflow-auto max-w-full">
          <div
            className="relative shadow-lg"
            onPointerDown={() => setSelected(null)}
            style={{
              width: board.width,
              height: board.height,
              backgroundColor: "#f5f1e6",
              backgroundImage: board.background ? `url("${board.background}")` : undefined,
              backgroundSize: "100% 100%",
            }}
          >
            {board.elements.map((el) => renderEl(el))}
          </div>
        </div>

        {mode === "edit" && (
          <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-2 border border-black rounded p-3 bg-primary-dark-blue">
            {!current && <p className="italic text-gray-400">Нажмите на элемент на листе, чтобы настроить его.</p>}
            {current && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {current.kind === "text" ? "Текст" : current.kind === "check" ? "Чекбокс" : "Картинка"}
                  </span>
                  <button className={dangerClass} onClick={() => remove(current.id)}>Удалить</button>
                </div>
                {textField("Название", "name")}
                {numField("X", "x")}
                {numField("Y", "y")}
                {numField("Ширина", "w")}
                {numField("Высота", "h")}
                {current.kind !== "image" && (
                  <>
                    {numField("Столбцов", "cols")}
                    {numField("Строк", "rows")}
                    {numField("Отступ по X", "gapX")}
                    {numField("Отступ по Y", "gapY")}
                  </>
                )}
                {current.kind === "text" && (
                  <>
                    {numField("Размер шрифта", "font")}
                    <ColorInput label="Цвет" value={current.color as Color} handleValue={(c) => patchEl(current.id, { color: c })} />
                    <label className="flex items-center justify-between gap-2 text-sm">
                      <span>Выравнивание</span>
                      <select value={current.align} onChange={(e) => patchEl(current.id, { align: e.target.value as SheetEl["align"] })}>
                        <option value="left">Слева</option>
                        <option value="center">По центру</option>
                        <option value="right">Справа</option>
                      </select>
                    </label>
                    {toggleField("Счётчик (+/−)", "counter")}
                  </>
                )}
                {current.kind === "check" && (
                  <>
                    {numField("Размер символа", "size")}
                    <ColorInput label="Цвет" value={current.color as Color} handleValue={(c) => patchEl(current.id, { color: c })} />
                  </>
                )}
                {current.kind === "image" && (
                  <>
                    {textField("Ссылка", "url")}
                    {numField("Поворот, °", "rotation")}
                  </>
                )}
                {toggleField("Закрыть в игре", "locked")}
              </>
            )}
          </aside>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="flex flex-col gap-3 w-full max-w-3xl max-h-[85vh] bg-primary-dark-blue border border-black rounded p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Выберите карту из библиотеки</h2>
              <button className={dangerClass} onClick={() => setPickerOpen(false)}>Закрыть</button>
            </div>
            <div className="overflow-y-auto flex flex-wrap gap-3">
              {libLoading && <p className="italic text-gray-400">Загружаем карты…</p>}
              {!libLoading && libCards.length === 0 && <p className="italic text-gray-400">В библиотеке нет карт с превью.</p>}
              {libCards.map((record) => (
                <button key={record.id} className="flex flex-col items-center gap-1 w-28" onClick={() => chooseLibraryCard(record)}>
                  <LazyThumb id={record.id} className="w-24 shrink-0" />
                  <span className="text-xs truncate w-full">{record.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Картинка из библиотеки берётся из превью карты (около 225×315). Для большого размера загрузите картинку файлом.
      </p>
    </div>
  );
};

export default ExtraEditorPage;
