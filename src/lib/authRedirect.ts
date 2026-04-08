const PENDING_ROUTE_KEY = "auth-pending-route";

/**
 * Save the intended destination so it survives page reloads / new tabs.
 */
export function savePendingRoute(path: string) {
  try {
    if (path && path !== "/" && path !== "/auth" && !path.startsWith("/auth?")) {
      localStorage.setItem(PENDING_ROUTE_KEY, path);
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Resolve post-login destination with priority:
 *  1. returnTo from URL search params
 *  2. pending route saved in localStorage
 *  3. fallback "/"
 *
 * Clears the pending route after reading.
 */
export function resolvePostLoginRoute(): string {
  let destination = "/";

  // Priority 1: returnTo from current URL
  try {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    if (returnTo && returnTo !== "/" && returnTo.startsWith("/")) {
      destination = returnTo;
    }
  } catch {
    // ignore
  }

  // Priority 2: saved pending route (only if URL didn't have one)
  if (destination === "/") {
    try {
      const saved = localStorage.getItem(PENDING_ROUTE_KEY);
      if (saved && saved.startsWith("/") && saved !== "/auth") {
        destination = saved;
      }
    } catch {
      // ignore
    }
  }

  clearPendingRoute();
  return destination;
}

export function clearPendingRoute() {
  try {
    localStorage.removeItem(PENDING_ROUTE_KEY);
  } catch {
    // ignore
  }
}
