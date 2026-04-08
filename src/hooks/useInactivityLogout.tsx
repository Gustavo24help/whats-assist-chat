import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_BEFORE = 15 * 60 * 1000; // 15 minutes before
const LAST_ACTIVITY_KEY = "last-activity-timestamp";
const TAB_OPENED_KEY = "tab-opened-at";
const TAB_GRACE_PERIOD = 15_000; // 15 seconds grace for new tabs

export function useInactivityLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(15);
  const navigate = useNavigate();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); } catch {}
    setShowWarning(false);
    resetTimers(now);
  }, []);

  const resetTimers = useCallback((now: number) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    warningTimerRef.current = setTimeout(() => {
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
      setShowWarning(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        try { await redistributeChats(user.id); } catch {}
      }
      await supabase.auth.signOut();
      navigate("/auth");
    }, INACTIVITY_TIMEOUT);
  }, [navigate]);

  const dismissWarning = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  useEffect(() => {
    // Mark when this tab was opened
    try { sessionStorage.setItem(TAB_OPENED_KEY, String(Date.now())); } catch {}

    // Check if this is a recently opened tab (grace period)
    let isNewTab = false;
    try {
      const tabOpened = sessionStorage.getItem(TAB_OPENED_KEY);
      if (tabOpened && Date.now() - Number(tabOpened) < TAB_GRACE_PERIOD) {
        isNewTab = true;
      }
    } catch {}

    // Check if already expired on mount
    if (!isNewTab) {
      try {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity) {
          const elapsed = Date.now() - Number(lastActivity);
          if (elapsed >= INACTIVITY_TIMEOUT) {
            supabase.auth.signOut().then(() => navigate("/auth"));
            return;
          }
        }
      } catch {}
    }

    // Initialize — always refresh the activity timestamp
    updateActivity();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    let lastUpdate = 0;
    const handler = () => {
      const now = Date.now();
      if (now - lastUpdate < 30000) return;
      lastUpdate = now;
      updateActivity();
    };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return { showWarning, minutesLeft, dismissWarning };
}
