import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PontoClockState {
  loading: boolean;
  registroAberto: any | null;
  config: any | null;
  minutosRestantes: number;
  emHoraExtra: boolean;
  minutosHoraExtra: number;
  horasTrabalhadasHoje: number;
  showEndModal: boolean;
  dismissEndModal: () => void;
  needsEntry: boolean;
}

export const usePontoClock = (): PontoClockState => {
  const { user } = useAuth();
  const [registroAberto, setRegistroAberto] = useState<any | null>(null);
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [needsEntry, setNeedsEntry] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [regResult, cfgResult] = await Promise.all([
      (supabase as any)
        .from("registro_ponto")
        .select("*")
        .eq("user_id", user.id)
        .gte("entrada_em", todayStart.toISOString())
        .is("saida_em", null)
        .order("entrada_em", { ascending: false })
        .limit(1),
      (supabase as any)
        .from("configuracao_ponto")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const registro = regResult.data?.[0] || null;
    setRegistroAberto(registro);
    setConfig(cfgResult.data);
    setNeedsEntry(!registro);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();

    // Refresh data every 60s
    const refreshInterval = setInterval(loadData, 60000);
    return () => clearInterval(refreshInterval);
  }, [loadData]);

  // Tick every second when there's an open record
  useEffect(() => {
    if (registroAberto) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [registroAberto]);

  const cargaMinutos = config?.carga_diaria_minutos ?? 480;

  // Calculate worked minutes today
  let horasTrabalhadasHoje = 0;
  if (registroAberto) {
    const entradaOficial = registroAberto.entrada_oficial || registroAberto.entrada_em;
    const diffMs = now - new Date(entradaOficial).getTime();
    horasTrabalhadasHoje = Math.max(0, diffMs / 60000);
  }

  const minutosRestantes = Math.max(0, cargaMinutos - horasTrabalhadasHoje);
  const emHoraExtra = horasTrabalhadasHoje > cargaMinutos;
  const minutosHoraExtra = emHoraExtra ? horasTrabalhadasHoje - cargaMinutos : 0;

  // Show end-of-shift modal when timer hits 0
  useEffect(() => {
    if (minutosRestantes <= 0 && registroAberto && !modalDismissed && !showEndModal) {
      setShowEndModal(true);
    }
  }, [minutosRestantes, registroAberto, modalDismissed, showEndModal]);

  const dismissEndModal = useCallback(() => {
    setShowEndModal(false);
    setModalDismissed(true);
  }, []);

  return {
    loading,
    registroAberto,
    config,
    minutosRestantes,
    emHoraExtra,
    minutosHoraExtra,
    horasTrabalhadasHoje,
    showEndModal,
    dismissEndModal,
    needsEntry,
  };
};
