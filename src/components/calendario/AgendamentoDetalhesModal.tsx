import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLabelTipo, getCorTipo } from "@/lib/calcularEstadoAgendamento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy } from "lucide-react";
import { formatJanela } from "@/lib/janelaHorarioPrestador";

const ALL_STATUS = [
  'Ficha Criada', 'Contato Inicial', 'Dúvida Prestador', 'Orçamento Enviado',
  'Negociação', 'Visita Técnica', 'Orçamento Aprovado / Agendamento',
  'Orçamento Não Aprovado', 'Agendado', 'Em andamento', 'Finalizado',
  'Garantia', 'Perdido', 'Não foi adiante', 'Retorno', 'pendente'
];

interface Props {
  ficha: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AgendamentoDetalhesModal({ ficha, open, onClose, onSaved }: Props) {
  const [novoStatus, setNovoStatus] = useState(ficha?.status || '');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  if (!ficha) return null;

  const dataAgendamento = ficha.tipo_agendamento === 'retorno'
    ? ficha.data_retorno
    : ficha.horario_agendamento;

  const handleSalvar = async () => {
    if (!novoStatus) {
      toast.error("Selecione um status");
      return;
    }
    setSaving(true);
    try {
      const updateData: any = { status: novoStatus as any };
      if (observacao.trim()) {
        updateData.notas = ficha.notas
          ? `${ficha.notas}\n[${format(new Date(), 'dd/MM/yyyy HH:mm')}] ${observacao}`
          : `[${format(new Date(), 'dd/MM/yyyy HH:mm')}] ${observacao}`;
      }

      const { error } = await supabase
        .from('fichas_de_servico')
        .update(updateData)
        .eq('id', ficha.id);

      if (error) throw error;
      toast.success("Status atualizado com sucesso");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ficha {ficha.id}
            <Badge style={{ backgroundColor: getCorTipo(ficha.tipo_agendamento) }} className="text-white text-xs">
              {getLabelTipo(ficha.tipo_agendamento)}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-auto"
              title="Copiar info para prestador"
              onClick={async () => {
                const agendamentoStr = dataAgendamento
                  ? format(new Date(dataAgendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : '—';
                const lines = [
                  `📋 *Ficha #${ficha.id}*`,
                  `👤 Cliente: ${ficha.nome_cliente || ficha.clientes?.nome || '—'}`,
                  ficha.endereco ? `📍 Endereço: ${ficha.endereco}${ficha.bairro ? ` - ${ficha.bairro}` : ''}${ficha.cidade ? ` - ${ficha.cidade}` : ''}` : null,
                  ficha.descricao ? `🔧 Serviço: ${ficha.descricao}` : null,
                  ficha.categorias?.nome ? `📂 Categoria: ${ficha.categorias.nome}` : null,
                  ficha.prestadores?.nome ? `👷 Prestador: ${ficha.prestadores.nome}` : null,
                  `📅 Agendamento: ${agendamentoStr}`,
                  ficha.tempo_servico ? `⏱ Tempo estimado: ${ficha.tempo_servico}` : null,
                  ficha.valor_total ? `💰 Valor total: R$ ${Number(ficha.valor_total).toFixed(2).replace('.', ',')}` : null,
                  ficha.notas ? `📝 Obs: ${ficha.notas}` : null,
                ].filter(Boolean).join('\n');
                await navigator.clipboard.writeText(lines);
                toast.success("Informações copiadas!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground">Cliente</span>
              <p className="font-medium">{ficha.nome_cliente || ficha.clientes?.nome || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone</span>
              <p className="font-medium">{ficha.telefone_cliente}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Prestador</span>
              <p className="font-medium">{ficha.prestadores?.nome || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Categoria</span>
              <p className="font-medium">{ficha.categorias?.nome || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data/Hora</span>
              <p className="font-medium">
                {dataAgendamento ? format(new Date(dataAgendamento), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status Atual</span>
              <p className="font-medium">{ficha.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground">Janela Cliente</span>
              <p className="font-medium">
                {formatJanela(
                  ficha.tipo_agendamento === 'retorno' ? ficha.hora_inicio_retorno : ficha.hora_inicio_agendamento,
                  ficha.tipo_agendamento === 'retorno' ? ficha.hora_fim_retorno : ficha.hora_fim_agendamento
                ) || '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Janela Prestador</span>
              <p className="font-medium">
                {formatJanela(
                  ficha.tipo_agendamento === 'retorno' ? ficha.hora_inicio_prestador_retorno : ficha.hora_inicio_prestador_agendamento,
                  ficha.tipo_agendamento === 'retorno' ? ficha.hora_fim_prestador_retorno : ficha.hora_fim_prestador_agendamento
                ) || '—'}
              </p>
            </div>
          </div>

          {ficha.descricao && (
            <div>
              <span className="text-muted-foreground">Descrição</span>
              <p className="font-medium">{ficha.descricao}</p>
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <label className="text-sm font-medium">Alterar Status</label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium">Observação (opcional)</label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicione uma observação..."
              rows={2}
            />

            <Button onClick={handleSalvar} disabled={saving} className="w-full">
              {saving ? 'Salvando...' : 'Salvar alteração'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
