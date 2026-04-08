import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "open-links-same-tab";

/** Read the "same tab" preference from localStorage (pure helper) */
export function getSameTabPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Write the "same tab" preference to localStorage (pure helper) */
export function setSameTabPreference(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

/**
 * Stateless hook that exposes only the navigation action.
 * No internal useState — avoids hook-count mismatches across renders.
 */
export function useOpenInNewTab() {
  const { isAdminTI } = useAuth();

  const openRoute = useCallback(
    (path: string) => {
      const url = new URL(path, window.location.origin).href;
      if (isAdminTI && getSameTabPreference()) {
        window.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    },
    [isAdminTI]
  );

  return { openRoute };
}
