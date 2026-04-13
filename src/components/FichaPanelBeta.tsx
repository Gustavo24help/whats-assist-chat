import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText, DollarSign, Plus, ClipboardCheck, MapPin, Phone, User, Copy, Lightbulb, Wrench, Star, UserCheck, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaServicoTab } from "./FichaServicoTab";
import { OrcamentosTab } from "./OrcamentosTab";
import { AcompanhamentoTab } from "./AcompanhamentoTab";
import { CriarFichaDialog } from "./CriarFichaDialog";
import { useClienteSignalsBeta } from "@/hooks/useClienteSignalsBeta";
import { Badge } from "@/components/ui/badge";
import { AbrirConversaDialog } from "./AbrirConversaDialog";
import { AvaliacaoPrestadorFlowPanel } from "./AvaliacaoPrestadorFlowPanel";
import { NPSFlowPanel } from "./NPSFlowPanel";
import { toast } from "sonner";

interface Ficha {
  id: string;
  nome_ficha: string | null;
  status?: string | null;
}

interface ClienteInfo {
  nome: string;
  telefone: string;
  bairro?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  cpf?: string | null;
  tags?: string[] | null;
  status_conversa?: string | null;
  created_at?: string | null;
}

interface FichaDetalhes {
  id: string;
  status: string | null;
  categoria_id: number | null;
  valor_total: number | null;
  prestador_id: string | null;
  descricao: string | null;
  nome_ficha: string | null;
}

interface FichaPanelProps {
  clienteTelefone: string;
  clienteNome: string;
  onClose?: () => void;
  onFichaChange?: (fichaId: string | null) => void;
}

export const FichaPanelBeta = ({ clienteTelefone, clienteNome, onClose, onFichaChange }: FichaPanelProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichaAtual, setFichaAtual] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteInfo, setClienteInfo] = useState<ClienteInfo | null>(null);
  const [fichaDetalhes, setFichaDetalhes] = useState<FichaDetalhes | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string | null>(null);

  const { coaching } = useClienteSignalsBeta(clienteTelefone);

  const [fichasSemOrcamentoIds, setFichasSemOrcamentoIds] = useState<Set<string>>(new Set());

  // Stats derived from fichas
  const fichasStats = {
    fichaCriada: fichas.filter(f => f.status === 'Ficha Criada').length,
    finalizadas: fichas.filter(f => f.status === 'Finalizado').length,
    perdidas: fichas.filter(f => ['Perdido', 'Não foi adiante'].includes(f.status || '')).length,
    semOrcamento: fichas.filter(f => fichasSemOrcamentoIds.has(f.id)).length,
  };

  // Fetch fichas sem orçamento
  useEffect(() => {
    const fetchSemOrcamento = async () => {
      if (fichas.length === 0) { setFichasSemOrcamentoIds(new Set()); return; }
      const fichaIds = fichas.map(f => f.id);
      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('ficha_nome')
        .in('ficha_nome', fichaIds);
      const comOrcamento = new Set((orcamentos || []).map(o => o.ficha_nome));
      setFichasSemOrcamentoIds(new Set(fichaIds.filter(id => !comOrcamento.has(id))));
    };
    fetchSemOrcamento();
  }, [fichas]);

  // Fetch client info
  useEffect(() => {
    const fetchCliente = async () => {
      const { data } = await supabase
        .from('clientes')
        .select('nome, telefone, bairro, cidade, endereco, cpf, tags, status_conversa, created_at')
        .eq('telefone', clienteTelefone)
        .maybeSingle();
      if (data) setClienteInfo(data as ClienteInfo);
    };
    fetchCliente();
  }, [clienteTelefone]);

  // Fetch ficha details when fichaAtual changes
  useEffect(() => {
    if (!fichaAtual) { setFichaDetalhes(null); return; }
    const fetchFichaDetalhes = async () => {
      const { data } = await supabase
        .from('fichas_de_servico')
        .select('id, status, categoria_id, valor_total, prestador_id, descricao, nome_ficha')
        .eq('id', fichaAtual)
        .maybeSingle();
      if (data) {
        setFichaDetalhes(data as FichaDetalhes);
        if (data.categoria_id) {
          const { data: cat } = await supabase
            .from('categorias')
            .select('nome')
            .eq('id', data.categoria_id)
            .maybeSingle();
          setCategoriaNome(cat?.nome || null);
        } else {
          setCategoriaNome(null);
        }
      }
    };
    fetchFichaDetalhes();
  }, [fichaAtual]);

  useEffect(() => {
    setFichas([]);
    setFichaAtual(null);
    fetchFichas();
  }, [clienteTelefone]);

  const fetchFichas = async () => {
    const { data } = await supabase
      .from('fichas_de_servico')
      .select('id, nome_ficha, status')
      .eq('telefone_cliente', clienteTelefone)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setFichas(data);
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('ficha_ativa_id')
        .eq('telefone', clienteTelefone)
        .single();

      const fichaAtivaValida = clienteData?.ficha_ativa_id 
        && data.some(f => f.id === clienteData.ficha_ativa_id);
      
      const fichaInicial = fichaAtivaValida 
        ? clienteData!.ficha_ativa_id! 
        : data[0].id;
      
      setFichaAtual(fichaInicial);
      onFichaChange?.(fichaInicial);
      
      if (!fichaAtivaValida) {
        marcarFichaComoAtiva(data[0].id);
      }
    } else {
      setFichas([]);
      setFichaAtual(null);
      onFichaChange?.(null);
    }
  };

  const marcarFichaComoAtiva = async (fichaId: string) => {
    try {
      await supabase
        .from('clientes')
        .update({ ficha_ativa_id: fichaId })
        .eq('telefone', clienteTelefone);
    } catch (error) {
      console.error('Erro ao marcar ficha como ativa:', error);
    }
  };

  const copiarSugestao = async () => {
    if (coaching?.sugestaoMensagem) {
      try {
        await navigator.clipboard.writeText(coaching.sugestaoMensagem);
        toast.success("Sugestão copiada!");
      } catch { /* ignore */ }
    }
  };

  const handleCopyGeneratedMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada!");
    } catch {
      toast.error("Erro ao copiar mensagem");
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="h-10 flex items-center justify-between px-3 border-b bg-card/50 backdrop-blur-sm shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{clienteNome}</h2>
          <p className="text-xs text-muted-foreground truncate">{clienteTelefone}</p>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-7 w-7 hover:scale-[0.98] active:scale-95 transition-transform">
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── STATUS SUMMARY CARDS ── */}
        <div className="p-3 border-b border-border/40">
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-primary">{fichasStats.fichaCriada}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">Ficha Criada</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-600">{fichasStats.finalizadas}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">Finalizadas</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-600">{fichasStats.perdidas}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">Perdidas</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-amber-600">{fichasStats.semOrcamento}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">S/ Orçamento</p>
            </div>
          </div>
        </div>

        {/* ── FICHA SELECTOR ── */}
        {fichas.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <p className="text-muted-foreground text-sm">Nenhuma ficha de serviço encontrada</p>
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Criar Nova Ficha
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-2.5 space-y-2 border-b shrink-0">
              <div className="flex items-center gap-1.5">
                <Select
                  value={fichaAtual || ''}
                  onValueChange={(value) => {
                    setFichaAtual(value);
                    marcarFichaComoAtiva(value);
                    onFichaChange?.(value);
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fichas.map((ficha) => (
                      <SelectItem key={ficha.id} value={ficha.id}>
                        {ficha.nome_ficha}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setDialogOpen(true)}
                  className="shrink-0 h-8 w-8 hover:scale-[0.98] active:scale-95 transition-transform"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <AbrirConversaDialog clienteTelefone={clienteTelefone} clienteNome={clienteNome} />
                <AvaliacaoPrestadorFlowPanel
                  clienteTelefone={clienteTelefone}
                  clienteNome={clienteNome}
                  fichaId={fichaAtual || undefined}
                  onCopyMessage={handleCopyGeneratedMessage}
                />
                <NPSFlowPanel
                  clienteTelefone={clienteTelefone}
                  clienteNome={clienteNome}
                  fichaId={fichaAtual || undefined}
                  onCopyMessage={handleCopyGeneratedMessage}
                />
                <Button variant="outline" size="sm" className="h-9 justify-start text-xs" onClick={() => window.dispatchEvent(new CustomEvent('chat-beta-open-assumir'))}>
                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                  Assumido
                </Button>
              </div>
            </div>

            {/* ── TABS ── */}
            <Tabs defaultValue="ficha" className="flex flex-col">
              <TabsList className="mx-2.5 mt-2 shrink-0 h-8 p-0.5 grid grid-cols-5">
                <TabsTrigger value="cliente" className="text-[10px] h-7 px-1">
                  <User className="mr-0.5 h-3 w-3" />
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="ficha" className="text-[10px] h-7 px-1">
                  <FileText className="mr-0.5 h-3 w-3" />
                  Ficha
                </TabsTrigger>
                <TabsTrigger value="insights" className="text-[10px] h-7 px-1">
                  <Lightbulb className="mr-0.5 h-3 w-3" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="acompanhamento" className="text-[10px] h-7 px-1">
                  <ClipboardCheck className="mr-0.5 h-3 w-3" />
                  Acomp.
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="text-[10px] h-7 px-1">
                  <DollarSign className="mr-0.5 h-3 w-3" />
                  Orçam.
                </TabsTrigger>
              </TabsList>

              {/* ── CLIENTE TAB ── */}
              <TabsContent value="cliente" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{clienteInfo?.nome || clienteNome}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{clienteTelefone}</span>
                      </div>
                    </div>
                  </div>

                  {(clienteInfo?.cidade || clienteInfo?.bairro) && (
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1">Localização</p>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{[clienteInfo.bairro, clienteInfo.cidade].filter(Boolean).join(', ')}</span>
                      </div>
                      {clienteInfo?.endereco && (
                        <p className="text-xs text-muted-foreground mt-1 ml-4">{clienteInfo.endereco}</p>
                      )}
                    </div>
                  )}

                  {clienteInfo?.cpf && (
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1">CPF</p>
                      <p className="text-xs font-medium">{clienteInfo.cpf}</p>
                    </div>
                  )}

                  {clienteInfo?.created_at && (
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1">Cliente desde</p>
                      <p className="text-xs font-medium">
                        {new Date(clienteInfo.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}

                  {clienteInfo?.tags && clienteInfo.tags.length > 0 && (
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {clienteInfo.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── FICHA TAB ── */}
              <TabsContent value="ficha" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                {/* Ficha Summary */}
                {fichaDetalhes && (
                  <div className="mb-3">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">Código</p>
                        <p className="text-xs font-semibold truncate">{fichaDetalhes.id}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">Status</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {fichaDetalhes.status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">Categoria</p>
                        <p className="text-xs font-medium">{categoriaNome || 'N/A'}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">Valor</p>
                        <p className="text-xs font-semibold text-primary">
                          {fichaDetalhes.valor_total ? `R$ ${fichaDetalhes.valor_total.toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <FichaServicoTab fichaId={fichaAtual} />
              </TabsContent>

              {/* ── INSIGHTS TAB ── */}
              <TabsContent value="insights" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <div className="space-y-3">
                  {/* Coaching Suggestion */}
                  {coaching ? (
                    <div className="bg-accent/50 border border-border rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          {coaching.perfil}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Meta: {(coaching.conversaoMeta * 100).toFixed(0)}% · Próximo: {coaching.proximoPassoLabel}
                      </p>
                      {coaching.prioridade === 'maxima' && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 mb-1.5">
                          🔴 PRIORIDADE MÁXIMA
                        </Badge>
                      )}
                      <div className="bg-muted/50 rounded p-2 mb-2">
                        <p className="text-[11px] text-foreground italic">
                          &ldquo;{coaching.sugestaoMensagem}&rdquo;
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={copiarSugestao}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Sugestão
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <Lightbulb className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Sem sugestões disponíveis</p>
                    </div>
                  )}

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">
                      💡 As ações principais do atendimento ficam fixas no topo desta coluna para manter o chat mais limpo.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ── ACOMPANHAMENTO TAB ── */}
              <TabsContent value="acompanhamento" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <AcompanhamentoTab fichaId={fichaAtual} />
              </TabsContent>

              {/* ── ORÇAMENTOS TAB ── */}
              <TabsContent value="orcamentos" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <OrcamentosTab fichaId={fichaAtual} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <CriarFichaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clienteTelefone={clienteTelefone}
        clienteNome={clienteNome}
      />
    </div>
  );
};
