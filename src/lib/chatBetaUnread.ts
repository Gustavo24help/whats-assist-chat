/**
 * Chat BETA — controle de leitura/não leitura por operador
 *
 * Fonte de verdade ÚNICA: tabela `mensagem_leitura_operador`
 *   - last_read_at  → timestamp da última leitura efetiva pelo operador
 *   - manual_unread → flag explícita "marcado como não lido"
 *   - manual_unread_at → apenas auditoria (não usado na regra)
 *
 * Regra de unread:
 *   unread = manual_unread === true
 *         OR (existe mensagem do cliente com data_hora > last_read_at)
 *
 * Eventos:
 *   - abrir conversa            → markConversationRead
 *   - chegar msg em conversa aberta para o operador atual → markConversationRead
 *   - menu "Marcar como não lida"   → markConversationUnread
 *   - menu "Marcar como lida"       → markConversationRead
 *
 * NUNCA escrever em `mensagem_leitura_operador` durante carregamento de lista.
 */
import { supabase } from "@/integrations/supabase/client";

export const markConversationRead = async (
  clienteTelefone: string,
  userId: string,
): Promise<void> => {
  await (supabase as any)
    .from("mensagem_leitura_operador")
    .upsert(
      {
        cliente_telefone: clienteTelefone,
        user_id: userId,
        last_read_at: new Date().toISOString(),
        manual_unread: false,
        manual_unread_at: null,
      },
      { onConflict: "cliente_telefone,user_id" },
    );
};

export const markConversationUnread = async (
  clienteTelefone: string,
  userId: string,
): Promise<void> => {
  // Marcação manual NÃO mexe em last_read_at — apenas levanta a flag.
  await (supabase as any)
    .from("mensagem_leitura_operador")
    .upsert(
      {
        cliente_telefone: clienteTelefone,
        user_id: userId,
        manual_unread: true,
        manual_unread_at: new Date().toISOString(),
      },
      { onConflict: "cliente_telefone,user_id" },
    );
};
