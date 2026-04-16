import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Loader2, History, User, DollarSign, FileText, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FichaServicoTab } from "@/components/FichaServicoTab";
import { OrcamentosTab } from "@/components/OrcamentosTab";
import { AcompanhamentoTab } from "@/components/AcompanhamentoTab";
import { TrocarPrestadorDialog } from "@/components/TrocarPrestadorDialog";
import { PageLayout } from "@/components/PageLayout";
import { useFichaGrupo } from "@/hooks/useFichaGrupo";
import { FichaVinculoBadge } from "@/components/FichaVinculoBadge";

const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface HistoricoItem {
  id: string;
  tipo: string;
  descricao: string;
  created_at: string;
  dados_extras?: any;
}

const FichaDetalhes = () => {
  const navigate = useNavigate();
  const { fichaId } = useParams();
  const [ficha, setFicha] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [trocarOpen, setTrocarOpen] = useState(false);

  useEffect(() => {
    if (!fichaId) return;
    loadFicha();
    loadHistorico();
  }, [fichaId]);

  const loadFicha = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("*")
      .eq("id", fichaId!)
      .single();

    if (error || !data) {
      navigate("/fichas");
      return;
    }

    // Resolve names
    const [clienteRes, prestadorRes] = await Promise.all([
      supabase.from("clientes").select("nome").eq("telefone", data.telefone_cliente).single(),
      data.prestador_id ? supabase.from("prestadores").select("nome").eq("cpf", data.prestador_id).single() : { data: null },
    ]);

    setFicha({
      ...data,
      cliente_nome_resolved: data.nome_cliente || clienteRes.data?.nome || data.telefone_cliente,
      prestador_nome_resolved: prestadorRes.data?.nome || data.prestador_id,
    });
    setLoading(false);
  };

  const loadHistorico = async () => {
    if (!fichaId) return;
    setHistoricoLoading(true);

    // Fetch from ficha_status_historico
    const { data: statusHist } = await supabase
      .from("ficha_status_historico")
      .select("*")
      .eq("ficha_id", fichaId)
      .order("created_at", { ascending: false });

    // Fetch from prestador_historico for this ficha
    const { data: prestadorHist } = await (supabase as any)
      .from("prestador_historico")
      .select("*")
      .eq("ficha_id", fichaId)
      .order("created_at", { ascending: false });

    // Fetch orcamentos
    const { data: orcamentos } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("ficha_nome", fichaId)
      .order("data_criacao", { ascending: false });

    const items: HistoricoItem[] = [];

    (statusHist || []).forEach((h: any) => {
      items.push({
        id: h.id,
        tipo: "status",
        descricao: `Status alterado: ${h.status_anterior || "—"} → ${h.status_novo}`,
        created_at: h.created_at,
      });
    });

    (prestadorHist || []).forEach((h: any) => {
      items.push({
        id: h.id,
        tipo: h.tipo_evento,
        descricao: h.descricao,
        created_at: h.created_at,
        dados_extras: h.dados_extras,
      });
    });

    (orcamentos || []).forEach((o: any) => {
      items.push({
        id: o.id,
        tipo: "orcamento",
        descricao: `Orçamento recebido: R$ ${o.valor_total || 0} (${o.status})`,
        created_at: o.data_criacao,
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setHistorico(items);
    setHistoricoLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tipoIcon = (tipo: string) => {
    if (tipo === "status") return "🔄";
    if (tipo === "troca_prestador") return "🔀";
    if (tipo === "comparecimento") return "📍";
    if (tipo === "orcamento") return "💰";
    if (tipo === "pagamento_troca") return "💸";
    return "📋";
  };

  return (
    <PageLayout>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/fichas")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground font-mono">{fichaId}</h1>
              <p className="text-xs text-muted-foreground">{ficha?.cliente_nome_resolved}</p>
            </div>
          </div>
          <Logo />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 md:px-6">
        {/* Summary card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <div><Badge>{ficha?.status}</Badge></div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Valor Total</span>
                <div className="font-bold">{formatMoeda(ficha?.valor_total || 0)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Prestador</span>
                <div className="flex items-center gap-1">
                  <span>{ficha?.prestador_nome_resolved || "—"}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setTrocarOpen(true)}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Pagamento</span>
                <div>
                  <Badge variant={ficha?.pagamento_realizado ? "default" : "outline"}>
                    {ficha?.pagamento_realizado ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ficha" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-4">
            <TabsTrigger value="ficha" className="gap-1.5">
              <FileText className="h-4 w-4" /> Ficha
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Orçamentos
            </TabsTrigger>
            <TabsTrigger value="acompanhamento" className="gap-1.5">
              <User className="h-4 w-4" /> Acompanhamento
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ficha">
            <FichaServicoTab fichaId={fichaId!} />
          </TabsContent>

          <TabsContent value="orcamentos">
            <OrcamentosTab fichaId={fichaId!} />
          </TabsContent>

          <TabsContent value="acompanhamento">
            <AcompanhamentoTab fichaId={fichaId!} />
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico da Ficha</CardTitle>
              </CardHeader>
              <CardContent>
                {historicoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historico.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhum evento registrado</p>
                ) : (
                  <div className="space-y-3">
                    {historico.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 text-sm">
                        <span className="text-lg mt-0.5">{tipoIcon(h.tipo)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground">{h.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {fichaId && (
        <TrocarPrestadorDialog
          open={trocarOpen}
          onOpenChange={setTrocarOpen}
          fichaId={fichaId}
          prestadorAtualId={ficha?.prestador_id}
          fichaStatus={ficha?.status}
          fichaData={ficha}
          onSuccess={() => {
            loadFicha();
            loadHistorico();
          }}
        />
      )}
    </PageLayout>
  );
};

export default FichaDetalhes;
