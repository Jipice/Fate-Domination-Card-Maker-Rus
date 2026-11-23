"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Pack, parseTts } from "./parseTts";

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";

const CardImage = ({ src, alt, testId }: { src: string; alt: string; testId: string }) => (
  <img
    src={src}
    alt={alt}
    data-testid={testId}
    loading="lazy"
    className="w-24 h-auto rounded border border-black bg-black/40"
  />
);

const PacksPage = () => {
  const [pack, setPack] = useState<Pack | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseTts(JSON.parse(String(reader.result)));
        if (!parsed) {
          setPack(null);
          setMessage("В файле не нашлось коробки. Нужен .json из Saved Objects Tabletop Simulator.");
          return;
        }
        setPack(parsed);
        setMessage(null);
      } catch {
        setPack(null);
        setMessage("Не удалось прочитать файл: это не JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Паки</h1>
        <div className="flex gap-2">
          {pack && (
            <button className="import-export-button bg-gray-700 hover:bg-red-800" onClick={() => setPack(null)}>
              Закрыть
            </button>
          )}
          <button className={buttonClass} onClick={() => fileInput.current?.click()}>
            Загрузить пак
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={importFile} className="hidden" />
        </div>
      </div>

      {message && <p className="italic text-yellow-300">{message}</p>}

      {!pack && !message && (
        <p className="italic text-gray-400">
          Загрузите файл .json из Saved Objects Tabletop Simulator, и сайт покажет коробку пака.
        </p>
      )}

      {pack && (
        <>
          <div className="flex flex-col gap-1 border border-black rounded p-3 bg-primary-dark-blue">
            <span className="text-lg font-semibold">{pack.name}</span>
            <span className="text-sm text-gray-400">
              Карт: {pack.cardCount} · колод: {pack.decks.length} · плиток: {pack.tiles.length}
            </span>
          </div>

          {(pack.token || pack.figure) && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Жетон и фигурка</h2>
              <div className="flex flex-wrap gap-4">
                {pack.token && <CardImage src={pack.token} alt="Жетон" testId="token" />}
                {pack.figure && <CardImage src={pack.figure} alt="Фигурка" testId="figure" />}
              </div>
            </section>
          )}

          {pack.tiles.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Плитки</h2>
              <div className="flex flex-wrap gap-4">
                {pack.tiles.map((tile, i) => (
                  <div key={i} className="flex flex-col gap-1 items-start">
                    <CardImage src={tile.image} alt={tile.name} testId="tile" />
                    <span className="text-xs text-gray-400">{tile.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pack.decks.map((deck, di) => (
            <section key={di} className="flex flex-col gap-2">
              <h2 className="font-semibold">
                {deck.title} <span className="text-sm text-gray-400">({deck.cards.length})</span>
              </h2>
              <div className="flex flex-wrap gap-3">
                {deck.cards.map((card, ci) => (
                  <div key={ci} className="flex flex-col gap-1 items-center">
                    <CardImage src={card.face} alt={card.name || "Карта"} testId="card" />
                    {card.back && <CardImage src={card.back} alt="Рубашка" testId="back" />}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {pack.singles.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">
                Отдельные карты <span className="text-sm text-gray-400">({pack.singles.length})</span>
              </h2>
              <div className="flex flex-wrap gap-3">
                {pack.singles.map((card, ci) => (
                  <div key={ci} className="flex flex-col gap-1 items-center">
                    <CardImage src={card.face} alt={card.name || "Карта"} testId="card" />
                    {card.back && <CardImage src={card.back} alt="Рубашка" testId="back" />}
                    {card.name && <span className="text-xs text-gray-400">{card.name}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default PacksPage;
