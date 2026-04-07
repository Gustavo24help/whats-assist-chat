import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_BEFORE = 15 * 60 * 1000; // 15 minutes before
const LAST_ACTIVITY_KEY = "last-activity-timestamp";

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

    // Set warning timer (1h45m from now)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setMinutesLeft(15);
      
      // Start countdown
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

    // Set logout timer (2h from now)
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
    // Check if already expired on mount
    try {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - Number(lastActivity);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          // Expired while away — logout immediately
          supabase.auth.signOut().then(() => navigate("/auth"));
          return;
        }
      }
    } catch {}

    // Initialize
    updateActivity();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    
    // Throttle to avoid excessive updates
    let lastUpdate = 0;
    const handler = () => {
      const now = Date.now();
      if (now - lastUpdate < 30000) return; // throttle: once per 30s
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
