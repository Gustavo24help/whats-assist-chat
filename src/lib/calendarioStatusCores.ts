// Gerenciamento de cores customizáveis dos status do Calendário.
// Persiste preferências em localStorage sem alterar dados do banco.
// Mantém compatibilidade total: se não houver override, usa a cor padrão.

export const STATUS_CORES_STORAGE_KEY = "calendario:status_cores_v1";

export const CORES_PADRAO_STATUS: Record<string, string> = {
  Agendado: "#10B981",
  "Visita Técnica": "#FBBF24",
  Retorno: "#F97316",
  "Em andamento": "#3B82F6",
  Finalizado: "#6B7280",
  Garantia: "#A855F7",
};

export type CoresStatusMap = Record<string, string>;

export function carregarCoresStatus(): CoresStatusMap {
  try {
    const raw = localStorage.getItem(STATUS_CORES_STORAGE_KEY);
    if (!raw) return { ...CORES_PADRAO_STATUS };
    const parsed = JSON.parse(raw);
    return { ...CORES_PADRAO_STATUS, ...(parsed || {}) };
  } catch {
    return { ...CORES_PADRAO_STATUS };
  }
}

export function salvarCoresStatus(map: CoresStatusMap) {
  try {
    localStorage.setItem(STATUS_CORES_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("calendario:cores-atualizadas", { detail: map }));
  } catch (e) {
    console.error("Erro ao salvar cores do calendário", e);
  }
}

export function resetarCoresStatus() {
  salvarCoresStatus({ ...CORES_PADRAO_STATUS });
}
