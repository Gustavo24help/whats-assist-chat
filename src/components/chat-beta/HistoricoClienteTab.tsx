import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Calendar, DollarSign } from "lucide-react";

interface FichaHistorico {
  id: string;
  nome_ficha: string | null;
  status: string | null;
  valor_total: number | null;
  created_at: string | null;
  prestador_id: string | null;
  categoria_id: number | null;
}

interface HistoricoClienteTabProps {
  clienteTelefone: string;
  fichaAtualId?: string | null;
}

const formatMoeda = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const statusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!status) return "outline";
  if (status === "Finalizado") return "default";
  if (["Perdido", "Não foi adiante"].includes(status)) return "destructive";
  if (["Agendado", "Orçamento Aprovado / Agendamento"].includes(status)) return "secondary";
  return "outline";
};

export const HistoricoClienteTab = ({ clienteTelefone, fichaAtualId }: HistoricoClienteTabProps) => {
  const [fichas, setFichas] = useState<FichaHistorico[]>([]);
  const [categorias, setCategorias] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("fichas_de_servico")
          .select("id, nome_ficha, status, valor_total, created_at, prestador_id, categoria_id")
          .eq("telefone_cliente", clienteTelefone)
          .order("created_at", { ascending: false });

        const lista = (data || []) as FichaHistorico[];
        setFichas(lista);

        // Carregar nomes de categorias
        const catIds = Array.from(new Set(lista.map((f) => f.categoria_id).filter(Boolean))) as number[];
        if (catIds.length > 0) {
          const { data: cats } = await supabase
            .from("categorias")
            .select("id, nome")
            .in("id", catIds);
          const map: Record<number, string> = {};
          (cats || []).forEach((c: any) => { map[c.id] = c.nome; });
          setCategorias(map);
        }
      } finally {
        setLoading(false);
      }
    };
    if (clienteTelefone) load();
  }, [clienteTelefone]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fichas.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Nenhuma ficha encontrada para este cliente.</p>
      </div>
    );
  }

  // Métricas agregadas
  const total = fichas.length;
  const finalizadas = fichas.filter((f) => f.status === "Finalizado").length;
  const valorTotal = fichas
    .filter((f) => f.status === "Finalizado")
    .reduce((acc, f) => acc + (Number(f.valor_total) || 0), 0);

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-muted/30 rounded p-2 text-center">
          <p className="text-sm font-bold text-foreground">{total}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Total Fichas</p>
        </div>
        <div className="bg-emerald-500/10 rounded p-2 text-center">
          <p className="text-sm font-bold text-emerald-600">{finalizadas}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Finalizadas</p>
        </div>
        <div className="bg-primary/10 rounded p-2 text-center">
          <p className="text-xs font-bold text-primary truncate">{formatMoeda(valorTotal)}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Faturado</p>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-2">
          {fichas.map((ficha) => {
            const isAtual = ficha.id === fichaAtualId;
            return (
              <div
                key={ficha.id}
                className={`rounded-lg border p-2.5 ${
                  isAtual ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold truncate">
                        {ficha.nome_ficha || ficha.id}
                      </p>
                      {isAtual && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 shrink-0">
                          ATUAL
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{ficha.id}</p>
                  </div>
                  <Badge variant={statusVariant(ficha.status)} className="text-[9px] px-1.5 py-0 shrink-0">
                    {ficha.status || "—"}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {ficha.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(ficha.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {ficha.valor_total ? (
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <DollarSign className="h-2.5 w-2.5" />
                      {formatMoeda(Number(ficha.valor_total))}
                    </span>
                  ) : null}
                  {ficha.categoria_id && categorias[ficha.categoria_id] && (
                    <span className="truncate">{categorias[ficha.categoria_id]}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
