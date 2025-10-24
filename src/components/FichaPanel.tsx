import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText, DollarSign, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaServicoTab } from "./FichaServicoTab";
import { OrcamentosTab } from "./OrcamentosTab";
import { CriarFichaDialog } from "./CriarFichaDialog";

interface Ficha {
  id: string;
  nome_ficha: string | null;
}

interface FichaPanelProps {
  clienteTelefone: string; // Usar telefone como ID
  clienteNome: string;
  onClose: () => void;
}

export const FichaPanel = ({ clienteTelefone, clienteNome, onClose }: FichaPanelProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichaAtual, setFichaAtual] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    fetchFichas();
    fetchWebhookUrl();
  }, [clienteTelefone]);

  const fetchWebhookUrl = async () => {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "webhook_criar_ficha")
      .single();

    if (data?.valor) {
      setWebhookUrl(data.valor);
    }
  };

  const fetchFichas = async () => {
    const { data } = await supabase
      .from('fichas_de_servico')
      .select('id, nome_ficha')
      .eq('telefone_cliente', clienteTelefone)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setFichas(data);
      
      // Buscar qual é a ficha ativa do cliente
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('ficha_ativa_id')
        .eq('telefone', clienteTelefone)
        .single();

      // Se há ficha ativa, usar ela, senão usar a primeira
      const fichaInicial = clienteData?.ficha_ativa_id || data[0].id;
      setFichaAtual(fichaInicial);
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

  const criarFicha = async () => {
    const nomeGerado = `${clienteNome}@${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .insert([{
        id: nomeGerado,
        telefone_cliente: clienteTelefone,
        nome_ficha: nomeGerado,
        status: 'Ficha Criada',
        valor_total: 0,
        valor_mao_obra: 0,
        valor_pecas: 0,
        pagamento_parcelas: 1,
        pagamento_gerar_link: false,
      }] as any)
      .select()
      .single();

    if (!error && data) {
      fetchFichas();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="h-12 flex items-center justify-between px-4 border-b bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold truncate">{clienteNome}</h2>
          <p className="text-xs text-muted-foreground truncate">{clienteTelefone}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 space-y-2 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <Select
                value={fichaAtual || ''}
                onValueChange={(value) => {
                  setFichaAtual(value);
                  marcarFichaComoAtiva(value);
                }}
              >
                <SelectTrigger className="flex-1">
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
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="ficha" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-3 mt-2 shrink-0">
              <TabsTrigger value="ficha" className="flex-1 text-xs">
                <FileText className="mr-1 h-3 w-3" />
                Ficha
              </TabsTrigger>
              <TabsTrigger value="orcamentos" className="flex-1 text-xs">
                <DollarSign className="mr-1 h-3 w-3" />
                Orçamentos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ficha" className="flex-1 overflow-y-auto p-3 m-0">
              <FichaServicoTab fichaId={fichaAtual} />
            </TabsContent>
            <TabsContent value="orcamentos" className="flex-1 overflow-y-auto p-3 m-0">
              <OrcamentosTab fichaId={fichaAtual} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <CriarFichaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clienteTelefone={clienteTelefone}
        clienteNome={clienteNome}
        webhookUrl={webhookUrl}
      />
    </div>
  );
};