import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { OperadorUnreadData } from '@/types/chat-beta';

/**
 * Gerencia os "não lidos" para uma conversa específica (por cliente_telefone),
 * do ponto de vista do operador logado.
 */
export function useOperadorUnread(clienteTelefone: string) {
  const { user } = useAuth();
  const [data, setData] = useState<OperadorUnreadData | null>(null);
  const [loading, setLoading] = useState(true);

  const calcularHa = (timestamp: Date | null): string | null => {
    if (!timestamp) return null;
    const minutos = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `há ${minutos}m`;
    if (minutos < 1440) return `há ${Math.floor(minutos / 60)}h`;
    return `há ${Math.floor(minutos / 1440)}d`;
  };

  // Buscar dados iniciais
  useEffect(() => {
    if (!clienteTelefone || !user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const { data: row } = await supabase
        .from('conversa_operador_leitura')
        .select(`
          mensagens_nao_lidas,
          ultima_leitura,
          outro_operador_leu_id,
          outro_operador_leu_em
        `)
        .eq('cliente_telefone', clienteTelefone)
        .eq('operador_id', user.id)
        .maybeSingle();

      if (row) {
        // Buscar nome do outro operador se existir
        let outroOpNome: string | null = null;
        if (row.outro_operador_leu_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.outro_operador_leu_id)
            .maybeSingle();
          outroOpNome = profile?.full_name || null;
        }

        const outroEm = row.outro_operador_leu_em ? new Date(row.outro_operador_leu_em) : null;

        setData({
          naoLidos: row.mensagens_nao_lidas || 0,
          ultimaLeitura: row.ultima_leitura ? new Date(row.ultima_leitura) : null,
          outroOpLeuNome: outroOpNome,
          outroOpLeuEm: outroEm,
          outroOpLeuHa: calcularHa(outroEm),
        });
      } else {
        setData({
          naoLidos: 0,
          ultimaLeitura: null,
          outroOpLeuNome: null,
          outroOpLeuEm: null,
          outroOpLeuHa: null,
        });
      }

      setLoading(false);
    };

    fetchData();
  }, [clienteTelefone, user]);

  // Realtime: atualizar quando houver mudanças na leitura desta conversa
  useEffect(() => {
    if (!clienteTelefone || !user) return;

    const channel = supabase
      .channel(`unread:${clienteTelefone}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversa_operador_leitura',
          filter: `cliente_telefone=eq.${clienteTelefone}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, any>;
          if (!newRow) return;

          // Update para ESTE operador
          if (newRow.operador_id === user.id) {
            setData((prev) => ({
              ...(prev || { outroOpLeuNome: null, outroOpLeuEm: null, outroOpLeuHa: null }),
              naoLidos: newRow.mensagens_nao_lidas ?? 0,
              ultimaLeitura: newRow.ultima_leitura ? new Date(newRow.ultima_leitura) : null,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteTelefone, user]);

  // Marcar conversa como lida
  const marcarComoLido = useCallback(async () => {
    if (!clienteTelefone || !user) return;

    const agora = new Date().toISOString();

    // Upsert: zerar não lidos e registrar leitura
    const { error } = await supabase
      .from('conversa_operador_leitura')
      .upsert(
        {
          cliente_telefone: clienteTelefone,
          operador_id: user.id,
          mensagens_nao_lidas: 0,
          ultima_leitura: agora,
          updated_at: agora,
        },
        { onConflict: 'cliente_telefone,operador_id' }
      );

    if (error) {
      console.error('Erro ao marcar como lido:', error);
      return;
    }

    // Atualizar localmente
    setData((prev) => ({
      ...(prev || { outroOpLeuNome: null, outroOpLeuEm: null, outroOpLeuHa: null }),
      naoLidos: 0,
      ultimaLeitura: new Date(agora),
    }));

    // Registrar que "outro operador leu" para os demais
    await supabase
      .from('conversa_operador_leitura')
      .update({
        outro_operador_leu_id: user.id,
        outro_operador_leu_em: agora,
      })
      .eq('cliente_telefone', clienteTelefone)
      .neq('operador_id', user.id);
  }, [clienteTelefone, user]);

  return {
    ...data,
    loading,
    marcarComoLido,
  };
}
