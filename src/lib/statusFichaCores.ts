// Paleta única de cores por status de ficha — usada em todos os chats
// (atendimento e BETA) e na sidebar de filtros do chat beta.
// Cores definidas conforme padrão visual aprovado (paleta clara/pastel).

export const STATUS_FICHA_CORES_HEX: Record<string, string> = {
  "Ficha Criada": "#60a5fa",            // azul claro
  "Orçamento Enviado": "#22d3ee",       // ciano
  "Agendado": "#818cf8",                // violeta claro
  "Finalizado": "#15803d",              // verde escuro
  "Garantia": "#e879f9",                // magenta claro
  "Retorno": "#5eead4",                 // teal claro
  "Perdido": "#f87171",                 // vermelho coral
  "Não foi adiante": "#9ca3af",         // cinza claro
  "Sem ficha": "#64748b",               // slate
  "Visita Técnica": "#475569",          // slate escuro
  "Contato Inicial": "#475569",         // slate escuro
  "Em andamento": "#f97316",            // laranja
  "pendente": "#64748b",                // slate
  // Mantém compatibilidade com status menos frequentes
  "Dúvida Prestador": "#eab308",
  "Negociação": "#f97316",
  "Orçamento Aprovado / Agendamento": "#14b8a6",
  "Orçamento Não Aprovado": "#ef4444",
};

export const getStatusFichaHex = (status?: string | null): string => {
  if (!status) return "#9ca3af";
  return STATUS_FICHA_CORES_HEX[status] || "#9ca3af";
};
