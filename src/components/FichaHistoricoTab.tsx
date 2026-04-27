import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  History, ArrowRightLeft, Wrench, CheckCircle2, RotateCcw, AlertTriangle,
  MessageSquare, DollarSign, FileEdit, Bot, UserCheck, Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FichaHistoricoTabProps {
  fichaId: string | null;
}

type EventoHistorico = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  data: string; // ISO
  origem: "status" | "prestador" | "interno" | "observacao";
  metadata?: any;
};

const ICONE_POR_TIPO: Record<string, { icon: any; color: string }> = {
  status_change: { icon: ArrowRightLeft, color: "text-blue-600" },
  ficha_criada: { icon: FileEdit, color: "text-green-600" },
  visita_tecnica: { icon: Wrench, color: "text-blue-600" },
  servico_executado: { icon: CheckCircle2, color: "text-green-600" },
  retorno: { icon: RotateCcw, color: "text-purple-600" },
  comparecimento: { icon: AlertTriangle, color: "text-amber-600" },
  ocorrencia: { icon: MessageSquare, color: "text-muted-foreground" },
  pagamento: { icon: DollarSign, color: "text-emerald-600" },
  bot_toggle: { icon: Bot, color: "text-orange-600" },
  chat_assumido: { icon: UserCheck, color: "text-indigo-600" },
  observacao: { icon: MessageSquare, color: "text-muted-foreground" },
  default: { icon: Clock, color: "text-muted-foreground" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Parse "[dd/MM/yyyy HH:mm] texto" do campo notas
const parseObservacoes = (notas: string | null): EventoHistorico[] => {
  if (!notas) return [];
  const lines = notas.split("\n").filter((l) => l.trim());
  const events: EventoHistorico[] = [];
  lines.forEach((line, idx) => {
    const match = line.match(/^\[(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\]\s*(.*)$/);
    if (match) {
      const [, dd, mm, yyyy, hh, mi, texto] = match;
      const iso = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00`).toISOString();
      events.push({
        id: `obs-${idx}`,
        tipo: "observacao",
        titulo: "Observação",
        descricao: texto.trim(),
        data: iso,
        origem: "observacao",
      });
    } else {
      // Linha sem data: usa now() apenas como fallback estável
      events.push({
        id: `obs-${idx}`,
        tipo: "observacao",
        titulo: "Observação",
        descricao: line.trim(),
        data: new Date(0).toISOString(),
        origem: "observacao",
      });
    }
  });
  return events;
};

export const FichaHistoricoTab = ({ fichaId }: FichaHistoricoTabProps) => {
  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fichaId) return;
    let cancelado = false;

    const carregar = async () => {
      setLoading(true);
      const todos: EventoHistorico[] = [];

      // 1) Status histórico
      const { data: statusRows } = await supabase
        .from("ficha_status_historico")
        .select("id, status_anterior, status_novo, data_inicio")
        .eq("ficha_id", fichaId)
        .order("data_inicio", { ascending: false });

      (statusRows || []).forEach((r: any) => {
        const ehInicio = !r.status_anterior;
        todos.push({
          id: `status-${r.id}`,
          tipo: ehInicio ? "ficha_criada" : "status_change",
          titulo: ehInicio ? "Ficha criada" : "Mudança de status",
          descricao: ehInicio
            ? `Status inicial: ${r.status_novo}`
            : `${r.status_anterior} → ${r.status_novo}`,
          data: r.data_inicio,
          origem: "status",
          metadata: r,
        });
      });

      // 2) Prestador histórico (filtrado por ficha)
      const { data: prestRows } = await supabase
        .from("prestador_historico")
        .select("id, tipo_evento, descricao, created_at, dados_extras")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false });

      (prestRows || []).forEach((r: any) => {
        const dataEvento = r.dados_extras?.data_evento || r.created_at;
        todos.push({
          id: `prest-${r.id}`,
          tipo: r.tipo_evento,
          titulo: r.tipo_evento.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          descricao: r.descricao,
          data: dataEvento,
          origem: "prestador",
          metadata: r.dados_extras,
        });
      });

      // 3) User internal history (ações de operadores nesta ficha)
      const { data: histRows } = await supabase
        .from("user_internal_history")
        .select("id, history_type, description, created_at, metadata, user_id")
        .eq("reference_id", fichaId)
        .order("created_at", { ascending: false })
        .limit(100);

      (histRows || []).forEach((r: any) => {
        let tipo = r.history_type;
        let titulo = r.history_type;
        if (r.history_type === "ficha_status") tipo = "status_change";
        else if (r.history_type === "transacao_criada" || r.history_type === "pagamento_atualizado") tipo = "pagamento";
        else if (r.history_type === "bot_toggle") tipo = "bot_toggle";
        titulo = tipo.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

        // Evita duplicar mudança de status (já vinda de ficha_status_historico)
        if (r.history_type === "ficha_status") return;

        todos.push({
          id: `int-${r.id}`,
          tipo,
          titulo,
          descricao: r.description,
          data: r.created_at,
          origem: "interno",
          metadata: r.metadata,
        });
      });

      // 4) Observações livres (campo notas)
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("notas")
        .eq("id", fichaId)
        .maybeSingle();
      const obs = parseObservacoes(ficha?.notas || null);
      todos.push(...obs);

      // Ordena desc por data
      todos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (!cancelado) {
        setEventos(todos);
        setLoading(false);
      }
    };

    carregar();
    return () => { cancelado = true; };
  }, [fichaId]);

  if (!fichaId) {
    return <div className="text-sm text-muted-foreground p-3">Selecione uma ficha.</div>;
  }

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Histórico da ficha</h3>
        <Badge variant="outline" className="ml-auto text-xs">{eventos.length} eventos</Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado nesta ficha.</p>
      ) : (
        <div className="relative space-y-2">
          {eventos.map((ev) => {
            const cfg = ICONE_POR_TIPO[ev.tipo] || ICONE_POR_TIPO.default;
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className="flex gap-2.5 rounded-md border p-2.5 bg-card">
                <div className={`shrink-0 mt-0.5 ${cfg.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ev.titulo}
                    </p>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(ev.data)}
                    </p>
                  </div>
                  <p className="text-sm mt-0.5 break-words">{ev.descricao}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
