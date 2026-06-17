import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Convite {
  id: string;
  ficha_id: string;
  prestador_cpf: string;
  prestador_nome: string | null;
  status: "pendente" | "aceito" | "recusado" | "expirado" | "cancelado";
  enviado_em: string;
  expira_em: string;
  respondido_em: string | null;
}

interface Props {
  fichaId: string;
  categoriaNome: string | null;
  onSugerirProximo?: (cpf: string) => void;
}

export function ConviteAtivoBadge({ fichaId, categoriaNome, onSugerirProximo }: Props) {
  const [convite, setConvite] = useState<Convite | null>(null);
  const [now, setNow] = useState(Date.now());

  // Carrega convite mais recente
  const reload = async () => {
    const { data } = await supabase
      .from("convites_prestador")
      .select("id, ficha_id, prestador_cpf, prestador_nome, status, enviado_em, expira_em, respondido_em")
      .eq("ficha_id", fichaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setConvite((data as any) ?? null);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`convite-${fichaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "convites_prestador", filter: `ficha_id=eq.${fichaId}` },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaId]);

  // Tick para countdown
  useEffect(() => {
    if (convite?.status !== "pendente") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [convite?.status]);

  const restanteMs = useMemo(() => {
    if (!convite) return 0;
    return new Date(convite.expira_em).getTime() - now;
  }, [convite, now]);

  // Auto-flip para expirado quando o tempo zerar (UI; cron faz no servidor)
  useEffect(() => {
    if (convite?.status === "pendente" && restanteMs <= 0) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restanteMs, convite?.status]);

  const sugerirProximo = async () => {
    if (!categoriaNome) {
      toast.error("Ficha sem categoria");
      return;
    }
    const { data: ps } = await supabase
      .from("prestadores")
      .select("cpf, nome, categoria, ativo")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    const { data: convites } = await supabase
      .from("convites_prestador")
      .select("prestador_cpf")
      .eq("ficha_id", fichaId);
    const jaConvidados = new Set((convites ?? []).map((c: any) => c.prestador_cpf));
    const cand = (ps ?? []).find(
      (p) =>
        (p.categoria || "").toLowerCase() === categoriaNome.toLowerCase() && !jaConvidados.has(p.cpf),
    );
    if (!cand) {
      toast.warning("Nenhum prestador disponível na categoria");
      return;
    }
    onSugerirProximo?.(cand.cpf);
    toast.success(`Próximo sugerido: ${cand.nome}`);
  };

  if (!convite) return null;

  if (convite.status === "pendente") {
    const totalSec = Math.max(0, Math.floor(restanteMs / 1000));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    const urgente = totalSec <= 180;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={`gap-1 ${urgente ? "border-amber-500 text-amber-700 bg-amber-50" : "border-blue-500 text-blue-700 bg-blue-50"}`}
        >
          <Clock className="h-3 w-3" />
          Convite pendente — {convite.prestador_nome || "prestador"} • {mm}:{ss}
        </Badge>
      </div>
    );
  }

  if (convite.status === "aceito") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-700 bg-emerald-50">
        <CheckCircle2 className="h-3 w-3" />
        Aceito por {convite.prestador_nome || "prestador"}
      </Badge>
    );
  }

  if (convite.status === "recusado" || convite.status === "expirado") {
    const isExp = convite.status === "expirado";
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`gap-1 ${isExp ? "border-amber-500 text-amber-700 bg-amber-50" : "border-rose-500 text-rose-700 bg-rose-50"}`}>
          {isExp ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {isExp ? "Convite expirou" : "Convite recusado"} — {convite.prestador_nome || ""}
        </Badge>
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={sugerirProximo}>
          Sugerir próximo
        </Button>
      </div>
    );
  }

  return null;
}
