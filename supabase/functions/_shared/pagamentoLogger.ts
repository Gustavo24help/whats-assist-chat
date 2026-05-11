// Helper compartilhado para registrar eventos de webhook de pagamento.
// Fail-safe: nunca lança erro para o caller.

export interface PagamentoLogEntry {
  direcao: 'recebido' | 'enviado';
  origem: 'make_update_pagamento' | 'asaas_webhook' | 'create_payment_link' | 'reconcile_asaas' | string;
  ficha_id?: string | null;
  evento?: string | null;
  status?: 'success' | 'error' | 'ignored' | string;
  pagamento_link?: string | null;
  valor?: number | null;
  auth_source?: string | null;
  payload?: unknown;
  resposta?: unknown;
  duracao_ms?: number | null;
  erro?: string | null;
}

const MAX_JSON_BYTES = 10_000;

function truncateJson(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length > MAX_JSON_BYTES) {
      return { _truncated: true, preview: str.slice(0, MAX_JSON_BYTES) };
    }
    return typeof value === 'string' ? { raw: value } : value;
  } catch {
    return { _serializeError: true };
  }
}

export async function logPagamentoWebhook(supabase: any, entry: PagamentoLogEntry): Promise<void> {
  try {
    const row = {
      direcao: entry.direcao,
      origem: entry.origem,
      ficha_id: entry.ficha_id ?? null,
      evento: entry.evento ?? null,
      status: entry.status ?? 'success',
      pagamento_link: entry.pagamento_link ?? null,
      valor: entry.valor ?? null,
      auth_source: entry.auth_source ?? null,
      payload: truncateJson(entry.payload),
      resposta: truncateJson(entry.resposta),
      duracao_ms: entry.duracao_ms ?? null,
      erro: entry.erro ?? null,
    };
    const { error } = await supabase.from('pagamento_webhook_log').insert(row);
    if (error) console.warn('[pagamentoLogger] insert falhou (não-bloqueante):', error.message);
  } catch (err) {
    console.warn('[pagamentoLogger] exceção (não-bloqueante):', err);
  }
}
