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
 *   - abrir conversa            → markConversationAutoRead (NÃO apaga manual_unread)
 *   - chegar msg em conversa aberta → markConversationAutoRead (NÃO apaga manual_unread)
 *   - menu "Marcar como não lida"   → markConversationUnread (sobe flag)
 *   - menu "Marcar como lida"       → markConversationRead (apaga flag explicitamente)
 *
 * IMPORTANTE: leitura automática (abrir chat / chegar mensagem) NUNCA apaga
 * a flag manual_unread. Só ação explícita no menu "Marcar como lida" apaga.
 * Isso garante a permanência do "não lido" mesmo com a conversa aberta.
 *
 * NUNCA escrever em `mensagem_leitura_operador` durante carregamento de lista.
 */
import { supabase } from "@/integrations/supabase/client";

export const CHAT_OUTBOUND_SENDERS = new Set([
  "whatsapp:+554138911555",
  "whatsapp:+14155238886",
  "atendente",
  "bot",
  "operador",
  "system",
]);

export const CHAT_OUTBOUND_TYPES = new Set(["atendente", "bot", "operador", "system"]);

export const isClientMessage = (message: { remetente?: string | null; tipo_remetente?: string | null }): boolean => {
  if (message.tipo_remetente === "cliente") return true;
  if (message.tipo_remetente && CHAT_OUTBOUND_TYPES.has(message.tipo_remetente)) return false;
  return !!message.remetente && !CHAT_OUTBOUND_SENDERS.has(message.remetente);
};

/**
 * Leitura AUTOMÁTICA (montagem da janela / nova msg em chat aberto).
 * Atualiza apenas last_read_at e NUNCA toca em manual_unread.
 */
export const markConversationAutoRead = async (
  clienteTelefone: string,
  userId: string,
): Promise<void> => {
  const { error } = await (supabase as any)
    .from("mensagem_leitura_operador")
    .upsert(
      {
        cliente_telefone: clienteTelefone,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "cliente_telefone,user_id" },
    );
  if (error) throw error;
};

/**
 * Leitura EXPLÍCITA (menu "Marcar como lida").
 * Atualiza last_read_at e força manual_unread = false.
 */
export const markConversationRead = async (
  clienteTelefone: string,
  userId: string,
): Promise<void> => {
  const { error } = await (supabase as any)
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
  if (error) throw error;
};

export const markConversationUnread = async (
  clienteTelefone: string,
  userId: string,
): Promise<void> => {
  // Marcação manual NÃO mexe em last_read_at — apenas levanta a flag.
  const { error } = await (supabase as any)
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
  if (error) throw error;
};
