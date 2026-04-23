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

type MouseLikeEvent = {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: () => void;
};

/**
 * Stateless hook that exposes navigation actions.
 * - openRoute(path): normal click navigation (respects same-tab preference for admin TI)
 * - getLinkHandlers(path): spreadable handlers for buttons that should behave like links,
 *   opening in a new tab on middle-click / ctrl+click / cmd+click.
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

  const openInNewTab = useCallback((path: string) => {
    const url = new URL(path, window.location.origin).href;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /**
   * Returns handlers for elements that should behave like links.
   * Middle-click (button 1) or ctrl/cmd+click always opens in a new tab.
   */
  const getLinkHandlers = useCallback(
    (path: string) => ({
      onClick: (e: MouseLikeEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.preventDefault?.();
          openInNewTab(path);
          return;
        }
        openRoute(path);
      },
      onAuxClick: (e: MouseLikeEvent) => {
        // Middle mouse button
        if (e.button === 1) {
          e.preventDefault?.();
          openInNewTab(path);
        }
      },
      onMouseDown: (e: MouseLikeEvent) => {
        // Prevent default autoscroll behavior on middle-click
        if (e.button === 1) {
          e.preventDefault?.();
        }
      },
    }),
    [openRoute, openInNewTab]
  );

  return { openRoute, openInNewTab, getLinkHandlers };
}
