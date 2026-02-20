import React, { useState, useEffect } from 'react';
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

interface MetasForm {
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

const defaultMetas: MetasForm = {
  valor_os: 0, lucro_bruto: 0, ticket_medio: 0,
  quantidade_servicos: 0, quantidade_fs: 0, quantidade_agendados: 0,
  taxa_fs_agendado: 0, taxa_agendado_pago: 0, taxa_conversao_total: 0,
  tempo_resposta_max: 60, tempo_orcamento_max: 120,
};

export function MetasModal({ open, onClose }: MetasModalProps) {
  const [tab, setTab] = useState<'diarias' | 'mensais'>('diarias');
  const [metas, setMetas] = useState<MetasForm>(defaultMetas);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadMetas(tab);
  }, [open, tab]);

  async function loadMetas(tipo: string) {
    const { data } = await supabase.from('dashboard_metas').select('*').eq('tipo', tipo).maybeSingle();
    if (data) {
      setMetas({
        valor_os: data.valor_os || 0,
        lucro_bruto: data.lucro_bruto || 0,
        ticket_medio: data.ticket_medio || 0,
        quantidade_servicos: data.quantidade_servicos || 0,
        quantidade_fs: data.quantidade_fs || 0,
        quantidade_agendados: data.quantidade_agendados || 0,
        taxa_fs_agendado: data.taxa_fs_agendado || 0,
        taxa_agendado_pago: data.taxa_agendado_pago || 0,
        taxa_conversao_total: data.taxa_conversao_total || 0,
        tempo_resposta_max: data.tempo_resposta_max || 60,
        tempo_orcamento_max: data.tempo_orcamento_max || 120,
      });
    } else {
      setMetas(defaultMetas);
    }
  }

  async function salvar() {
    setSaving(true);
    const { error } = await supabase.from('dashboard_metas').upsert({
      tipo: tab,
      ...metas,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tipo' });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar metas'); return; }
    toast.success('Metas salvas com sucesso!');
    onClose();
  }

  const field = (label: string, key: keyof MetasForm, prefix?: string, suffix?: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          value={metas[key]}
          onChange={e => setMetas(prev => ({ ...prev, [key]: Number(e.target.value) }))}
          className="h-8 text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🎯 Configurar Metas</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={v => setTab(v as 'diarias' | 'mensais')}>
          <TabsList className="w-full">
            <TabsTrigger value="diarias" className="flex-1">Metas Diárias</TabsTrigger>
            <TabsTrigger value="mensais" className="flex-1">Metas Mensais</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              {field('Valor OS (Receita)', 'valor_os', 'R$')}
              {field('Lucro Bruto', 'lucro_bruto', 'R$')}
              {field('Ticket Médio', 'ticket_medio', 'R$')}
              {field('Qtd Serviços', 'quantidade_servicos')}
              {field('Qtd FS', 'quantidade_fs')}
              {field('Qtd Agendados', 'quantidade_agendados')}
              {field('Taxa FS → Agendado', 'taxa_fs_agendado', undefined, '%')}
              {field('Taxa Agendado → Pago', 'taxa_agendado_pago', undefined, '%')}
              {field('Taxa Conversão Total', 'taxa_conversao_total', undefined, '%')}
              {field('Tempo Resposta Máx', 'tempo_resposta_max', undefined, 'min')}
              {field('Tempo Orçamento Máx', 'tempo_orcamento_max', undefined, 'min')}
            </div>
            <Button onClick={salvar} disabled={saving} className="w-full">
              {saving ? 'Salvando...' : 'Salvar Metas'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
