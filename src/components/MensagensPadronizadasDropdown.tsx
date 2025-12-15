import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MensagemPadronizada {
  id: string;
  titulo: string;
  mensagem: string;
  tag: string | null;
  ordem: number;
}

interface MensagensPadronizadasDropdownProps {
  onSelectMensagem: (mensagem: string) => void;
  clienteNome: string;
  clienteTelefone: string;
  fichaId?: string;
}

export const MensagensPadronizadasDropdown = ({
  onSelectMensagem,
  clienteNome,
  clienteTelefone,
  fichaId,
}: MensagensPadronizadasDropdownProps) => {
  const [mensagens, setMensagens] = useState<MensagemPadronizada[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fichaData, setFichaData] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchMensagens();
    if (fichaId) {
      fetchFichaData();
    }
  }, [fichaId]);

  const fetchMensagens = async () => {
    try {
      const { data, error } = await supabase
        .from("mensagens_padronizadas")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  };

  const fetchFichaData = async () => {
    if (!fichaId) return;

    try {
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("*, prestadores(nome)")
        .eq("id", fichaId)
        .maybeSingle();

      if (error) throw error;
      setFichaData(data);
    } catch (error) {
      console.error("Erro ao carregar dados da ficha:", error);
    }
  };

  const substituirVariaveis = (mensagem: string): string => {
    let resultado = mensagem;

    resultado = resultado.replace(/\[nome_cliente\]/g, clienteNome);
    resultado = resultado.replace(/\[telefone_cliente\]/g, clienteTelefone);

    if (fichaData) {
      resultado = resultado.replace(/\[nome_ficha\]/g, fichaData.nome_ficha || "");
      resultado = resultado.replace(/\[status_ficha\]/g, fichaData.status || "");
      resultado = resultado.replace(
        /\[valor_total\]/g,
        fichaData.valor_total ? `R$ ${fichaData.valor_total.toFixed(2)}` : "R$ 0.00"
      );
      
      // Substituir nome do prestador
      const prestadorNome = fichaData.prestadores?.nome || "";
      resultado = resultado.replace(/\[prestador_nome\]/g, prestadorNome);
      
      // Substituir link de pagamento
      resultado = resultado.replace(/\[pagamento_link\]/g, fichaData.pagamento_link || "");
    } else {
      // Se não houver ficha, substituir por placeholders
      resultado = resultado.replace(/\[nome_ficha\]/g, "[Nome da ficha não disponível]");
      resultado = resultado.replace(/\[status_ficha\]/g, "[Status não disponível]");
      resultado = resultado.replace(/\[valor_total\]/g, "[Valor não disponível]");
      resultado = resultado.replace(/\[prestador_nome\]/g, "[Prestador não disponível]");
      resultado = resultado.replace(/\[pagamento_link\]/g, "[Link não disponível]");
    }

    return resultado;
  };

  const handleSelectMensagem = (msg: MensagemPadronizada) => {
    const mensagemProcessada = substituirVariaveis(msg.mensagem);
    onSelectMensagem(mensagemProcessada);
    setOpen(false);
    toast.success(`Mensagem "${msg.titulo}" inserida!`);
  };

  const mensagensFiltradas = mensagens.filter(
    (msg) =>
      msg.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.mensagem.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" type="button">
          <FileText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 z-50 bg-popover" align="start" onWheel={(e) => e.stopPropagation()}>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-96">
          {mensagensFiltradas.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            <div className="p-2">
              {mensagensFiltradas.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMensagem(msg)}
                  className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{msg.titulo}</span>
                    {msg.tag && (
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {msg.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {msg.mensagem}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
