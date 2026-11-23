"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "mec-theme";
const EVENT = "mec-theme-change";

export function applyTheme(dark: boolean) {
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  el.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    const next = !getSnapshot();
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  }, []);
  return { dark, toggle };
}
