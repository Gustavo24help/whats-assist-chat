/**
 * Helper para gravar logs estruturados em public.system_logs a partir de
 * Edge Functions, correlacionando por ficha_id / cliente_telefone.
 *
 * Uso:
 *   const log = createFichaLogger(supabase, { ficha_id, cliente_telefone, source: 'auto-finalizacao' });
 *   await log.info('mensagem', { detalhes: { ... } });
 *   await log.error('falhou', { detalhes: { err } });
 *
 * Nunca lança — falhas de log são silenciadas para não derrubar a função.
 */

type Nivel = "info" | "warn" | "error" | "debug";

export interface FichaLoggerOptions {
  ficha_id?: string | null;
  cliente_telefone?: string | null;
  /** Nome da edge function/origem (vai para detalhes.source). */
  source?: string;
}

export function createFichaLogger(supabase: any, opts: FichaLoggerOptions = {}) {
  const base = {
    ficha_id: opts.ficha_id ?? null,
    cliente_telefone: opts.cliente_telefone ?? null,
  };

  async function write(nivel: Nivel, mensagem: string, extras?: { detalhes?: Record<string, unknown> }) {
    try {
      await supabase.from("system_logs").insert({
        nivel,
        categoria: "automation",
        mensagem: String(mensagem).slice(0, 2000),
        detalhes: { source: opts.source, ...(extras?.detalhes ?? {}) },
        ...base,
      });
    } catch (e) {
      // Nunca falhar por causa do log.
      console.warn("[ficha_logger] insert failed", e);
    }
  }

  return {
    info: (m: string, extras?: { detalhes?: Record<string, unknown> }) => write("info", m, extras),
    warn: (m: string, extras?: { detalhes?: Record<string, unknown> }) => write("warn", m, extras),
    error: (m: string, extras?: { detalhes?: Record<string, unknown> }) => write("error", m, extras),
    debug: (m: string, extras?: { detalhes?: Record<string, unknown> }) => write("debug", m, extras),
    /** Atualiza o contexto (ex.: depois de buscar a ficha e ter telefone). */
    setContext: (ctx: FichaLoggerOptions) => {
      if (ctx.ficha_id !== undefined) base.ficha_id = ctx.ficha_id;
      if (ctx.cliente_telefone !== undefined) base.cliente_telefone = ctx.cliente_telefone;
    },
  };
}
