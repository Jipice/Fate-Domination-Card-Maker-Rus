"use client";

import { useEffect, useState } from "react";
import { subscribeBusy } from "./busy";

// Spinner in the middle of the screen, like a video that is loading.
export const BusyOverlay = () => {
  const [count, setCount] = useState(0);
  useEffect(() => subscribeBusy(setCount), []);
  if (count === 0) return null;
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      <div className="w-14 h-14 rounded-full border-4 border-blue-400 border-t-transparent animate-spin bg-black/40" role="status" aria-label="Загрузка" />
    </div>
  );
};
