import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Download, PlusCircle, ChevronDown, ChevronUp,
  ExternalLink, CheckCircle2, AlertTriangle, XCircle, Wrench, RotateCcw, MessageSquare, Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";

const COMPARECIMENTO_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  "Foi": { variant: "default", label: "Foi" },
  "Atrasou": { variant: "secondary", label: "Atrasou" },
  "Atrasou e avisou": { variant: "secondary", label: "Atrasou (avisou)" },
  "Não foi": { variant: "destructive", label: "Não foi" },
  "Não foi e avisou": { variant: "destructive", label: "Não foi (avisou)" },
};

const HISTORICO_ICON: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  comparecimento: { icon: AlertTriangle, color: "text-amber-600", label: "Comparecimento" },
  visita_tecnica: { icon: Wrench, color: "text-blue-600", label: "Visita Técnica" },
  servico_executado: { icon: CheckCircle2, color: "text-green-600", label: "Serviço Executado" },
  retorno: { icon: RotateCcw, color: "text-purple-600", label: "Retorno" },
  ocorrencia: { icon: MessageSquare, color: "text-muted-foreground", label: "Ocorrência" },
};

const formatHistoricoMeta = (item: { tipo_evento: string; dados_extras?: any; created_at: string }) => {
  const dataEvento = item.dados_extras?.data_evento;
  if (dataEvento) {
    return new Date(dataEvento).toLocaleString("pt-BR");
  }
  return new Date(item.created_at).toLocaleString("pt-BR");
};

type Prestador = {
  cpf: string;
  nome: string;
  telefone: string;
  categoria: string | null;
  especialidade: string | null;
  id_crm: string | null;
  id_azure: string | null;
  cnpj: string | null;
  nome_pix: string | null;
  chave_pix: string | null;
  banco: string | null;
  email: string | null;
  agencia: string | null;
  conta: string | null;
  taxa_visita_padrao: number | null;
  regiao_atuacao: string | null;
  cep: string | null;
  endereco: string | null;
  complemento: string | null;
  ativo: boolean;
  created_at: string | null;
};

type PrestadorHistoricoItem = {
  id: string;
  tipo_evento: string;
  descricao: string;
  created_at: string;
  ficha_id: string | null;
  dados_extras: any;
};

type ServicoDetalhado = {
  ficha_id: string;
  nome_ficha: string | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  bairro: string | null;
  horario_agendamento: string | null;
  data_finalizacao: string | null;
  data_pagamento_prestador: string | null;
  status: string | null;
  comparecimento_prestador: string | null;
};

const sanitizeNumericField = (value: string | null): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, "");
  return cleaned || null;
};


const buildPrestadorPayload = (formData: Omit<Prestador, "created_at">) => {
  const telefoneLimpo = sanitizeNumericField(formData.telefone);
  const cnpjLimpo = sanitizeNumericField(formData.cnpj);

  return {
    nome: formData.nome,
    telefone: telefoneLimpo,
    categoria: formData.categoria || null,
    especialidade: formData.especialidade || null,
    id_crm: formData.id_crm || null,
    id_azure: formData.id_azure || null,
    cnpj: cnpjLimpo,
    nome_pix: formData.nome_pix || null,
    chave_pix: formData.chave_pix || null,
    banco: formData.banco || null,
    email: formData.email || null,
    agencia: formData.agencia || null,
    conta: formData.conta || null,
    taxa_visita_padrao: formData.taxa_visita_padrao ?? 0,
    regiao_atuacao: formData.regiao_atuacao || null,
    cep: formData.cep || null,
    endereco: formData.endereco || null,
    complemento: formData.complemento || null,
    ativo: formData.ativo ?? true,
  };
};

const PrestadorDetalhes = () => {
  const navigate = useNavigate();
  const { cpf } = useParams();
  const { toast } = useToast();
  const { getLinkHandlers } = useOpenInNewTab();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOcorrencia, setSavingOcorrencia] = useState(false);
  const [prestador, setPrestador] = useState<Prestador | null>(null);
  const [formData, setFormData] = useState<Omit<Prestador, "created_at"> | null>(null);
  const [historico, setHistorico] = useState<PrestadorHistoricoItem[]>([]);
  const [ocorrenciaText, setOcorrenciaText] = useState("");
  const [servicos, setServicos] = useState<ServicoDetalhado[]>([]);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [servicosExpanded, setServicosExpanded] = useState(true);

  useEffect(() => {
    const loadPrestador = async () => {
      if (!cpf) return;
      setLoading(true);
      const { data, error } = await supabase.from("prestadores").select("*").eq("cpf", cpf).single();

      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Prestador não encontrado",
          description: "Não foi possível carregar os dados do prestador.",
        });
        navigate("/gerenciamento-prestadores");
        return;
      }

      setPrestador(data as Prestador);
      setFormData({
        cpf: data.cpf,
        nome: data.nome,
        telefone: data.telefone,
        categoria: data.categoria,
        especialidade: data.especialidade,
        id_crm: data.id_crm,
        id_azure: data.id_azure,
        cnpj: data.cnpj,
        nome_pix: data.nome_pix ?? null,
        chave_pix: data.chave_pix ?? null,
        banco: data.banco ?? null,
        email: data.email ?? null,
        agencia: data.agencia ?? null,
        conta: data.conta ?? null,
        taxa_visita_padrao: data.taxa_visita_padrao ?? null,
        regiao_atuacao: data.regiao_atuacao ?? null,
        cep: (data as any).cep ?? null,
        endereco: (data as any).endereco ?? null,
        complemento: (data as any).complemento ?? null,
        ativo: data.ativo ?? true,
      });
      setLoading(false);
    };

    loadPrestador();
  }, [cpf, navigate, toast]);

  const fetchHistorico = useCallback(async (prestadorCpf: string) => {
    const { data, error } = await supabase
      .from("prestador_historico")
      .select("id, tipo_evento, descricao, created_at, ficha_id, dados_extras")
      .eq("prestador_cpf", prestadorCpf)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico deste prestador.",
      });
      return;
    }

    setHistorico((data || []) as PrestadorHistoricoItem[]);
  }, [toast]);

  const fetchServicos = useCallback(async (prestadorCpf: string) => {
    setLoadingServicos(true);

    // Buscar fichas do prestador
    const { data: fichas, error: fichasError } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, valor_mao_obra, valor_pecas, bairro, horario_agendamento, status, comparecimento_prestador")
      .eq("prestador_id", prestadorCpf)
      .order("created_at", { ascending: false });

    if (fichasError || !fichas) {
      setLoadingServicos(false);
      return;
    }

    const fichaIds = fichas.map((f) => f.id);

    // Buscar datas de finalização do histórico de status
    const { data: finalizacoes } = fichaIds.length > 0
      ? await supabase
          .from("ficha_status_historico")
          .select("ficha_id, data_inicio")
          .in("ficha_id", fichaIds)
          .eq("status_novo", "Finalizado")
      : { data: [] };

    const finalizacaoMap = new Map<string, string>();
    (finalizacoes || []).forEach((f: any) => {
      if (!finalizacaoMap.has(f.ficha_id) || f.data_inicio > finalizacaoMap.get(f.ficha_id)!) {
        finalizacaoMap.set(f.ficha_id, f.data_inicio);
      }
    });

    // Buscar datas de pagamento ao prestador
    const { data: transacoes } = fichaIds.length > 0
      ? await supabase
          .from("transacoes_financeiras")
          .select("ficha_id, data_pagamento_realizada, status_pagamento_prestador")
          .in("ficha_id", fichaIds)
      : { data: [] };

    const pagamentoMap = new Map<string, string | null>();
    (transacoes || []).forEach((t: any) => {
      pagamentoMap.set(t.ficha_id, t.data_pagamento_realizada);
    });

    const result: ServicoDetalhado[] = fichas.map((f: any) => ({
      ficha_id: f.id,
      nome_ficha: f.nome_ficha,
      valor_mao_obra: f.valor_mao_obra,
      valor_pecas: f.valor_pecas,
      bairro: f.bairro,
      horario_agendamento: f.horario_agendamento,
      data_finalizacao: finalizacaoMap.get(f.id) || null,
      data_pagamento_prestador: pagamentoMap.get(f.id) || null,
      status: f.status,
      comparecimento_prestador: f.comparecimento_prestador ?? null,
    }));

    setServicos(result);
    setLoadingServicos(false);
  }, []);

  useEffect(() => {
    if (!cpf) return;
    fetchHistorico(cpf);
    fetchServicos(cpf);
  }, [cpf, fetchHistorico, fetchServicos]);

  const createdAtLabel = useMemo(() => {
    if (!prestador?.created_at) return "-";
    return new Date(prestador.created_at).toLocaleString("pt-BR");
  }, [prestador]);

  const handleSave = async () => {
    if (!formData) return;


    if (!formData.nome || !sanitizeNumericField(formData.telefone)) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome e Telefone são obrigatórios.",
      });
      return;
    }

    const cnpjLimpo = sanitizeNumericField(formData.cnpj);

    if (cnpjLimpo && cnpjLimpo.length !== 14) {
      toast({
        variant: "destructive",
        title: "CNPJ inválido",
        description: "O CNPJ deve conter 14 dígitos.",
      });
      return;
    }

    setSaving(true);

    const payload = buildPrestadorPayload(formData);

    const { error } = await supabase
      .from("prestadores")
      .update(payload)
      .eq("cpf", formData.cpf);

    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Prestador atualizado",
      description: "Dados salvos com sucesso.",
    });
  };

  const handleDelete = async () => {
    if (!prestador) return;
    if (!confirm(`Tem certeza que deseja excluir o prestador ${prestador.nome}?`)) return;

    const { data: fichas, error: fichasError } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("prestador_id", prestador.cpf)
      .limit(1);

    if (fichasError) {
      toast({ variant: "destructive", title: "Erro", description: fichasError.message });
      return;
    }

    if (fichas && fichas.length > 0) {
      toast({
        variant: "destructive",
        title: "Não é possível excluir",
        description: "Este prestador possui fichas vinculadas.",
      });
      return;
    }

    const { error } = await supabase.from("prestadores").delete().eq("cpf", prestador.cpf);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
      return;
    }

    toast({ title: "Prestador excluído", description: "Registro removido com sucesso." });
    navigate("/gerenciamento-prestadores");
  };

  const handleExport = () => {
    if (!prestador) return;
    const payload = {
      ...prestador,
      exportado_em: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prestador-${prestador.cpf}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Exportação concluída", description: "Arquivo JSON gerado com sucesso." });
  };

  const handleSalvarOcorrencia = async () => {
    if (!prestador) return;

    const descricao = ocorrenciaText.trim();
    if (!descricao) {
      toast({
        variant: "destructive",
        title: "Ocorrência vazia",
        description: "Descreva a ocorrência antes de salvar.",
      });
      return;
    }

    setSavingOcorrencia(true);
    const { error } = await supabase.from("prestador_historico").insert({
      prestador_cpf: prestador.cpf,
      tipo_evento: "ocorrencia",
      descricao,
      criado_por: null,
      dados_extras: { origem: "gerenciamento-prestadores" },
    });
    setSavingOcorrencia(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar ocorrência",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Ocorrência adicionada",
      description: "A ocorrência foi registrada no histórico.",
    });
    setOcorrenciaText("");
    fetchHistorico(prestador.cpf);
  };

  if (loading || !formData) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Carregando prestador...</p>
      </div>
    );
  }

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gerenciamento-prestadores")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detalhes do Prestador</h1>
            <p className="text-sm text-muted-foreground">Página em construção com CRUD completo.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{prestador?.nome}</CardTitle>
            <CardDescription>CPF: {prestador?.cpf}</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Data de cadastro:</span> {createdAtLabel}
            </div>
            <div>
              <span className="text-muted-foreground">Telefone:</span> {prestador?.telefone}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Editar dados</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input id="categoria" value={formData.categoria || ""} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="especialidade">Especialidade</Label>
                <Input id="especialidade" value={formData.especialidade || ""} onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })} />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id_crm">ID CRM</Label>
                <Input id="id_crm" value={formData.id_crm || ""} onChange={(e) => setFormData({ ...formData, id_crm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_azure">ID Azure</Label>
                <Input id="id_azure" value={formData.id_azure || ""} onChange={(e) => setFormData({ ...formData, id_azure: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={formData.cnpj || ""} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_pix">Nome do Pix</Label>
                <Input id="nome_pix" value={formData.nome_pix || ""} onChange={(e) => setFormData({ ...formData, nome_pix: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chave_pix">Chave Pix</Label>
                <Input id="chave_pix" value={formData.chave_pix || ""} onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input id="banco" value={(formData as any).banco || ""} onChange={(e) => setFormData({ ...formData, banco: e.target.value })} placeholder="Ex: Nubank, Bradesco" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agencia">Agência</Label>
                <Input id="agencia" value={(formData as any).agencia || ""} onChange={(e) => setFormData({ ...formData, agencia: e.target.value })} placeholder="Nº da agência" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conta">Conta</Label>
                <Input id="conta" value={(formData as any).conta || ""} onChange={(e) => setFormData({ ...formData, conta: e.target.value })} placeholder="Nº da conta" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={(formData as any).email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxa_visita_padrao">Taxa de Visita Padrão (R$)</Label>
                <Input id="taxa_visita_padrao" type="number" step="0.01" value={(formData as any).taxa_visita_padrao ?? ""} onChange={(e) => setFormData({ ...formData, taxa_visita_padrao: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regiao_atuacao">Região de Atuação</Label>
                <Input id="regiao_atuacao" value={(formData as any).regiao_atuacao || ""} onChange={(e) => setFormData({ ...formData, regiao_atuacao: e.target.value })} placeholder="Ex: Zona Sul, Grande BH" />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={(formData as any).cep || ""} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="00000-000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={(formData as any).endereco || ""} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" value={(formData as any).complemento || ""} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} placeholder="Apto, bloco, referência" />
              </div>
            </div>
              <div className="space-y-2">
                <Label htmlFor="ativo">Prestador ativo</Label>
                <select
                  id="ativo"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.ativo ? "ativo" : "desativado"}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.value === "ativo" })}
                >
                  <option value="ativo">Ativo</option>
                  <option value="desativado">Desativado</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar info
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar prestador
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setServicosExpanded(!servicosExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Serviços Prestados</CardTitle>
                <CardDescription>
                  Detalhamento das fichas de serviço atribuídas a este prestador ({servicos.length} registros)
                </CardDescription>
              </div>
              {servicosExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
          {servicosExpanded && (
            <CardContent>
              {loadingServicos ? (
                <p className="text-sm text-muted-foreground">Carregando serviços...</p>
              ) : servicos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum serviço encontrado para este prestador.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ficha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Comparecimento</TableHead>
                        <TableHead className="text-right">Mão de Obra</TableHead>
                        <TableHead className="text-right">Material</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Data Agendamento</TableHead>
                        <TableHead>Data Finalização</TableHead>
                        <TableHead>Data Pgto Prestador</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicos.map((s) => {
                        const linkHandlers = getLinkHandlers(`/ficha/${encodeURIComponent(s.ficha_id)}`);
                        const comp = s.comparecimento_prestador
                          ? COMPARECIMENTO_BADGE[s.comparecimento_prestador] || { variant: "outline" as const, label: s.comparecimento_prestador }
                          : null;
                        return (
                          <TableRow
                            key={s.ficha_id}
                            {...linkHandlers}
                            className="cursor-pointer hover:bg-muted/40"
                            title="Abrir ficha em nova aba"
                          >
                            <TableCell className="font-medium">
                              {s.nome_ficha || s.ficha_id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                s.status === "Finalizado" ? "default" :
                                s.status === "Perdido" ? "destructive" :
                                "secondary"
                              }>
                                {s.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {comp ? <Badge variant={comp.variant}>{comp.label}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {s.valor_mao_obra != null ? `R$ ${Number(s.valor_mao_obra).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {s.valor_pecas != null ? `R$ ${Number(s.valor_pecas).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>{s.bairro || "-"}</TableCell>
                            <TableCell>
                              {s.horario_agendamento
                                ? new Date(s.horario_agendamento).toLocaleDateString("pt-BR")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {s.data_finalizacao
                                ? new Date(s.data_finalizacao).toLocaleDateString("pt-BR")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {s.data_pagamento_prestador
                                ? new Date(s.data_pagamento_prestador).toLocaleDateString("pt-BR")
                                : <span className="text-muted-foreground">Pendente</span>}
                            </TableCell>
                            <TableCell>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              Registros e observações do prestador. Use o campo abaixo para adicionar ocorrências.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nova-ocorrencia">Nova ocorrência</Label>
              <Textarea
                id="nova-ocorrencia"
                placeholder="Descreva a ocorrência..."
                value={ocorrenciaText}
                onChange={(e) => setOcorrenciaText(e.target.value)}
                rows={4}
              />
              <div>
                <Button onClick={handleSalvarOcorrencia} disabled={savingOcorrencia}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {savingOcorrencia ? "Salvando..." : "Adicionar ocorrência"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento no histórico.</p>
              ) : (
                historico.map((item) => {
                  const cfg = HISTORICO_ICON[item.tipo_evento] || { icon: Clock, color: "text-muted-foreground", label: item.tipo_evento };
                  const Icon = cfg.icon;
                  const fichaLink = item.ficha_id ? getLinkHandlers(`/ficha/${encodeURIComponent(item.ficha_id)}`) : null;
                  return (
                    <div key={item.id} className="rounded-lg border p-3 flex gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {cfg.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatHistoricoMeta(item)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm">{item.descricao}</p>
                        {fichaLink && (
                          <button
                            {...fichaLink}
                            className="mt-1 text-xs text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Abrir ficha
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </PageLayout>
  );
};

export default PrestadorDetalhes;
