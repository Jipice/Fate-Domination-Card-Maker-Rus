"use client";

import { useRef } from "react";
import furinaChibi from "@/public/themes/furina-chibi.png";

const CLICKS_TO_TOGGLE = 5;
const RESET_AFTER_MS = 2000; // pause longer than this starts the count over

// Small chibi in the top-right corner: 5 quick clicks switch the site theme.
export const FurinaChibi = ({ onToggle }: { onToggle: () => void }) => {
  const clicks = useRef(0);
  const timer = useRef<number | null>(null);

  const onClick = () => {
    clicks.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      clicks.current = 0;
    }, RESET_AFTER_MS);
    if (clicks.current >= CLICKS_TO_TOGGLE) {
      clicks.current = 0;
      onToggle();
    }
  };

  return (
    <img
      src={furinaChibi.src}
      alt=""
      onClick={onClick}
      draggable={false}
      className="fixed top-2 right-2 w-12 h-auto z-20 cursor-pointer select-none hidden md:block"
    />
  );
};
