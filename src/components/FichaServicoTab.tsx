import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FichaServicoTabProps {
  fichaId: string;
}

interface Ficha {
  id: string;
  telefone_cliente: string;
  nome_ficha: string | null;
  descricao: string | null;
  status: string;
  prestador_id: string | null;
  valor_total: number;
  valor_mao_obra: number;
  valor_pecas: number;
  horario_agendamento: string | null;
  cpf: string | null;
  endereco: string | null;
  pagamento_tipo: string | null;
  pagamento_parcelas: number;
  pagamento_gerar_link: boolean;
  notas: string | null;
  categoria_id: number | null;
  id_zoho: string | null;
}

interface Prestador {
  cpf: string;
  nome: string;
}

const STATUS_OPTIONS = [
  "Não foi adiante",
  "Ficha Criada",
  "Contato Inicial",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Negociação",
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Orçamento Não Aprovado",
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
  "Perdido"
];

export const FichaServicoTab = ({ fichaId }: FichaServicoTabProps) => {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [agendamento, setAgendamento] = useState<Date | undefined>();

  useEffect(() => {
    fetchFicha();
    fetchPrestadores();

    const channel = supabase
      .channel(`ficha-${fichaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fichas_de_servico',
          filter: `id=eq.${fichaId}`
        },
        () => fetchFicha()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId]);

  const fetchFicha = async () => {
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .select('*')
      .eq('id', fichaId)
      .maybeSingle();

    if (!error && data) {
      setFicha(data);
      if (data.horario_agendamento) {
        setAgendamento(new Date(data.horario_agendamento));
      }
    }
  };

  const fetchPrestadores = async () => {
    const { data } = await supabase
      .from('prestadores')
      .select('cpf, nome')
      .order('nome');

    if (data) setPrestadores(data as Prestador[]);
  };

  const salvarFicha = async () => {
    if (!ficha) return;

    try {
      const { error } = await supabase
        .from('fichas_de_servico')
        .update({
          nome_ficha: ficha.nome_ficha,
          descricao: ficha.descricao,
          status: ficha.status as any,
          prestador_id: ficha.prestador_id,
          valor_total: ficha.valor_total,
          valor_mao_obra: ficha.valor_mao_obra,
          valor_pecas: ficha.valor_pecas,
          horario_agendamento: agendamento?.toISOString(),
          cpf: ficha.cpf,
          endereco: ficha.endereco,
          pagamento_tipo: ficha.pagamento_tipo as any,
          pagamento_parcelas: ficha.pagamento_parcelas,
          pagamento_gerar_link: ficha.pagamento_gerar_link,
          notas: ficha.notas,
          categoria_id: ficha.categoria_id,
          id_zoho: ficha.id_zoho,
        })
        .eq('id', fichaId);

      if (error) throw error;

      // Disparar webhook
      const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
      if (webhookUrl) {
        try {
          // Buscar dados completos para enviar no webhook
          const { data: fichaCompleta } = await supabase
            .from('fichas_de_servico')
            .select('*')
            .eq('id', fichaId)
            .maybeSingle();

          if (fichaCompleta) {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: fichaCompleta.id,
                telefone_cliente: fichaCompleta.telefone_cliente,
                nome_ficha: fichaCompleta.nome_ficha,
                status: fichaCompleta.status,
                categoria_id: fichaCompleta.categoria_id,
                descricao: fichaCompleta.descricao,
                prestador_id: fichaCompleta.prestador_id,
                valor_total: fichaCompleta.valor_total,
                valor_mao_obra: fichaCompleta.valor_mao_obra,
                valor_pecas: fichaCompleta.valor_pecas,
                horario_agendamento: fichaCompleta.horario_agendamento,
                cpf: fichaCompleta.cpf,
                endereco: fichaCompleta.endereco,
                pagamento_gerar_link: fichaCompleta.pagamento_gerar_link,
                pagamento_tipo: fichaCompleta.pagamento_tipo,
                pagamento_parcelas: fichaCompleta.pagamento_parcelas,
                id_zoho: fichaCompleta.id_zoho,
                notas: fichaCompleta.notas,
              }),
            });
          }
        } catch (webhookError) {
          console.error('Erro ao enviar webhook:', webhookError);
          toast.warning("Ficha salva, mas erro ao enviar webhook");
        }
      }

      toast.success("Ficha atualizada com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      toast.error("Erro ao salvar ficha");
    }
  };

  if (!ficha) return <div className="p-4">Carregando...</div>;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <Label htmlFor="nome_ficha">Nome da Ficha</Label>
        <Input
          id="nome_ficha"
          value={ficha.nome_ficha || ''}
          onChange={(e) => setFicha({ ...ficha, nome_ficha: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={ficha.descricao || ''}
          onChange={(e) => setFicha({ ...ficha, descricao: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={ficha.status} onValueChange={(value) => setFicha({ ...ficha, status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="prestador">Prestador</Label>
        <Select 
          value={ficha.prestador_id || ''} 
          onValueChange={(value) => setFicha({ ...ficha, prestador_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um prestador" />
          </SelectTrigger>
          <SelectContent>
            {prestadores.map((prestador) => (
              <SelectItem key={prestador.cpf} value={prestador.cpf}>
                {prestador.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="valor_total">Valor Total</Label>
          <Input
            id="valor_total"
            type="number"
            value={ficha.valor_total}
            onChange={(e) => setFicha({ ...ficha, valor_total: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="valor_mao_obra">Mão de Obra</Label>
          <Input
            id="valor_mao_obra"
            type="number"
            value={ficha.valor_mao_obra}
            onChange={(e) => setFicha({ ...ficha, valor_mao_obra: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="valor_pecas">Peças</Label>
          <Input
            id="valor_pecas"
            type="number"
            value={ficha.valor_pecas}
            onChange={(e) => setFicha({ ...ficha, valor_pecas: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div>
        <Label>Agendamento</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !agendamento && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {agendamento ? format(agendamento, "PPP", { locale: ptBR }) : "Selecionar data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={agendamento}
              onSelect={setAgendamento}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="cpf">CPF do Cliente</Label>
        <Input
          id="cpf"
          value={ficha.cpf || ''}
          onChange={(e) => setFicha({ ...ficha, cpf: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="endereco">Endereço</Label>
        <Textarea
          id="endereco"
          value={ficha.endereco || ''}
          onChange={(e) => setFicha({ ...ficha, endereco: e.target.value })}
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="pagamento_tipo">Forma de Pagamento</Label>
        <Select 
          value={ficha.pagamento_tipo || ''} 
          onValueChange={(value) => setFicha({ ...ficha, pagamento_tipo: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="parcelas">Parcelamento</Label>
        <Input
          id="parcelas"
          type="number"
          value={ficha.pagamento_parcelas}
          onChange={(e) => setFicha({ ...ficha, pagamento_parcelas: parseInt(e.target.value) || 1 })}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="gerar_link"
          checked={ficha.pagamento_gerar_link}
          onChange={(e) => setFicha({ ...ficha, pagamento_gerar_link: e.target.checked })}
        />
        <Label htmlFor="gerar_link">Gerar Link de Pagamento</Label>
      </div>

      <div>
        <Label htmlFor="id_zoho">ID Zoho</Label>
        <Input
          id="id_zoho"
          value={ficha.id_zoho || ''}
          onChange={(e) => setFicha({ ...ficha, id_zoho: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={ficha.notas || ''}
          onChange={(e) => setFicha({ ...ficha, notas: e.target.value })}
          rows={3}
        />
      </div>

      <Button onClick={salvarFicha} className="w-full">
        Salvar Ficha
      </Button>
    </div>
  );
};
