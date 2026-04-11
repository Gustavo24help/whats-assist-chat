import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { ConversaComLeitura } from '@/types/chat-beta';

/**
 * Busca a lista de clientes (conversas) com dados de leitura por operador.
 * Substitui/complementa o ConversationList para o Chat BETA.
 */
export function useConversationsComLeitura(filtros?: {
  status?: string;
  apenasComNaoLidos?: boolean;
}) {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<ConversaComLeitura[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversas = useCallback(async () => {
    if (!user) return;

    // Buscar registros de leitura do operador logado
    const { data: leituras } = await supabase
      .from('conversa_operador_leitura')
      .select('cliente_telefone, mensagens_nao_lidas, ultima_leitura, outro_operador_leu_id, outro_operador_leu_em')
      .eq('operador_id', user.id);

    if (!leituras) {
      setLoading(false);
      return;
    }

    // Mapear por telefone
    const leituraMap = new Map(
      leituras.map((l) => [l.cliente_telefone, l])
    );

    // Buscar clientes que têm registros de leitura
    const telefones = leituras
      .filter((l) => {
        if (filtros?.apenasComNaoLidos) return (l.mensagens_nao_lidas || 0) > 0;
        return true;
      })
      .map((l) => l.cliente_telefone);

    if (telefones.length === 0) {
      setConversas([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('clientes')
      .select('telefone, nome, status_conversa, ultima_interacao, ultima_mensagem_recebida, atendente_id, bot_habilitado, tags')
      .in('telefone', telefones)
      .order('ultima_mensagem_recebida', { ascending: false });

    if (filtros?.status) {
      query = query.eq('status_conversa', filtros.status as "aberta" | "fechada");
    }

    const { data: clientes } = await query;

    if (!clientes) {
      setConversas([]);
      setLoading(false);
      return;
    }

    // Buscar nomes dos "outro operador" que leram
    const outroIds = new Set(
      leituras
        .filter((l) => l.outro_operador_leu_id)
        .map((l) => l.outro_operador_leu_id!)
    );

    let outroNomes = new Map<string, string>();
    if (outroIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(outroIds));

      if (profiles) {
        outroNomes = new Map(profiles.map((p) => [p.id, p.full_name || 'Operador']));
      }
    }

    // Montar resultado
    const resultado: ConversaComLeitura[] = clientes.map((c) => {
      const leitura = leituraMap.get(c.telefone);
      return {
        clienteTelefone: c.telefone,
        clienteNome: c.nome || c.telefone,
        naoLidosPorEsteOp: leitura?.mensagens_nao_lidas || 0,
        leuEm: leitura?.ultima_leitura || null,
        outroOpLeuEm: leitura?.outro_operador_leu_em || null,
        outroOpLeuNome: leitura?.outro_operador_leu_id
          ? outroNomes.get(leitura.outro_operador_leu_id) || null
          : null,
      };
    });

    // Ordenar: não lidos primeiro, depois por data
    resultado.sort((a, b) => {
      if (a.naoLidosPorEsteOp > 0 && b.naoLidosPorEsteOp === 0) return -1;
      if (a.naoLidosPorEsteOp === 0 && b.naoLidosPorEsteOp > 0) return 1;
      return b.naoLidosPorEsteOp - a.naoLidosPorEsteOp;
    });

    setConversas(resultado);
    setLoading(false);
  }, [user, filtros?.status, filtros?.apenasComNaoLidos]);

  // Fetch inicial
  useEffect(() => {
    fetchConversas();
  }, [fetchConversas]);

  // Realtime: re-fetch quando leituras mudam para este operador
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversas-leitura-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversa_operador_leitura',
          filter: `operador_id=eq.${user.id}`,
        },
        () => {
          fetchConversas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversas]);

  return { conversas, loading, refetch: fetchConversas };
}
