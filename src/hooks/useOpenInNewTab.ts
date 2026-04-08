import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "open-links-same-tab";

/**
 * Hook that controls whether navigation links open in new tabs.
 * By default, links open in new tabs. Only "admin_ti" users can disable this.
 */
export function useOpenInNewTab() {
  const { isAdminTI } = useAuth();
  const [sameTab, setSameTab] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sameTab));
  }, [sameTab]);

  const openRoute = useCallback(
    (path: string, _e?: React.MouseEvent) => {
      if (sameTab && isAdminTI) {
        // Same-tab navigation
        window.location.href = new URL(path, window.location.origin).href;
      } else {
        // Build absolute URL so the new tab opens the correct origin
        const url = new URL(path, window.location.origin).href;
        window.open(url, "_blank");
      }
    },
    [sameTab, isAdminTI]
  );

  return { openRoute, sameTab, setSameTab, canToggle: isAdminTI };
}
