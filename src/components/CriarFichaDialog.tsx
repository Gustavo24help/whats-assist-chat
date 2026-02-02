import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CriarFichaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteTelefone: string;
  clienteNome: string;
  webhookUrl: string;
}

export const CriarFichaDialog = ({
  open,
  onOpenChange,
  clienteTelefone,
  clienteNome,
  webhookUrl,
}: CriarFichaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  
  // Gerar nome padrão da ficha baseado no banco de dados
  // Novo padrão: FGM{n}-YYMMDD (anti-duplicação)
  const generateDefaultFichaName = async (): Promise<string> => {
    const today = new Date();
    const dateStr = format(today, "yyMMdd");
    const pattern = `FGM%-${dateStr}`;
    
    // Buscar todas as fichas que seguem o padrão FGMx-YYMMDD para hoje
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .select('nome_ficha')
      .ilike('nome_ficha', pattern)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar fichas:', error);
      return `FGM1-${dateStr}`;
    }
    
    // Se não houver fichas para hoje, começar com FGM1-YYMMDD
    if (!data || data.length === 0) {
      return `FGM1-${dateStr}`;
    }
    
    // Extrair os números das fichas encontradas e pegar o maior
    const numeros = data
      .map(ficha => {
        const match = ficha.nome_ficha?.match(/^FGM(\d+)-/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const proximoNumero = maxNumero + 1;
    
    return `FGM${proximoNumero}-${dateStr}`;
  };

  const [formData, setFormData] = useState({
    nome_ficha: "",
    descricao: "",
    categoria: "",
  });

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");
    
    if (data) setCategorias(data);
  };

  // Gerar nome padrão ao abrir o diálogo
  useEffect(() => {
    if (open) {
      generateDefaultFichaName().then(name => {
        setFormData(prev => ({ ...prev, nome_ficha: name }));
      });
      fetchCategorias();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!webhookUrl) {
      toast.error("Configure o webhook de criação de fichas nas configurações");
      return;
    }

    try {
      setLoading(true);

      const nomeFicha = formData.nome_ficha;

      // 1. CRIAR FICHA LOCALMENTE PRIMEIRO (com webhook_pendente = true)
      const { error: insertError } = await supabase
        .from('fichas_de_servico')
        .insert({
          id: nomeFicha,
          nome_ficha: nomeFicha,
          telefone_cliente: clienteTelefone,
          nome_cliente: clienteNome,
          descricao: formData.descricao,
          categoria_id: formData.categoria ? parseInt(formData.categoria) : null,
          status: 'Ficha Criada',
          webhook_pendente: true,
        });

      if (insertError) {
        // Se for conflito de nome (duplicidade), gerar novo nome e tentar novamente
        if (insertError.code === '23505') {
          const novoNome = await generateDefaultFichaName();
          setFormData(prev => ({ ...prev, nome_ficha: novoNome }));
          toast.error("Nome de ficha duplicado. Por favor, tente novamente com o novo nome gerado.");
          setLoading(false);
          return;
        }
        throw insertError;
      }

      // 2. ATUALIZAR FICHA ATIVA DO CLIENTE
      await supabase
        .from('clientes')
        .update({ ficha_ativa_id: nomeFicha })
        .eq('telefone', clienteTelefone);

      toast.success("Ficha criada com sucesso!");
      onOpenChange(false);

      // 3. CHAMAR WEBHOOK DE FORMA ASSÍNCRONA (não bloqueia)
      const payload = {
        telefone_cliente: clienteTelefone,
        nome_cliente: clienteNome,
        nome_ficha: nomeFicha,
        descricao: formData.descricao,
        categoria: formData.categoria,
      };

      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (response.ok) {
            // Marcar webhook como enviado com sucesso
            await supabase
              .from('fichas_de_servico')
              .update({ webhook_pendente: false })
              .eq('id', nomeFicha);
            console.log(`Webhook enviado com sucesso para ficha ${nomeFicha}`);
          } else {
            console.error(`Webhook falhou para ficha ${nomeFicha}: ${response.status}`);
          }
        })
        .catch((err) => {
          console.error(`Erro ao chamar webhook para ficha ${nomeFicha}:`, err);
        });

      // 4. Aguardar 3 segundos antes de recarregar
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error: any) {
      console.error("Erro ao criar ficha:", error);
      toast.error(error.message || "Erro ao criar ficha");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar Nova Ficha</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar uma nova ficha de serviço para {clienteNome}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome_ficha">Nome da Ficha *</Label>
              <Input
                id="nome_ficha"
                placeholder="FGM1@251023"
                value={formData.nome_ficha}
                onChange={(e) =>
                  setFormData({ ...formData, nome_ficha: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do Serviço *</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o serviço solicitado..."
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                required
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom"
                  align="start"
                  className="z-50 max-h-[300px] bg-background"
                  sideOffset={4}
                >
                  {categorias.map((cat) => (
                    <SelectItem 
                      key={cat.id} 
                      value={cat.id.toString()}
                      className="min-h-[44px] cursor-pointer text-base"
                    >
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Ficha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
