import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const WARNING_BEFORE = 15 * 60 * 1000; // 15 minutes before
const LAST_ACTIVITY_KEY = "last-activity-timestamp";

export function useInactivityLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(15);
  const navigate = useNavigate();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigateRef = useRef(navigate);

  // Keep navigate ref fresh to avoid stale closures
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();

    warningTimerRef.current = setTimeout(() => {
      // Before showing warning, re-check localStorage in case another tab updated it
      try {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity) {
          const elapsed = Date.now() - Number(lastActivity);
          if (elapsed < INACTIVITY_TIMEOUT - WARNING_BEFORE) {
            // Another tab was active — reschedule
            resetTimers();
            return;
          }
        }
      } catch {}

      setShowWarning(true);
      setMinutesLeft(15);
      countdownRef.current = setInterval(() => {
        setMinutesLeft(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 60000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    logoutTimerRef.current = setTimeout(async () => {
      // Final check: did another tab refresh activity?
      try {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity) {
          const elapsed = Date.now() - Number(lastActivity);
          if (elapsed < INACTIVITY_TIMEOUT) {
            // Another tab was active — reschedule instead of logging out
            resetTimers();
            return;
          }
        }
      } catch {}

      setShowWarning(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        try { await redistributeChats(user.id); } catch {}
      }
      await supabase.auth.signOut();
      navigateRef.current("/auth");
    }, INACTIVITY_TIMEOUT);
  }, [clearAllTimers]);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); } catch {}
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  const dismissWarning = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  useEffect(() => {
    // Check if already expired on mount (only if not a fresh page load)
    try {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - Number(lastActivity);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              supabase.auth.signOut().then(() => navigateRef.current("/auth"));
            }
          });
          return;
        }
      }
    } catch {}

    // Initialize
    updateActivity();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    let lastUpdate = 0;
    const handler = () => {
      const now = Date.now();
      if (now - lastUpdate < 30000) return; // throttle: 30s
      lastUpdate = now;
      updateActivity();
    };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    // Listen for activity updates from OTHER tabs via localStorage
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        // Another tab registered activity — reset our timers
        setShowWarning(false);
        resetTimers();
      }
    };
    window.addEventListener("storage", storageHandler);

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      window.removeEventListener("storage", storageHandler);
      clearAllTimers();
    };
  }, [updateActivity, resetTimers, clearAllTimers]);

  return { showWarning, minutesLeft, dismissWarning };
}
