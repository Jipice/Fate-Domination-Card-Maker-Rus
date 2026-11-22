"use client";

import furinaBg from "@/public/themes/furina-bg.jpg";

export type Theme = "classic" | "furina";

export const THEME_KEY = "site-theme";

// Only the site's own look changes. Cards, their frames and icons are not touched.
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty(
    "--theme-bg-image",
    theme === "furina" ? `url("${furinaBg.src}")` : "none",
  );
}
