import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ConversaComLeitura } from "@/types";

export function useConversationsComLeitura() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<ConversaComLeitura[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversas = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Buscar unique conversation_ids
      const { data: msgData, error: msgError } = await supabase
        .from("mensagens")
        .select("conversation_id, cliente_id, data_hora, texto")
        .order("data_hora", { ascending: false });

      if (msgError) {
        console.error("Erro ao buscar mensagens:", msgError);
        setLoading(false);
        return;
      }

      // 2. Agrupar por conversation_id
      const conversasMap = new Map();

      msgData?.forEach((msg: any) => {
        if (!conversasMap.has(msg.conversation_id)) {
          conversasMap.set(msg.conversation_id, {
            id: msg.conversation_id,
            cliente_id: msg.cliente_id,
            ultima_mensagem: msg.texto,
            updated_at: msg.data_hora,
          });
        }
      });

      // 3. Buscar dados de leitura por operador
      const { data: leituraData } = await supabase
        .from("conversa_operador_leitura")
        .select(
          `
          conversa_id,
          mensagens_nao_lidas,
          ultima_leitura,
          outro_operador_leu_id,
          outro_operador_leu_em,
          profiles!outro_operador_leu_id (nome)
        `,
        )
        .eq("operador_id", user.id);

      // 4. Mergear dados
      const conversasFormatadas: ConversaComLeitura[] = Array.from(conversasMap.values()).map((conv: any) => {
        const leitura = leituraData?.find((l: any) => l.conversa_id === conv.id);

        return {
          ...conv,
          naoLidosPorEsteOp: leitura?.mensagens_nao_lidas || 0,
          leuEm: leitura?.ultima_leitura || null,
          outroOpLeuEm: leitura?.outro_operador_leu_em || null,
          outroOpLeuNome: leitura?.profiles?.nome || null,
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

    const subscription = supabase
      .channel("mensagens-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
        },
        () => {
          fetchConversas();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchConversas]);

  return { conversas, loading, refetch: fetchConversas };
}
