"use client";

import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

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
  color: string;
  counter: boolean; // text only: +/- buttons next to each cell
  locked: boolean; // in play mode the element cannot be changed
  size: number; // check: symbol size
  url: string; // image
  rotation: number; // image, degrees
};

type SheetData = {
  name: string;
  width: number;
  height: number;
  background: string;
  elements: SheetEl[];
};

const KEY = "fate-sheet-current";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CHECK_SYMBOL: Record<number, string> = { 0: "◌", 1: "○", 2: "●" };

const defaultSheet = (): SheetData => ({
  name: "Новый лист",
  width: 690,
  height: 791,
  background: "",
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

// position of cell i on the sheet
function cellPos(el: SheetEl, i: number) {
  return {
    left: el.x + (i % el.cols) * (el.w + el.gapX),
    top: el.y + Math.floor(i / el.cols) * (el.h + el.gapY),
  };
}

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";
const dangerClass = "import-export-button bg-gray-700 hover:bg-red-800 justify-center";

// ---- page

const SheetPage = () => {
  const [sheet, setSheet] = useState<SheetData>(defaultSheet());
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "play">("edit");
  const [message, setMessage] = useState<string | null>(null);
  const loaded = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);

  // restore the last sheet, then keep saving every change in this browser
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as SheetData;
        if (Array.isArray(data.elements)) setSheet(data);
      }
    } catch {
      /* nothing saved or unreadable */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(sheet));
    } catch {
      /* storage full: the sheet still works, it is just not kept */
    }
  }, [sheet]);

  const current = sheet.elements.find((e) => e.id === selected) ?? null;

  const patchEl = (id: string, patch: Partial<SheetEl>) =>
    setSheet((s) => ({
      ...s,
      elements: s.elements.map((e) => {
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
    if (el.locked && mode === "play") return;
    const v = Number(el.values[i]);
    let next: number;
    if (right) next = v === 0 ? 1 : 0;
    else next = v === 1 ? 2 : 1;
    setCell(el, i, next);
  };

  const add = (kind: Kind) => {
    const el = newElement(kind, sheet.elements.length);
    setSheet((s) => ({ ...s, elements: [...s.elements, el] }));
    setSelected(el.id);
    setMode("edit");
  };

  const remove = (id: string) => {
    setSheet((s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) }));
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

  // ---- saving and loading a sheet file

  const exportSheet = () => {
    const blob = new Blob([JSON.stringify({ format: "fate-sheet", version: 1, sheet }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sheet.name || "sheet"}.fate-sheet.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importSheet = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const s = data.sheet ?? data;
        if (!s || !Array.isArray(s.elements)) throw new Error("bad file");
        setSheet({
          name: String(s.name ?? "Лист"),
          width: Number(s.width) || 690,
          height: Number(s.height) || 791,
          background: String(s.background ?? ""),
          elements: s.elements as SheetEl[],
        });
        setSelected(null);
        setMessage("Лист загружен.");
      } catch {
        setMessage("Не удалось открыть файл: это не лист.");
      }
    };
    reader.readAsText(file);
  };

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
              style={{
                left,
                top,
                width: el.w,
                height: el.h,
                fontSize: el.font,
                color: el.color,
                textAlign: el.align,
                padding: "0 4px",
              }}
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
          onClick={() => clickCheck(el, i, false)}
          onContextMenu={(e) => {
            e.preventDefault();
            clickCheck(el, i, true);
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

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Лист</h1>
        <div className="flex flex-wrap gap-2">
          <button className={mode === "edit" ? buttonClass : dangerClass} onClick={() => setMode("edit")}>Редактирование</button>
          <button className={mode === "play" ? buttonClass : dangerClass} onClick={() => { setMode("play"); setSelected(null); }}>Игра</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={() => add("text")}>Текст</button>
        <button className={buttonClass} onClick={() => add("check")}>Чекбокс</button>
        <button className={buttonClass} onClick={() => add("image")}>Картинка</button>
        <button className={buttonClass} onClick={exportSheet}>Скачать лист</button>
        <button className={buttonClass} onClick={() => importInput.current?.click()}>Открыть файл</button>
        <input ref={importInput} type="file" accept=".json,application/json" onChange={importSheet} className="hidden" />
        <button
          className={dangerClass}
          onClick={() => {
            if (window.confirm("Очистить лист?")) {
              setSheet(defaultSheet());
              setSelected(null);
            }
          }}
        >
          Очистить
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="field-header">Название</span>
          <input type="text" value={sheet.name} onChange={(e) => setSheet((s) => ({ ...s, name: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-header">Ширина</span>
          <input type="number" className="w-28" value={sheet.width} onChange={(e) => setSheet((s) => ({ ...s, width: Number(e.target.value) || s.width }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-header">Высота</span>
          <input type="number" className="w-28" value={sheet.height} onChange={(e) => setSheet((s) => ({ ...s, height: Number(e.target.value) || s.height }))} />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[16rem]">
          <span className="field-header">Фон (ссылка на картинку, необязательно)</span>
          <input type="text" value={sheet.background} placeholder="https://..." onChange={(e) => setSheet((s) => ({ ...s, background: e.target.value.trim() }))} />
        </label>
      </div>

      {message && <p className="italic">{message}</p>}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="overflow-auto max-w-full">
          <div
            className="relative shadow-lg"
            onPointerDown={() => setSelected(null)}
            style={{
              width: sheet.width,
              height: sheet.height,
              backgroundColor: "#f5f1e6",
              backgroundImage: sheet.background ? `url("${sheet.background}")` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {sheet.elements.map((el) => renderEl(el))}
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
                    {textField("Цвет", "color")}
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
                    {textField("Цвет", "color")}
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

      <p className="text-xs text-gray-400">
        Режим «Игра»: в тексте заполняйте значения и жмите +/−, чекбоксы ставятся левым кликом (правый — «отключить»).
        Закрытые элементы в игре нельзя менять.
      </p>
    </div>
  );
};

export default SheetPage;
