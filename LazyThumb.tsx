"use client";

import { useEffect, useRef, useState } from "react";
import { getThumbnail } from "./storage";

// Picture of one card, fetched only when it scrolls into view. Each picture is fetched once.
const pictures = new Map<string, string | null>();

export const LazyThumb = ({ id, className }: { id: string; className: string }) => {
  const [src, setSrc] = useState<string | null | undefined>(pictures.get(id));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pictures.has(id)) {
      setSrc(pictures.get(id));
      return;
    }
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      getThumbnail(id)
        .catch(() => null)
        .then((pic) => {
          pictures.set(id, pic);
          setSrc(pic);
        });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);

  return (
    <div ref={box} className={className}>
      {src ? (
        <img src={src} alt="" className="w-full h-auto rounded border border-black" />
      ) : (
        <div className="w-full h-24 rounded border border-dashed border-gray-500 flex items-center justify-center text-xs text-gray-500 text-center">
          {src === null ? "нет превью" : "…"}
        </div>
      )}
    </div>
  );
};
