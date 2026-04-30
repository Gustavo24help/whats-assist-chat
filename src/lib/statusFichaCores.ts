// Paleta única de cores por status de ficha — usada em todos os chats
// (atendimento e BETA) e na sidebar de filtros do chat beta.
// Cores definidas conforme padrão visual aprovado (paleta clara/pastel).

export const STATUS_FICHA_CORES_HEX: Record<string, string> = {
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

export const getStatusFichaHex = (status?: string | null): string => {
  if (!status) return "#9ca3af";
  return STATUS_FICHA_CORES_HEX[status] || "#9ca3af";
};
