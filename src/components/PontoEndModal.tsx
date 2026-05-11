import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";
import { Button } from "@/components/ui/button";
import { Clock3, LogOut, ArrowRight } from "lucide-react";

interface PontoEndModalProps {
  open: boolean;
  onContinue: () => void;
}

export const PontoEndModal = ({ open, onContinue }: PontoEndModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!open) return null;

  const handleLogout = async () => {
    if (user?.id) {
      // Register saída
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: openReg } = await (supabase as any)
        .from("registro_ponto")
        .select("id")
        .eq("user_id", user.id)
        .gte("entrada_em", todayStart.toISOString())
        .is("saida_em", null)
        .limit(1);

      if (openReg?.[0]) {
        await (supabase as any)
          .from("registro_ponto")
          .update({ saida_em: new Date().toISOString() })
          .eq("id", openReg[0].id);
      }

      try { await redistributeChats(user.id); } catch {}
    }
    try {
      localStorage.removeItem("last-activity-timestamp");
    } catch {}
    await supabase.auth.signOut({ scope: "global" });
    navigate("/auth", { replace: true });
    window.location.replace("/auth");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-6 border">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock3 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Carga horária completada!</h2>
        <p className="text-muted-foreground">
          Você atingiu sua carga horária diária. Deseja encerrar o expediente ou
          continuar trabalhando em hora extra?
        </p>
        <div className="flex flex-col gap-3">
          <Button size="lg" variant="destructive" onClick={handleLogout} className="w-full gap-2">
            <LogOut className="h-5 w-5" />
            Deslogar
          </Button>
          <Button size="lg" variant="outline" onClick={onContinue} className="w-full gap-2">
            <ArrowRight className="h-5 w-5" />
            Continuar (Hora Extra)
          </Button>
        </div>
      </div>
    </div>
  );
};
