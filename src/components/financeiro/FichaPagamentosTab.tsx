import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { IdBadge } from "@/components/ui/IdBadge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, ArrowDownToLine, ArrowUpFromLine, Wallet, Loader2 } from "lucide-react";

interface FichaPagamentosTabProps {
  fichaId: string;
}

type PagamentoItem = {
  id: string;
  tipo: "receber" | "transacao" | "pagar_manual";
  descricao: string;
  valor: number;
  status: string;
  data: string;
};

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export const FichaPagamentosTab = ({ fichaId }: FichaPagamentosTabProps) => {
  const [itens, setItens] = useState<PagamentoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fichaId) return;
    let cancelado = false;

    const carregar = async () => {
      setLoading(true);
      const todos: PagamentoItem[] = [];

      // 1) Contas a receber
      const { data: rec } = await supabase
        .from("contas_receber")
        .select("id, valor_total, status, data_vencimento, data_pagamento")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false });

      (rec || []).forEach((r: any) => {
        todos.push({
          id: r.id,
          tipo: "receber",
          descricao: "Conta a Receber",
          valor: Number(r.valor_total),
          status: r.status || "—",
          data: r.data_pagamento || r.data_vencimento || r.created_at,
        });
      });

      // 2) Transações financeiras (pagamentos ao prestador)
      const { data: trx } = await supabase
        .from("transacoes_financeiras")
        .select("id, valor_cliente_final, data_pagamento_realizada, data_pagamento_prevista, status_pagamento")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false });

      (trx || []).forEach((r: any) => {
        todos.push({
          id: r.id,
          tipo: "transacao",
          descricao: "Pagamento Prestador",
          valor: Number(r.valor_cliente_final),
          status: r.status_pagamento || "—",
          data: r.data_pagamento_realizada || r.data_pagamento_prevista || r.created_at,
        });
      });

      // 3) Contas a pagar manual
      const { data: man } = await supabase
        .from("contas_pagar_manual")
        .select("id, descricao, valor, status, data_vencimento, data_pagamento")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false });

      (man || []).forEach((r: any) => {
        todos.push({
          id: r.id,
          tipo: "pagar_manual",
          descricao: r.descricao || "Lançamento Manual",
          valor: Number(r.valor),
          status: r.status || "—",
          data: r.data_pagamento || r.data_vencimento || r.created_at,
        });
      });

      todos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (!cancelado) {
        setItens(todos);
        setLoading(false);
      }
    };

    carregar();
    return () => { cancelado = true; };
  }, [fichaId]);

  const tipoConfig: Record<string, { label: string; icon: any; cor: string; kind: "receber" | "transacao" | "pagar_manual" }> = {
    receber:      { label: "Receber",     icon: ArrowDownToLine, cor: "text-emerald-600", kind: "receber" },
    transacao:    { label: "Transação",   icon: DollarSign,      cor: "text-blue-600",    kind: "transacao" },
    pagar_manual: { label: "Manual",      icon: Wallet,          cor: "text-violet-600",  kind: "pagar_manual" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum pagamento vinculado a esta ficha.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {itens.map((item) => {
        const cfg = tipoConfig[item.tipo];
        const Icon = cfg.icon;
        return (
          <Card key={`${item.tipo}-${item.id}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cfg.cor}`} />
                  <span className="text-sm font-medium">{cfg.label}</span>
                  <IdBadge id={item.id} kind={cfg.kind} />
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.status}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.descricao}</span>
                <span className="font-semibold">{formatMoeda(item.valor)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(item.data).toLocaleDateString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
