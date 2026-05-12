import { useState, useEffect, useMemo } from "react";
import { PageLayout } from "@/components/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IdBadge } from "@/components/ui/IdBadge";
import { BuscarPorIdTab, type BuscaIdItem } from "@/components/financeiro/BuscarPorIdTab";
import { toast } from "sonner";
import { Eye, Send, Edit, Copy, ExternalLink, Filter, DollarSign, Clock, AlertTriangle, CheckCircle2, Loader2, XCircle, Hash, List } from "lucide-react";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatData = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
};

type ContaReceber = {
  id: string;
  ficha_id: string | null;
  cliente_telefone: string;
  cliente_nome: string | null;
  prestador_nome: string | null;
  valor_total: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  pagamento_link: string | null;
  asaas_id: string | null;
  asaas_status: string | null;
  requer_template: boolean;
  link_enviado_em: string | null;
  link_reenvio_count: number;
  created_at: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  aguardando: { label: "Aguardando", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Clock className="h-3 w-3" /> },
  pago: { label: "Pago", color: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800 border-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: <XCircle className="h-3 w-3" /> },
};

export default function ContasReceber() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("30");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceber | null>(null);
  const [enviandoLink, setEnviandoLink] = useState(false);

  useEffect(() => {
    carregarContas();
  }, []);

  const carregarContas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setContas((data as any[]) || []);
    } catch (err: any) {
      console.error("Erro ao carregar contas:", err);
      toast.error("Erro ao carregar contas a receber");
    } finally {
      setLoading(false);
    }
  };

  const contasFiltradas = useMemo(() => {
    let resultado = contas;

    if (filtroStatus !== "todos") {
      resultado = resultado.filter((c) => c.status === filtroStatus);
    }

    if (filtroPeriodo !== "0") {
      const dias = parseInt(filtroPeriodo);
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);
      resultado = resultado.filter((c) => new Date(c.created_at) >= limite);
    }

    if (filtroCliente.trim()) {
      const termo = filtroCliente.toLowerCase();
      resultado = resultado.filter(
        (c) =>
          c.cliente_nome?.toLowerCase().includes(termo) ||
          c.ficha_id?.toLowerCase().includes(termo) ||
          c.cliente_telefone?.includes(termo)
      );
    }

    return resultado;
  }, [contas, filtroStatus, filtroPeriodo, filtroCliente]);

  const resumo = useMemo(() => ({
    aReceber: contasFiltradas.filter((c) => c.status === "aguardando").reduce((s, c) => s + (c.valor_total || 0), 0),
    aReceberQtd: contasFiltradas.filter((c) => c.status === "aguardando").length,
    pago: contasFiltradas.filter((c) => c.status === "pago").reduce((s, c) => s + (c.valor_total || 0), 0),
    pagoQtd: contasFiltradas.filter((c) => c.status === "pago").length,
    vencido: contasFiltradas.filter((c) => c.status === "vencido").reduce((s, c) => s + (c.valor_total || 0), 0),
    vencidoQtd: contasFiltradas.filter((c) => c.status === "vencido").length,
  }), [contasFiltradas]);

  const reenviarLink = async (conta: ContaReceber) => {
    if (!conta.pagamento_link || !conta.cliente_telefone) {
      toast.error("Link ou telefone não disponível");
      return;
    }
    setEnviandoLink(true);
    try {
      const msg = `${conta.cliente_nome || "Cliente"}, segue o link para pagamento no valor de ${formatMoeda(conta.valor_total)}:\n\n${conta.pagamento_link}`;

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: conta.cliente_telefone,
          message: msg,
          userId: user?.id,
          fallbackToTemplate: true,
          templateContentSid: "HX7cc2b987e2d793fb99d4d02cb1e5ebb7",
          templateVariables: JSON.stringify({ "1": conta.cliente_nome || "Cliente", "2": conta.ficha_id || "" }),
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.sentViaTemplate ? "Link enviado via template!" : "Link reenviado com sucesso!");
        // Update reenvio count
        await supabase
          .from("contas_receber")
          .update({
            link_reenvio_count: (conta.link_reenvio_count || 0) + 1,
            link_enviado_em: new Date().toISOString(),
            requer_template: !!data.sentViaTemplate,
          } as any)
          .eq("id", conta.id);
        carregarContas();
      } else {
        toast.error(data?.error === "FORA_JANELA_24H" ? "Fora da janela 24h e sem template configurado" : data?.error || "Erro ao enviar");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setEnviandoLink(false);
    }
  };

  const marcarComoPago = async (conta: ContaReceber) => {
    try {
      const agora = new Date().toISOString();
      
      // 1. Atualizar conta a receber
      await supabase
        .from("contas_receber")
        .update({ status: "pago", data_pagamento: agora.split("T")[0] } as any)
        .eq("id", conta.id);

      // 2. Atualizar ficha de serviço (se vinculada)
      if (conta.ficha_id) {
        await supabase
          .from("fichas_de_servico")
          .update({ pagamento_realizado: true } as any)
          .eq("id", conta.ficha_id);

        // 3. Atualizar transação financeira
        await supabase
          .from("transacoes_financeiras")
          .update({
            status_pagamento_cliente: "pago",
            data_pagamento_realizada: agora,
          } as any)
          .eq("ficha_id", conta.ficha_id);

        // 4. Disparar recibo (non-blocking)
        try {
          await supabase.functions.invoke("send-recibo", {
            body: {
              ficha_id: conta.ficha_id,
              telefone_cliente: conta.cliente_telefone,
            },
          });
        } catch (reciboErr) {
          console.warn("send-recibo error:", reciboErr);
        }
      }

      toast.success("Conta marcada como paga!");
      setModalAberto(false);
      carregarContas();
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const cancelarConta = async (conta: ContaReceber) => {
    try {
      await supabase.from("contas_receber").update({ status: "cancelado" } as any).eq("id", conta.id);
      toast.success("Conta cancelada");
      setModalAberto(false);
      carregarContas();
    } catch {
      toast.error("Erro ao cancelar");
    }
  };

  const diasParaVencer = (d: string | null) => {
    if (!d) return null;
    const diff = new Date(d + "T12:00:00").getTime() - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <PageLayout>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">A Receber</p>
              <p className="text-2xl font-bold mt-1">{formatMoeda(resumo.aReceber)}</p>
              <p className="text-xs text-muted-foreground mt-1">{resumo.aReceberQtd} pendentes</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Pago</p>
              <p className="text-2xl font-bold mt-1">{formatMoeda(resumo.pago)}</p>
              <p className="text-xs text-muted-foreground mt-1">{resumo.pagoQtd} recebidos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Vencido</p>
              <p className="text-2xl font-bold mt-1">{formatMoeda(resumo.vencido)}</p>
              <p className="text-xs text-muted-foreground mt-1">{resumo.vencidoQtd} atrasados</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista" className="gap-1.5"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
            <TabsTrigger value="ids" className="gap-1.5"><Hash className="h-3.5 w-3.5" /> IDs</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4 mt-4">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtros</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Status</SelectItem>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="365">Último ano</SelectItem>
                      <SelectItem value="0">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Buscar cliente, ficha ou telefone..."
                    value={filtroCliente}
                    onChange={(e) => setFiltroCliente(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Ficha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : contasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma conta encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      contasFiltradas.map((conta) => {
                        const cfg = statusConfig[conta.status] || statusConfig.aguardando;
                        const dias = diasParaVencer(conta.data_vencimento);
                        return (
                          <TableRow key={conta.id} className="hover:bg-muted/50">
                            <TableCell><IdBadge id={conta.id} /></TableCell>
                            <TableCell className="font-mono text-xs font-semibold">{conta.ficha_id || "—"}</TableCell>
                            <TableCell>{conta.cliente_nome || conta.cliente_telefone}</TableCell>
                            <TableCell className="font-semibold">{formatMoeda(conta.valor_total)}</TableCell>
                            <TableCell>
                              {formatData(conta.data_vencimento)}
                              {conta.status === "aguardando" && dias !== null && (
                                <div className={`text-xs mt-0.5 ${dias < 0 ? "text-red-600 font-medium" : dias <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                                  {dias < 0 ? `${Math.abs(dias)}d atrasado` : dias === 0 ? "Vence hoje" : `${dias}d restantes`}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{conta.status === "pago" ? formatData(conta.data_pagamento) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${cfg.color} gap-1`}>
                                {cfg.icon} {cfg.label}
                              </Badge>
                              {conta.requer_template && (
                                <div className="text-[10px] text-amber-600 mt-0.5">Requer template</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="sm" onClick={() => { setContaSelecionada(conta); setModalAberto(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ids" className="mt-4">
            <BuscarPorIdTab
              loading={loading}
              beneficiarioLabel="Cliente"
              items={contas.map<BuscaIdItem>((c) => ({
                id: c.id,
                data: c.created_at,
                beneficiario: c.cliente_nome || c.cliente_telefone,
                valor: c.valor_total,
                status: statusConfig[c.status]?.label || c.status,
                statusColor: statusConfig[c.status]?.color,
                origem: c.ficha_id ? `Ficha ${c.ficha_id}` : undefined,
                raw: c,
              }))}
              onView={(item) => { setContaSelecionada(item.raw); setModalAberto(true); }}
            />
          </TabsContent>
        </Tabs>

        {/* Modal detalhes */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Detalhes da Cobrança
              </DialogTitle>
            </DialogHeader>
            {contaSelecionada && (
              <div className="space-y-4">
                {/* Resumo */}
                <div className="rounded-lg border bg-muted/50 p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Ficha</p>
                    <p className="text-sm font-bold">{contaSelecionada.ficha_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-sm font-bold">{contaSelecionada.cliente_nome || contaSelecionada.cliente_telefone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="text-sm font-bold">{formatMoeda(contaSelecionada.valor_total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`${statusConfig[contaSelecionada.status]?.color || ""} gap-1 mt-0.5`}>
                      {statusConfig[contaSelecionada.status]?.icon} {statusConfig[contaSelecionada.status]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prestador</p>
                    <p className="text-sm">{contaSelecionada.prestador_nome || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="text-sm">{formatData(contaSelecionada.data_vencimento)}</p>
                  </div>
                </div>

                {/* Link */}
                {contaSelecionada.pagamento_link && (
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Link de Pagamento</p>
                    <div className="flex items-center gap-2">
                      <a href={contaSelecionada.pagamento_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                        {contaSelecionada.pagamento_link}
                      </a>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(contaSelecionada.pagamento_link!); toast.success("Link copiado!"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                        <a href={contaSelecionada.pagamento_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                    {contaSelecionada.link_reenvio_count > 0 && (
                      <p className="text-[10px] text-muted-foreground">Reenviado {contaSelecionada.link_reenvio_count}x • Último: {contaSelecionada.link_enviado_em ? new Date(contaSelecionada.link_enviado_em).toLocaleString("pt-BR") : "—"}</p>
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  {contaSelecionada.status !== "pago" && contaSelecionada.status !== "cancelado" && (
                    <>
                      <Button size="sm" className="gap-1.5" disabled={enviandoLink} onClick={() => reenviarLink(contaSelecionada)}>
                        {enviandoLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {enviandoLink ? "Enviando..." : "Reenviar Link"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50" onClick={() => marcarComoPago(contaSelecionada)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Marcar Pago
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" onClick={() => cancelarConta(contaSelecionada)}>
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>

                {/* Asaas info */}
                {contaSelecionada.asaas_id && (
                  <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
                    <p>ID Asaas: <span className="font-mono">{contaSelecionada.asaas_id}</span></p>
                    <p>Status Asaas: {contaSelecionada.asaas_status || "—"}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
