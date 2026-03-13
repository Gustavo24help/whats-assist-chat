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
  const popupRef = useRef<HTMLDivElement>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!popupAviso) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupAviso(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [popupAviso]);

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
    <div className="fixed right-6 bottom-6 z-[80] pointer-events-none">
      <div ref={popupRef} className="pointer-events-auto w-[360px] rounded-lg border bg-background shadow-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-brand-yellow" />
            Novo aviso
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPopupAviso(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <p className="font-medium leading-tight">{popupAviso.titulo}</p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-4 whitespace-pre-wrap">{popupAviso.conteudo}</p>
        </div>
      </div>
    </div>
  );
};
