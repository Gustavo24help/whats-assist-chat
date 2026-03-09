import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  ExternalLink,
  Copy,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const EXCLUDED_FICHAS = ["FS4-260127"];

export const PagamentoClientesTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select("*")
        .eq("status_pagamento_cliente", "pendente")
        .order("data_execucao", { ascending: false });

      if (error) throw error;
      const filtered = (data || []).filter(
        (t: any) => !EXCLUDED_FICHAS.includes(t.ficha_id)
      );
      setTransacoes(filtered);
    } catch (e: any) {
      console.error("Erro ao carregar pagamentos clientes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const marcarClientePagou = async (transacao: any) => {
    try {
      setMarkingPaid(transacao.id);
      const agora = new Date().toISOString();

      await supabase
        .from("transacoes_financeiras")
        .update({
          status_pagamento_cliente: "pago",
        } as any)
        .eq("id", transacao.id);

      // Notify Make.com to update spreadsheet
      try {
        await supabase.functions.invoke("webhook-update-planilha", {
          body: {
            tipo: "pagamento_cliente",
            ficha_id: transacao.ficha_id,
            transacao_id: transacao.id,
            cliente_nome: transacao.cliente_nome,
            prestador_nome: transacao.prestador_nome,
            valor_cliente_final: transacao.valor_cliente_final,
            status: "pago",
            data_pagamento: agora,
          },
        });
      } catch (webhookErr) {
        console.error("Webhook planilha error (não bloqueante):", webhookErr);
      }

      toast({ title: "✅ Pagamento do cliente confirmado!" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const totalPendente = transacoes.reduce((s, t) => s + (t.valor_cliente_final || 0), 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <Card className="min-w-[160px] bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 shrink-0">
          <div className="text-xs text-amber-600 dark:text-amber-400">Pendentes</div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">{transacoes.length}</div>
        </Card>
        <Card className="min-w-[160px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
          <div className="text-xs text-blue-600 dark:text-blue-400">Valor Total Pendente</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-300">{formatMoeda(totalPendente)}</div>
        </Card>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando...</span>
          </div>
        ) : transacoes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-muted-foreground">Todos os pagamentos de clientes estão em dia!</p>
          </div>
        ) : (
          transacoes.map((t) => (
            <Card key={t.id} className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{t.cliente_nome}</h3>
                  <p className="text-xs text-muted-foreground">{t.cliente_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-primary">{formatMoeda(t.valor_cliente_final)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="secondary" className="text-xs">{t.ficha_id}</Badge>
                {t.categoria && <Badge variant="outline" className="text-xs">{t.categoria}</Badge>}
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  {format(parseISO(t.data_execucao), "dd/MM/yy")}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground mb-3">
                <span className="font-medium">Prestador:</span> {t.prestador_nome}
                {t.forma_pagamento_cliente && (
                  <span> • <span className="font-medium">Forma:</span> {t.forma_pagamento_cliente}</span>
                )}
              </div>

              {/* Payment link */}
              {t.link_pagamento_asaas && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 mb-3 text-xs flex items-center gap-2">
                  <ExternalLink className="h-3 w-3 text-blue-600 shrink-0" />
                  <a
                    href={t.link_pagamento_asaas}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    Link de pagamento
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => copyToClipboard(t.link_pagamento_asaas)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={markingPaid === t.id}
                onClick={() => marcarClientePagou(t)}
              >
                {markingPaid === t.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Cliente Pagou
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
