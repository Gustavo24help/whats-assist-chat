import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const WARNING_BEFORE = 15 * 60 * 1000; // 15 minutes before
const LAST_ACTIVITY_KEY = "last-activity-timestamp";
// Grace period após (re)montar o hook em uma nova página/aba — evita logout
// imediato baseado em timestamp obsoleto do localStorage quando o usuário
// retoma a sessão (ex.: trocar de rota, voltar para a aba).
const MOUNT_GRACE_MS = 60 * 1000; // 60s
// Após uma navegação interna ou mudança de visibilidade da aba, esperar
// um pequeno intervalo antes de avaliar inatividade.
const NAVIGATION_GRACE_MS = 30 * 1000; // 30s

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
    // Ao (re)montar o hook (troca de página, refresh leve, etc.), NUNCA
    // deslogar imediatamente baseado apenas no localStorage. Sempre dar
    // grace period e renovar a atividade — quem decide se a sessão é
    // válida é o Supabase Auth (token).
    try {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      const now = Date.now();
      if (lastActivity) {
        const elapsed = now - Number(lastActivity);
        // Apenas se passou MUITO tempo (> timeout + grace), confirmar com
        // o Supabase se a sessão ainda existe antes de qualquer ação.
        if (elapsed >= INACTIVITY_TIMEOUT + MOUNT_GRACE_MS) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              // Sem sessão — apenas redireciona, não tenta signOut.
              navigateRef.current("/auth");
            } else {
              // Sessão válida → renova atividade e segue normalmente.
              try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch {}
              resetTimers();
            }
          });
          return;
        }
      }
      // Caso normal: renova o timestamp para evitar que outra aba force logout.
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
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

    // Quando a aba volta a ficar visível, sempre renovar a atividade
    // antes de qualquer avaliação. Isso evita logout ao retornar de
    // outra aba ou ao navegar internamente.
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        updateActivity();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      window.removeEventListener("storage", storageHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      clearAllTimers();
    };
  }, [updateActivity, resetTimers, clearAllTimers]);

  return { showWarning, minutesLeft, dismissWarning };
}
