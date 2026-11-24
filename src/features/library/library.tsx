"use client";

import { FaSave } from "react-icons/fa";
import { snapdom } from "@zumer/snapdom";
import { useEffect, useState } from "react";
import type { CardRecord, PageKey } from "./db";
import { getCard, putCard } from "./storage";
import { refreshLibrary } from "./cache";

export type { PageKey, CardRecord } from "./db";

export const PAGE_INFO: Record<PageKey, { label: string; path: string }> = {
  "master-card": { label: "Карта мастера", path: "/" },
  "servant-card": { label: "Карта слуги", path: "/servant-summon" },
  "master-token": { label: "Жетон мастера", path: "/master-token" },
  "master-standee": { label: "Фигурка мастера", path: "/master-standee" },
  "master-box": { label: "Коробка мастера", path: "/master-box" },
  "command-seal": { label: "Командное заклинание", path: "/command-seal" },
};

// Blob URLs (from the cropper) do not survive a reload, so store them as data URLs.
async function makePersistable(form: unknown): Promise<Record<string, unknown>> {
  const copy = { ...(form as Record<string, unknown>) };
  const pic = copy.pic;
  if (typeof pic === "string" && pic.startsWith("blob:")) {
    const blob = await (await fetch(pic)).blob();
    copy.pic = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return copy;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Small picture of the card for the library list. Returns null if capture fails.
async function makeThumbnail(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;
  try {
    const result = await snapdom(element);
    const blob = await result.toBlob({ type: "png", scale: 0.6 });
    return await blobToDataUrl(blob);
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fills the page form when the URL contains ?library=<id>.
// Returns the id of the loaded record (or null), so saving updates it instead of duplicating.
export function useLibraryLoader<T>(
  page: PageKey,
  setForm: (value: T) => void,
): string | null {
  const [libraryId, setLibraryId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("library");
    if (!id) return;
    getCard(id).then((record) => {
      if (record && record.page === page) {
        setForm(record.form as T);
        setLibraryId(record.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return libraryId;
}

type SaveProps = {
  page: PageKey;
  captureId: string; // id of the hidden full-size card used for downloads
  name: string;
  getForm: () => unknown;
  libraryId?: string | null;
  variant?: "big" | "small"; // kept for callers; all sizes are the same now
};

// "big" matches the wide Скачать button, "small" matches the Сохранить/Загрузить buttons.
export const SaveToLibraryButton = ({
  page,
  captureId,
  name,
  getForm,
  libraryId = null,
  variant = "big",
}: SaveProps) => {
  const [id, setId] = useState<string | null>(libraryId);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    setId(libraryId);
  }, [libraryId]);

  // A card that was imported without a picture gets one the first time it is opened in the editor.
  // Only the big button does this, so a page with two buttons does it once.
  useEffect(() => {
    if (!libraryId || variant === "small") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const record = await getCard(libraryId);
      if (!record || record.thumbnail || cancelled) return;
      const thumbnail = await makeThumbnail(captureId);
      if (thumbnail && !cancelled) await putCard({ ...record, thumbnail });
        refreshLibrary({ force: true }).catch(() => {});
    }, 1200); // give the editor time to draw the loaded form
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId]);

  const save = async () => {
    setStatus("saving");
    try {
      const form = await makePersistable(getForm());
      const thumbnail = await makeThumbnail(captureId);
      const recordId = id ?? crypto.randomUUID();
      // keep the folder the card is already in when it is updated
      const existing = await getCard(recordId);
      const record: CardRecord = {
        id: recordId,
        page,
        name: name || PAGE_INFO[page].label,
        savedAt: Date.now(),
        form,
        folderId: existing?.folderId ?? null,
        thumbnail,
      };
      await putCard(record);
      refreshLibrary({ force: true }).catch(() => {});
      // a new save creates a new card; only a card opened from the library is updated in place
      setStatus("saved");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 1600);
  };

  const text =
    status === "saving"
      ? "Сохранение..."
      : status === "saved"
        ? "Сохранено ✓"
        : status === "error"
          ? "Ошибка"
          : "В библиотеку";

  const className = "import-export-button bg-blue-500 hover:bg-blue-400";

  return (
    <button
      type="button"
      onClick={save}
      disabled={status === "saving"}
      className={className}
    >
      <FaSave />
      {text}
    </button>
  );
};
