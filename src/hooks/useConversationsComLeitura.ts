import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { ConversaComLeitura } from "@/types/chat-beta";

export function useConversationsComLeitura() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<ConversaComLeitura[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversas = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Buscar clientes com última interação
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("telefone, nome, ultima_interacao, ultima_mensagem_recebida")
        .eq("arquivado", false)
        .order("ultima_interacao", { ascending: false })
        .limit(200);

      if (clientesError) {
        console.error("Erro ao buscar clientes:", clientesError);
        setLoading(false);
        return;
      }

      // 2. Buscar dados de leitura para este operador
      const { data: leituraData } = await supabase
        .from("conversa_operador_leitura")
        .select("cliente_telefone, mensagens_nao_lidas, ultima_leitura, outro_operador_leu_id, outro_operador_leu_em")
        .eq("operador_id", user.id);

      // 3. Buscar nomes dos outros operadores que leram
      const outrosIds = [...new Set(
        (leituraData || [])
          .filter(l => l.outro_operador_leu_id)
          .map(l => l.outro_operador_leu_id!)
      )];

      let profilesMap: Record<string, string> = {};
      if (outrosIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", outrosIds);
        profiles?.forEach(p => {
          profilesMap[p.id] = p.full_name || "Operador";
        });
      }

      // 4. Buscar última mensagem de cada cliente
      const telefones = (clientes || []).map(c => c.telefone);
      const { data: ultimasMsgs } = await supabase
        .from("mensagens")
        .select("cliente_id, texto, data_hora")
        .in("cliente_id", telefones)
        .order("data_hora", { ascending: false });

      const ultimaMsgMap: Record<string, string | null> = {};
      ultimasMsgs?.forEach(m => {
        if (!ultimaMsgMap[m.cliente_id]) {
          ultimaMsgMap[m.cliente_id] = m.texto;
        }
      });

      // 5. Montar lista
      const calcularHa = (timestamp: string | null): string | null => {
        if (!timestamp) return null;
        const minutos = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
        if (minutos < 1) return "agora";
        if (minutos < 60) return `há ${minutos}m`;
        if (minutos < 1440) return `há ${Math.floor(minutos / 60)}h`;
        return `há ${Math.floor(minutos / 1440)}d`;
      };

      const conversasFormatadas: ConversaComLeitura[] = (clientes || []).map(c => {
        const leitura = (leituraData || []).find(l => l.cliente_telefone === c.telefone);
        const outroNome = leitura?.outro_operador_leu_id
          ? profilesMap[leitura.outro_operador_leu_id] || null
          : null;

        return {
          clienteTelefone: c.telefone,
          clienteNome: c.nome || c.telefone.replace("whatsapp:", ""),
          ultima_mensagem: ultimaMsgMap[c.telefone] || null,
          updated_at: c.ultima_interacao,
          naoLidosPorEsteOp: leitura?.mensagens_nao_lidas || 0,
          outroOpLeuNome: outroNome,
          outroOpLeuHa: calcularHa(leitura?.outro_operador_leu_em || null),
        };
      });

      setConversas(conversasFormatadas);
    } catch (err) {
      console.error("Erro geral:", err);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversas();
  }, [fetchConversas]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversas-beta-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        () => fetchConversas()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversa_operador_leitura", filter: `operador_id=eq.${user.id}` },
        () => fetchConversas()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversas]);

  return { conversas, loading, refetch: fetchConversas };
}
