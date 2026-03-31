import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Download, PlusCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";

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
  ativo: boolean;
  created_at: string | null;
};

type PrestadorHistoricoItem = {
  id: string;
  tipo_evento: string;
  descricao: string;
  created_at: string;
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
    ativo: formData.ativo ?? true,
  };
};

const PrestadorDetalhes = () => {
  const navigate = useNavigate();
  const { cpf } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOcorrencia, setSavingOcorrencia] = useState(false);
  const [prestador, setPrestador] = useState<Prestador | null>(null);
  const [formData, setFormData] = useState<Omit<Prestador, "created_at"> | null>(null);
  const [historico, setHistorico] = useState<PrestadorHistoricoItem[]>([]);
  const [ocorrenciaText, setOcorrenciaText] = useState("");

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
        ativo: data.ativo ?? true,
      });
      setLoading(false);
    };

    loadPrestador();
  }, [cpf, navigate, toast]);

  const fetchHistorico = useCallback(async (prestadorCpf: string) => {
    const { data, error } = await supabase
      .from("prestador_historico")
      .select("id, tipo_evento, descricao, created_at")
      .eq("prestador_cpf", prestadorCpf)
      .order("created_at", { ascending: false })
      .limit(50);

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

  useEffect(() => {
    if (!cpf) return;
    fetchHistorico(cpf);
  }, [cpf, fetchHistorico]);

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
    <div className="min-h-screen bg-background">
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

            <div className="space-y-3">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento no histórico.</p>
              ) : (
                historico.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium uppercase text-muted-foreground">{item.tipo_evento}</p>
                    <p className="mt-1 text-sm">{item.descricao}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PrestadorDetalhes;
