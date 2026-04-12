import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText, DollarSign, Plus, ClipboardCheck, MapPin, Phone, User, Copy, Lightbulb } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaServicoTab } from "./FichaServicoTab";
import { OrcamentosTab } from "./OrcamentosTab";
import { AcompanhamentoTab } from "./AcompanhamentoTab";
import { CriarFichaDialog } from "./CriarFichaDialog";
import { useClienteSignalsBeta } from "@/hooks/useClienteSignalsBeta";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Ficha {
  id: string;
  nome_ficha: string | null;
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
  onClose: () => void;
}

export const FichaPanelBeta = ({ clienteTelefone, clienteNome, onClose }: FichaPanelProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichaAtual, setFichaAtual] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteInfo, setClienteInfo] = useState<ClienteInfo | null>(null);
  const [fichaDetalhes, setFichaDetalhes] = useState<FichaDetalhes | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string | null>(null);
  const [showCoaching, setShowCoaching] = useState(true);

  const { coaching } = useClienteSignalsBeta(clienteTelefone);

  // Fetch client info
  useEffect(() => {
    const fetchCliente = async () => {
      const { data } = await supabase
        .from('clientes')
        .select('nome, telefone, bairro, cidade, endereco, cpf, tags, status_conversa')
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
      .select('id, nome_ficha')
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

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b bg-card/50 backdrop-blur-sm shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{clienteNome}</h2>
          <p className="text-xs text-muted-foreground truncate">{clienteTelefone}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-7 w-7 hover:scale-[0.98] active:scale-95 transition-transform">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── CLIENT PROFILE ── */}
        <div className="p-3 border-b border-border/40">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
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
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-11">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {[clienteInfo.bairro, clienteInfo.cidade].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {clienteInfo?.cpf && (
            <p className="text-xs text-muted-foreground ml-11 mt-0.5">
              CPF: {clienteInfo.cpf}
            </p>
          )}
          {clienteInfo?.tags && clienteInfo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 ml-11">
              {clienteInfo.tags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ── FICHA SUMMARY ── */}
        {fichaDetalhes && (
          <div className="p-3 border-b border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Resumo da Ficha
            </p>
            <div className="grid grid-cols-2 gap-2">
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

        {/* ── COACHING SUGGESTION ── */}
        {coaching && showCoaching && (
          <div className="p-3 border-b border-border/40">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {coaching.perfil}
                  </span>
                </div>
                <button onClick={() => setShowCoaching(false)} className="text-amber-400 hover:text-amber-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">
                Meta: {(coaching.conversaoMeta * 100).toFixed(0)}% · Próximo: {coaching.proximoPassoLabel}
              </p>
              {coaching.prioridade === 'maxima' && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0 mb-1.5">
                  🔴 PRIORIDADE MÁXIMA
                </Badge>
              )}
              <div className="bg-white/60 dark:bg-black/20 rounded p-2 mb-2">
                <p className="text-[11px] text-amber-900 dark:text-amber-200 italic">
                  &ldquo;{coaching.sugestaoMensagem}&rdquo;
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[10px] w-full border-amber-300 text-amber-700 hover:bg-amber-100" onClick={copiarSugestao}>
                <Copy className="h-3 w-3 mr-1" />
                Copiar Sugestão
              </Button>
            </div>
          </div>
        )}

        {/* ── FICHA TABS ── */}
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
            <div className="p-2.5 space-y-1.5 border-b shrink-0">
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
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="ficha" className="flex flex-col">
              <TabsList className="mx-2.5 mt-2 shrink-0 h-8 p-0.5">
                <TabsTrigger value="ficha" className="flex-1 text-xs h-7">
                  <FileText className="mr-1 h-3 w-3" />
                  Ficha
                </TabsTrigger>
                <TabsTrigger value="acompanhamento" className="flex-1 text-xs h-7">
                  <ClipboardCheck className="mr-1 h-3 w-3" />
                  Acompanhamento
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="flex-1 text-xs h-7">
                  <DollarSign className="mr-1 h-3 w-3" />
                  Orçamentos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ficha" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <FichaServicoTab fichaId={fichaAtual} />
              </TabsContent>
              <TabsContent value="acompanhamento" className="p-2.5 m-0 animate-in fade-in-50 duration-200">
                <AcompanhamentoTab fichaId={fichaAtual} />
              </TabsContent>
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
