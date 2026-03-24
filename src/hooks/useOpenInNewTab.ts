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
    (path: string, e?: React.MouseEvent) => {
      // If setting is to open in same tab AND user is admin_ti, navigate normally
      if (sameTab && isAdminTI) {
        window.location.href = path;
      } else {
        window.open(path, "_blank");
      }
    },
    [sameTab, isAdminTI]
  );

  return { openRoute, sameTab, setSameTab, canToggle: isAdminTI };
}
