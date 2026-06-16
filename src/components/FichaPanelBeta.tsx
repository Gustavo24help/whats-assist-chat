import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText, DollarSign, Plus, MapPin, Phone, User, History, Sparkles, ClipboardList, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaServicoTab } from "./FichaServicoTab";
import { OrcamentosTab } from "./OrcamentosTab";
import { CriarFichaDialog } from "./CriarFichaDialog";
import { HistoricoClienteTab } from "./chat-beta/HistoricoClienteTab";
import { ResumoFichaTab } from "./chat-beta/ResumoFichaTab";
import { NinaTab } from "./chat-beta/NinaTab";
import { SiteDadosTab } from "./chat-beta/SiteDadosTab";
import { useClienteSignalsBeta } from "@/hooks/useClienteSignalsBeta";
import { Badge } from "@/components/ui/badge";
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
}

export const FichaPanelBeta = ({ clienteTelefone, clienteNome, onClose }: FichaPanelProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichaAtual, setFichaAtual] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteInfo, setClienteInfo] = useState<ClienteInfo | null>(null);
  const [fichaDetalhes, setFichaDetalhes] = useState<FichaDetalhes | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string | null>(null);
  const [hasSiteDados, setHasSiteDados] = useState(false);

  const { coaching } = useClienteSignalsBeta(clienteTelefone);

  // (Cards de status agregados foram movidos para a aba "Histórico". Não calculamos mais aqui.)

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
    if (!fichaAtual) { setFichaDetalhes(null); setHasSiteDados(false); return; }
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
      const { data: pq } = await supabase
        .from('pre_qualificacao_bot')
        .select('id')
        .eq('ficha_id', fichaAtual)
        .maybeSingle();
      setHasSiteDados(!!pq);
    };
    fetchFichaDetalhes();
  }, [fichaAtual]);

  useEffect(() => {
    setFichas([]);
    setFichaAtual(null);
    fetchFichas();

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.telefone === clienteTelefone) {
        fetchFichas();
      }
    };
    window.addEventListener('ficha-criada', handler);
    return () => window.removeEventListener('ficha-criada', handler);
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
      
      if (!fichaAtivaValida) {
        marcarFichaComoAtiva(data[0].id);
      }
    } else {
      setFichas([]);
      setFichaAtual(null);
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
            <div className="p-2.5 border-b shrink-0">
              <div className="flex items-center gap-1.5">
                <Select
                  value={fichaAtual || ''}
                  onValueChange={(value) => {
                    setFichaAtual(value);
                    marcarFichaComoAtiva(value);
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
                  title="Nova ficha"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* ── TABS ── */}
            <Tabs defaultValue="resumo" className="flex flex-col">
              <TabsList className="mx-2.5 mt-2 shrink-0 h-8 p-0.5 grid grid-cols-6">
                <TabsTrigger value="resumo" className="text-[10px] h-7 px-1" title="Resumo">
                  <ClipboardList className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="cliente" className="text-[10px] h-7 px-1" title="Cliente">
                  <User className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-[10px] h-7 px-1" title="Histórico">
                  <History className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="informacoes" className="text-[10px] h-7 px-1" title="Informações">
                  <FileText className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="nina" className="text-[10px] h-7 px-1" title="Nina (IA)">
                  <Sparkles className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="text-[10px] h-7 px-1" title="Orçamento">
                  <DollarSign className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>

              {/* ── RESUMO TAB (default) ── */}
              <TabsContent value="resumo" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <ResumoFichaTab fichaId={fichaAtual} />
              </TabsContent>

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

              {/* ── HISTÓRICO DO CLIENTE TAB ── */}
              <TabsContent value="historico" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <HistoricoClienteTab clienteTelefone={clienteTelefone} fichaAtualId={fichaAtual} />
              </TabsContent>

              {/* ── INFORMAÇÕES (FICHA COMPLETA) TAB ── */}
              <TabsContent value="informacoes" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <FichaServicoTab fichaId={fichaAtual} />
              </TabsContent>

              {/* ── NINA (IA) TAB ── */}
              <TabsContent value="nina" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <NinaTab fichaId={fichaAtual} coaching={coaching} />
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
