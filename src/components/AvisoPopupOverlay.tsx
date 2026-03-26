import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type AvisoPopup = {
  id: string;
  titulo: string;
  conteudo: string;
  enviar_popup: boolean;
  enviar_para_todos: boolean;
};

export const AvisoPopupOverlay = () => {
  const { user } = useAuth();
  const [popupAviso, setPopupAviso] = useState<AvisoPopup | null>(null);
  const [canClose, setCanClose] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!popupAviso) {
      setCanClose(false);
      return;
    }

    const timer = setTimeout(() => setCanClose(true), 2000);

    const handleOutsideClick = (event: MouseEvent) => {
      if (canClose && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupAviso(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [popupAviso, canClose]);

  useEffect(() => {
    if (!user) return;

    const canShowPopupToUser = async (avisoId: string, enviarParaTodos: boolean) => {
      if (enviarParaTodos) return true;

      const { data, error } = await (supabase as any)
        .from("aviso_destinatarios")
        .select("id")
        .eq("aviso_id", avisoId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return false;
      return !!data;
    };

    const channel = supabase
      .channel(`avisos-popup-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "avisos" },
        async (payload) => {
          const aviso = payload.new as AvisoPopup;

          if (!aviso?.id || !aviso.enviar_popup || shownIdsRef.current.has(aviso.id)) return;

          await new Promise((resolve) => setTimeout(resolve, 400));
          const canShow = await canShowPopupToUser(aviso.id, aviso.enviar_para_todos);

          if (!canShow) return;

          shownIdsRef.current.add(aviso.id);
          setPopupAviso(aviso);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!popupAviso) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div
        ref={popupRef}
        className="w-[90vw] max-w-lg rounded-xl border-2 border-primary bg-background shadow-2xl p-6 space-y-4 animate-in zoom-in-95 fade-in duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-bold">
            <Bell className="h-5 w-5 text-brand-yellow" />
            Novo Aviso
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!canClose}
            onClick={() => setPopupAviso(null)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div>
          <p className="font-semibold text-lg leading-tight">{popupAviso.titulo}</p>
          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{popupAviso.conteudo}</p>
        </div>
        {!canClose && (
          <p className="text-xs text-muted-foreground text-center animate-pulse">Aguarde para fechar...</p>
        )}
      </div>
    </div>
  );
};
