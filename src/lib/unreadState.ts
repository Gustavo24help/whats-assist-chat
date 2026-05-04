/**
 * Estado de não-lida POR OPERADOR (autenticado), calculado no banco.
 *
 * Substitui o cálculo no frontend que dependia de carregar TODAS as linhas
 * de `mensagem_leitura_operador` (limitado a 1000 pelo PostgREST). Como o
 * número de conversas ativas pode passar de 1500, esse limite fazia o
 * navegador "esquecer" o `last_read_at` de várias conversas e a bolinha
 * voltava sozinha logo depois do clique.
 *
 * A função SQL `get_unread_state_for_user` recebe a lista de telefones e
 * devolve, por conversa, o estado real do operador autenticado.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UnreadStateRow {
  cliente_id: string;
  ultima_data_cliente: string | null;
  total_nao_lidas: number;
  last_read_at: string | null;
  manual_unread: boolean;
  is_unread: boolean;
}

/**
 * Busca o estado de não-lida do operador autenticado para uma lista de
 * conversas. Faz em chunks para evitar URLs longas.
 */
export const fetchUnreadStateForUser = async (
  telefones: string[],
): Promise<Map<string, UnreadStateRow>> => {
  const map = new Map<string, UnreadStateRow>();
  if (!telefones.length) return map;

  const CHUNK = 500;
  for (let i = 0; i < telefones.length; i += CHUNK) {
    const slice = telefones.slice(i, i + CHUNK);
    const { data, error } = await (supabase as any).rpc(
      "get_unread_state_for_user",
      { _telefones: slice },
    );
    if (error) {
      console.error("[unreadState] RPC get_unread_state_for_user falhou:", error);
      continue;
    }
    (data || []).forEach((row: UnreadStateRow) => {
      map.set(row.cliente_id, row);
    });
  }

  return map;
};
