import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MetasModalProps {
  open: boolean;
  onClose: () => void;
}

interface Metas {
  valor_os: number;
  lucro_bruto: number;
  ticket_medio: number;
  quantidade_servicos: number;
  quantidade_fs: number;
  quantidade_agendados: number;
  taxa_fs_agendado: number;
  taxa_agendado_pago: number;
  taxa_conversao_total: number;
  tempo_resposta_max: number;
  tempo_orcamento_max: number;
}

const defaultMetas: Metas = {
  valor_os: 16200,
  lucro_bruto: 5000,
  ticket_medio: 400,
  quantidade_servicos: 40,
  quantidade_fs: 200,
  quantidade_agendados: 50,
  taxa_fs_agendado: 25,
  taxa_agendado_pago: 85,
  taxa_conversao_total: 10,
  tempo_resposta_max: 60,
  tempo_orcamento_max: 120,
};

export const MetasModal = ({ open, onClose }: MetasModalProps) => {
  const [tab, setTab] = useState('diarias');
  const [metas, setMetas] = useState<Metas>(defaultMetas);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadMetas(tab);
  }, [open, tab]);

  const loadMetas = async (tipo: string) => {
    const { data } = await supabase
      .from('dashboard_metas')
      .select('*')
      .eq('tipo', tipo)
      .maybeSingle();
    if (data) {
      setMetas({
        valor_os: Number(data.valor_os) || 0,
        lucro_bruto: Number(data.lucro_bruto) || 0,
        ticket_medio: Number(data.ticket_medio) || 0,
        quantidade_servicos: data.quantidade_servicos || 0,
        quantidade_fs: data.quantidade_fs || 0,
        quantidade_agendados: data.quantidade_agendados || 0,
        taxa_fs_agendado: Number(data.taxa_fs_agendado) || 0,
        taxa_agendado_pago: Number(data.taxa_agendado_pago) || 0,
        taxa_conversao_total: Number(data.taxa_conversao_total) || 0,
        tempo_resposta_max: data.tempo_resposta_max || 60,
        tempo_orcamento_max: data.tempo_orcamento_max || 120,
      });
    }
  };

  const salvar = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('dashboard_metas')
      .upsert({
        tipo: tab,
        ...metas,
      }, { onConflict: 'tipo' });

    if (error) {
      toast.error('Erro ao salvar metas');
    } else {
      toast.success('Metas salvas com sucesso!');
      onClose();
    }
    setLoading(false);
  };

  const updateField = (field: keyof Metas, value: string) => {
    setMetas((prev) => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const fields: { key: keyof Metas; label: string; prefix?: string; suffix?: string }[] = [
    { key: 'valor_os', label: 'Valor OS (Receita)', prefix: 'R$' },
    { key: 'lucro_bruto', label: 'Lucro Bruto', prefix: 'R$' },
    { key: 'ticket_medio', label: 'Ticket Médio', prefix: 'R$' },
    { key: 'quantidade_servicos', label: 'Quantidade de Serviços' },
    { key: 'quantidade_fs', label: 'FS Criadas' },
    { key: 'quantidade_agendados', label: 'Agendados' },
    { key: 'taxa_fs_agendado', label: 'Taxa FS → Agendado', suffix: '%' },
    { key: 'taxa_agendado_pago', label: 'Taxa Agendado → Pago', suffix: '%' },
    { key: 'taxa_conversao_total', label: 'Taxa Conversão Total', suffix: '%' },
    { key: 'tempo_resposta_max', label: 'Tempo Resposta Máx.', suffix: 'min' },
    { key: 'tempo_orcamento_max', label: 'Tempo Orçamento Máx.', suffix: 'min' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🎯 Configurar Metas</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="diarias" className="flex-1">Metas Diárias</TabsTrigger>
            <TabsTrigger value="mensais" className="flex-1">Metas Mensais</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <div className="flex items-center gap-1">
                    {f.prefix && <span className="text-xs text-muted-foreground">{f.prefix}</span>}
                    <Input
                      type="number"
                      value={metas[f.key]}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      className="h-8"
                    />
                    {f.suffix && <span className="text-xs text-muted-foreground">{f.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={salvar} disabled={loading} className="w-full mt-4">
              {loading ? 'Salvando...' : 'Salvar Metas'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
