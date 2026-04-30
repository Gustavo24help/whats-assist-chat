import { supabase } from "@/integrations/supabase/client";

/**
 * System Logger
 * Captura erros de console, falhas de rede (fetch) e ações de usuário,
 * persistindo em public.system_logs para auditoria.
 *
 * Uso:
 *  import { logSystemEvent, initSystemLogger } from "@/lib/systemLogger";
 *  initSystemLogger();   // chamar 1x na inicialização
 *  logSystemEvent({ nivel: "info", categoria: "user_action", mensagem: "Logout" });
 */

export type LogNivel = "info" | "warn" | "error" | "debug";
export type LogCategoria =
  | "console"
  | "network"
  | "user_action"
  | "auth"
  | "system"
  | "unhandled"
  | "chat";

interface LogPayload {
  nivel: LogNivel;
  categoria: LogCategoria;
  mensagem: string;
  detalhes?: Record<string, any> | null;
  /** Associa este log a uma ficha de serviço (busca por /system-logs/:fichaId). */
  ficha_id?: string | null;
  /** Associa este log a uma conversa (telefone do cliente). */
  cliente_telefone?: string | null;
  /** Se true, ignora deduplicação (eventos por telefone/operador). */
  skipDedup?: boolean;
}

interface UserContext {
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

// Contexto ativo da conversa/ficha aberta — usado para correlacionar logs
// de console/erros automaticamente sem precisar passar parâmetro a cada call.
let chatCtx: { ficha_id?: string | null; cliente_telefone?: string | null } = {};

export function setChatContext(ctx: { ficha_id?: string | null; cliente_telefone?: string | null }) {
  chatCtx = { ...ctx };
}

export function clearChatContext() {
  chatCtx = {};
}

let userCtx: UserContext = {};
let initialized = false;

// Buffer + throttling para não sobrecarregar o banco
const buffer: any[] = [];
let flushTimer: number | null = null;
const FLUSH_INTERVAL_MS = 4000;
const MAX_BUFFER = 30;

// Deduplicação simples (mensagens idênticas em janela curta)
const recent = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

function shouldSkipDuplicate(key: string): boolean {
  const now = Date.now();
  // limpar antigos
  for (const [k, t] of recent) {
    if (now - t > DEDUP_WINDOW_MS) recent.delete(k);
  }
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushBuffer();
  }, FLUSH_INTERVAL_MS);
}

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    // @ts-ignore - tabela existe na DB; types podem demorar a regenerar
    await supabase.from("system_logs").insert(batch);
  } catch (e) {
    // Silencia para não criar loop infinito
    // eslint-disable-next-line no-console
    console.debug("[systemLogger] flush failed", e);
  }
}

export function setLoggerUserContext(ctx: UserContext) {
  userCtx = { ...userCtx, ...ctx };
}

export function logSystemEvent(payload: LogPayload) {
  try {
    if (!payload.skipDedup) {
      const dedupKey = `${payload.nivel}:${payload.categoria}:${payload.mensagem}`.slice(0, 200);
      if (shouldSkipDuplicate(dedupKey)) return;
    }

    buffer.push({
      nivel: payload.nivel,
      categoria: payload.categoria,
      mensagem: String(payload.mensagem).slice(0, 2000),
      detalhes: payload.detalhes ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      user_id: userCtx.user_id ?? null,
      user_email: userCtx.user_email ?? null,
      user_name: userCtx.user_name ?? null,
      ficha_id: payload.ficha_id ?? chatCtx.ficha_id ?? null,
      cliente_telefone: payload.cliente_telefone ?? chatCtx.cliente_telefone ?? null,
    });

    if (buffer.length >= MAX_BUFFER) {
      void flushBuffer();
    } else {
      scheduleFlush();
    }
  } catch {
    // ignore
  }
}

/**
 * Helper específico para o Chat de Atendimento.
 * Use para registrar QUALQUER ação relevante feita por um operador no chat.
 *
 *   logChatEvent("mensagem_enviada", { telefone, ficha_id, ... });
 */
export function logChatEvent(
  acao: string,
  detalhes: Record<string, any> = {},
  options: { nivel?: LogNivel; mensagem?: string } = {},
) {
  const telefone = detalhes.telefone || detalhes.cliente_telefone || detalhes.to;
  const ficha = detalhes.ficha_id || detalhes.fichaId;
  const partes: string[] = [`[chat] ${acao}`];
  if (telefone) partes.push(String(telefone));
  if (ficha) partes.push(`ficha=${ficha}`);
  const mensagem = options.mensagem || partes.join(" • ");

  logSystemEvent({
    nivel: options.nivel || "info",
    categoria: "chat",
    mensagem,
    ficha_id: ficha ?? null,
    cliente_telefone: telefone ?? null,
    // Eventos do chat NÃO devem ser deduplicados — operadores diferentes podem
    // executar a mesma ação em conversas diferentes na mesma janela de tempo.
    skipDedup: true,
    detalhes: { acao, ...detalhes },
  });
}

export function initSystemLogger() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // 1) console.error / console.warn
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: any[]) => {
    try {
      const msg = args
        .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : safeStringify(a)))
        .join(" ");
      if (!shouldIgnore(msg)) {
        logSystemEvent({
          nivel: "error",
          categoria: "console",
          mensagem: truncate(msg, 1500),
        });
      }
    } catch {}
    origError(...args);
  };

  console.warn = (...args: any[]) => {
    try {
      const msg = args.map((a) => safeStringify(a)).join(" ");
      if (!shouldIgnore(msg)) {
        logSystemEvent({
          nivel: "warn",
          categoria: "console",
          mensagem: truncate(msg, 1500),
        });
      }
    } catch {}
    origWarn(...args);
  };

  // 2) erros JS não tratados
  window.addEventListener("error", (event) => {
    const msg = event.message || "Erro desconhecido";
    logSystemEvent({
      nivel: "error",
      categoria: "unhandled",
      mensagem: truncate(msg, 1500),
      detalhes: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack ?? null,
      },
    });
  });

  // 3) promises rejeitadas
  window.addEventListener("unhandledrejection", (event) => {
    const reason: any = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
        ? reason
        : safeStringify(reason);
    logSystemEvent({
      nivel: "error",
      categoria: "unhandled",
      mensagem: truncate(`Unhandled promise: ${msg}`, 1500),
      detalhes: {
        stack: reason?.stack ?? null,
      },
    });
  });

  // 4) fetch — captura falhas e respostas >= 500
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const start = Date.now();
    const url = typeof input === "string" ? input : (input as any).url ?? String(input);
    try {
      const res = await origFetch(input as any, init);
      const dur = Date.now() - start;
      // Não logar requisições à própria tabela de logs (evita loop)
      if (!url.includes("/system_logs") && res.status >= 500) {
        logSystemEvent({
          nivel: "error",
          categoria: "network",
          mensagem: `HTTP ${res.status} ${res.statusText} — ${shortenUrl(url)}`,
          detalhes: { url, status: res.status, method: init?.method ?? "GET", duration_ms: dur },
        });
      } else if (!url.includes("/system_logs") && res.status === 401) {
        logSystemEvent({
          nivel: "warn",
          categoria: "network",
          mensagem: `HTTP 401 — ${shortenUrl(url)}`,
          detalhes: { url, status: 401, method: init?.method ?? "GET", duration_ms: dur },
        });
      }
      return res;
    } catch (err: any) {
      const dur = Date.now() - start;
      if (!url.includes("/system_logs")) {
        logSystemEvent({
          nivel: "error",
          categoria: "network",
          mensagem: `Falha de rede — ${shortenUrl(url)}: ${err?.message ?? err}`,
          detalhes: {
            url,
            method: init?.method ?? "GET",
            duration_ms: dur,
            error: err?.message ?? String(err),
          },
        });
      }
      throw err;
    }
  };

  // 5) flush ao sair da página
  window.addEventListener("beforeunload", () => {
    if (buffer.length > 0) void flushBuffer();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && buffer.length > 0) {
      void flushBuffer();
    }
  });
}

function safeStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function shortenUrl(u: string) {
  try {
    const url = new URL(u, window.location.origin);
    return url.pathname + (url.search ? url.search.slice(0, 80) : "");
  } catch {
    return u.slice(0, 200);
  }
}

// Filtros de ruído (warnings conhecidos do React Router etc.)
const IGNORE_PATTERNS = [
  /React Router Future Flag Warning/i,
  /Unknown message type: RESET_BLANK_CHECK/i,
  /React DevTools/i,
];

function shouldIgnore(msg: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(msg));
}
