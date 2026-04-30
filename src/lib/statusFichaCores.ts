// Paleta única de cores por status de ficha — usada em todos os chats
// (atendimento e BETA) e na sidebar de filtros do chat beta.
// Cores definidas conforme padrão visual aprovado (paleta clara/pastel).
//
// Suporta overrides locais (por navegador) via localStorage,
// preservando totalmente o padrão caso o usuário não personalize.

export const STATUS_FICHA_CORES_STORAGE_KEY = "chat:status_ficha_cores_v1";

export const STATUS_FICHA_CORES_HEX_PADRAO: Record<string, string> = {
  "Ficha Criada": "#2563eb",            // azul forte
  "Contato Inicial": "#0ea5e9",         // azul céu
  "Orçamento Enviado": "#06b6d4",       // ciano
  "Negociação": "#f59e0b",              // âmbar
  "Dúvida Prestador": "#facc15",        // amarelo
  "Visita Técnica": "#7c3aed",          // roxo
  "Orçamento Aprovado / Agendamento": "#14b8a6", // teal
  "Agendado": "#6366f1",                // índigo
  "Em andamento": "#f97316",            // laranja
  "Finalizado": "#15803d",              // verde escuro
  "Garantia": "#84cc16",                // lima
  "Retorno": "#a855f7",                 // violeta
  "Orçamento Não Aprovado": "#dc2626",  // vermelho
  "Perdido": "#be123c",                 // rosa escuro
  "Não foi adiante": "#9ca3af",         // cinza claro
  "Sem ficha": "#475569",               // slate escuro
  "pendente": "#64748b",                // slate
};

// Compatibilidade com imports antigos
export const STATUS_FICHA_CORES_HEX: Record<string, string> = { ...STATUS_FICHA_CORES_HEX_PADRAO };

export type StatusFichaCoresMap = Record<string, string>;

let _cache: StatusFichaCoresMap | null = null;

function readOverrides(): StatusFichaCoresMap {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STATUS_FICHA_CORES_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function carregarStatusFichaCores(): StatusFichaCoresMap {
  if (_cache) return _cache;
  _cache = { ...STATUS_FICHA_CORES_HEX_PADRAO, ...readOverrides() };
  return _cache;
}

export function salvarStatusFichaCores(map: StatusFichaCoresMap) {
  try {
    // Salva apenas overrides em relação ao padrão para manter compatibilidade
    const overrides: StatusFichaCoresMap = {};
    Object.entries(map).forEach(([k, v]) => {
      if (v && v.toLowerCase() !== (STATUS_FICHA_CORES_HEX_PADRAO[k] || "").toLowerCase()) {
        overrides[k] = v;
      }
    });
    localStorage.setItem(STATUS_FICHA_CORES_STORAGE_KEY, JSON.stringify(overrides));
    _cache = { ...STATUS_FICHA_CORES_HEX_PADRAO, ...overrides };
    window.dispatchEvent(new CustomEvent("chat:status-ficha-cores:changed", { detail: _cache }));
  } catch (e) {
    console.error("Erro ao salvar cores de status:", e);
  }
}

export function resetarStatusFichaCores() {
  try {
    localStorage.removeItem(STATUS_FICHA_CORES_STORAGE_KEY);
    _cache = { ...STATUS_FICHA_CORES_HEX_PADRAO };
    window.dispatchEvent(new CustomEvent("chat:status-ficha-cores:changed", { detail: _cache }));
  } catch (e) {
    console.error("Erro ao resetar cores de status:", e);
  }
}

// Invalida cache quando outra aba/local altera as preferências
if (typeof window !== "undefined") {
  window.addEventListener("chat:status-ficha-cores:changed", () => {
    _cache = null;
  });
  window.addEventListener("storage", (e) => {
    if (e.key === STATUS_FICHA_CORES_STORAGE_KEY) _cache = null;
  });
}

export const getStatusFichaHex = (status?: string | null): string => {
  if (!status) return "#9ca3af";
  const map = carregarStatusFichaCores();
  return map[status] || "#9ca3af";
};
