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
  clienteId: string;
  clienteNome: string;
  onClose: () => void;
}

export const FichaPanel = ({ clienteId, clienteNome, onClose }: FichaPanelProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [fichaAtual, setFichaAtual] = useState<string | null>(null);

  useEffect(() => {
    fetchFichas();
  }, [clienteId]);

  const fetchFichas = async () => {
    const { data } = await supabase
      .from('fichas_de_servico')
      .select('id, nome_ficha')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setFichas(data);
      setFichaAtual(data[0].id);
    }
  };

  const criarFicha = async () => {
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .insert({
        cliente_id: clienteId,
        nome_ficha: `Ficha ${clienteNome} - ${new Date().toLocaleDateString()}`,
        status: 'pendente',
        valor_total: 0,
        valor_mao_obra: 0,
        valor_pecas: 0,
      })
      .select()
      .single();

    if (!error && data) {
      fetchFichas();
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <div className="p-4 border-b flex items-center justify-between">
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
            <Tabs defaultValue="ficha" className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-4">
                <TabsTrigger value="ficha" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Ficha de Serviço
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="flex-1">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Orçamentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ficha" className="flex-1 overflow-hidden">
                <FichaServicoTab fichaId={fichaAtual} />
              </TabsContent>

              <TabsContent value="orcamentos" className="flex-1 overflow-hidden">
                <OrcamentosTab fichaId={fichaAtual} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
};