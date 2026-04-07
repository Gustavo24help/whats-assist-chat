import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useExitReminder() {
  const { user } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [exitTime, setExitTime] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alreadyShownRef = useRef(false);

  const dismiss = useCallback(() => {
    setShowReminder(false);
    alreadyShownRef.current = true;
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const fetchAndStart = async () => {
      const { data } = await supabase
        .from("horario_saida_previsto" as any)
        .select("hora_saida, lembrete_minutos_antes")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || !data) return;

      const config = data as any;
      setExitTime(config.hora_saida);

      const check = () => {
        if (alreadyShownRef.current) return;

        const now = new Date();
        const [h, m] = (config.hora_saida as string).split(":").map(Number);
        const exitDate = new Date();
        exitDate.setHours(h, m, 0, 0);

        const reminderDate = new Date(exitDate.getTime() - config.lembrete_minutos_antes * 60000);

        if (now >= reminderDate && now < exitDate) {
          setShowReminder(true);
        }
      };

      check();
      intervalRef.current = setInterval(check, 60000);
    };

    fetchAndStart();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);

  // Reset daily
  useEffect(() => {
    const midnight = () => {
      alreadyShownRef.current = false;
    };
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const ms = tomorrow.getTime() - now.getTime();
    const t = setTimeout(midnight, ms);
    return () => clearTimeout(t);
  }, []);

  return { showReminder, exitTime, dismiss };
}
