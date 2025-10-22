import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, FileText, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaServicoTab } from "./FichaServicoTab";
import { OrcamentosTab } from "./OrcamentosTab";

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

  useEffect(() => {
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
      setFichaAtual(data[0].id);
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
    <div className="h-full flex flex-col bg-card border-l overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-lg">Ficha - {clienteNome}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {fichas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-4">
            Nenhuma ficha de serviço encontrada para este cliente
          </p>
          <Button onClick={criarFicha}>
            Criar Nova Ficha
          </Button>
        </div>
      ) : (
        <>
          {fichas.length > 1 && (
            <div className="p-4 border-b">
              <Select value={fichaAtual || ''} onValueChange={setFichaAtual}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma ficha" />
                </SelectTrigger>
                <SelectContent>
                  {fichas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome_ficha || `Ficha ${f.id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {fichaAtual && (
            <Tabs defaultValue="ficha" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-4 shrink-0">
                <TabsTrigger value="ficha" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Ficha de Serviço
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="flex-1">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Orçamentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ficha" className="flex-1 overflow-y-auto">
                <FichaServicoTab fichaId={fichaAtual} />
              </TabsContent>

              <TabsContent value="orcamentos" className="flex-1 overflow-y-auto">
                <OrcamentosTab fichaId={fichaAtual} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
};