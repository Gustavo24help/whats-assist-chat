/**
 * Centralized provider time window calculation.
 * 
 * The provider window always starts at the same time as the client window.
 * The duration is reduced according to a lookup table.
 * 
 * Rule: client duration → provider duration
 *   30min → 30min
 *   1h   → 30min
 *   1h30 → 1h
 *   2h   → 1h
 *   2h30 → 1h30
 *   3h   → 2h
 *   3h30 → 2h30
 *   4h   → 3h
 * 
 * For durations > 4h, we subtract 1h from client duration.
 * Times must always end in :00 or :30.
 */

/** Duration mapping in minutes: clientMinutes → providerMinutes */
const DURATION_MAP: Record<number, number> = {
  30: 30,
  60: 30,
  90: 60,
  120: 60,
  150: 90,
  180: 120,
  210: 150,
  240: 180,
};

/**
 * Calculate provider window duration in minutes from client window duration in minutes.
 */
export function calcularDuracaoPrestador(clienteDuracaoMin: number): number {
  if (DURATION_MAP[clienteDuracaoMin] !== undefined) {
    return DURATION_MAP[clienteDuracaoMin];
  }
  // For durations > 4h, subtract 1h
  if (clienteDuracaoMin > 240) {
    return clienteDuracaoMin - 60;
  }
  // For unexpected values, round to nearest 30min slot and lookup
  const rounded = Math.round(clienteDuracaoMin / 30) * 30;
  if (DURATION_MAP[rounded] !== undefined) {
    return DURATION_MAP[rounded];
  }
  return Math.max(30, clienteDuracaoMin - 60);
}

/**
 * Given client start/end time strings (HH:mm or HH:mm:ss), calculate provider start/end.
 * Returns null if inputs are invalid.
 */
export function calcularJanelaPrestador(
  clienteInicio: string,
  clienteFim: string
): { inicio: string; fim: string } | null {
  if (!clienteInicio || !clienteFim) return null;

  const parseTime = (t: string): number => {
    const parts = t.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };

  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const inicioMin = parseTime(clienteInicio);
  const fimMin = parseTime(clienteFim);

  if (fimMin <= inicioMin) return null;

  const clienteDuracao = fimMin - inicioMin;
  const prestadorDuracao = calcularDuracaoPrestador(clienteDuracao);

  return {
    inicio: formatTime(inicioMin),
    fim: formatTime(inicioMin + prestadorDuracao),
  };
}

/**
 * Context type for determining which time window to show.
 */
export type HorarioContexto = 'cliente' | 'prestador' | 'ambos';

/**
 * Get the appropriate time window for a ficha based on context.
 * Returns { inicio, fim } strings or null values.
 * 
 * For 'cliente': returns client window (hora_inicio_agendamento / hora_fim_agendamento)
 * For 'prestador': returns provider window (hora_inicio_prestador_agendamento / hora_fim_prestador_agendamento)
 * For 'ambos': returns both windows
 */
export function getJanelaHorario(
  ficha: any,
  contexto: HorarioContexto,
  tipoOverride?: string
) {
  const tipo = tipoOverride || ficha.tipo_agendamento || inferirTipoAgendamento(ficha);

  const isRetorno = tipo === 'retorno';

  const clienteInicio = isRetorno ? ficha.hora_inicio_retorno : ficha.hora_inicio_agendamento;
  const clienteFim = isRetorno ? ficha.hora_fim_retorno : ficha.hora_fim_agendamento;
  const prestadorInicio = isRetorno ? ficha.hora_inicio_prestador_retorno : ficha.hora_inicio_prestador_agendamento;
  const prestadorFim = isRetorno ? ficha.hora_fim_prestador_retorno : ficha.hora_fim_prestador_agendamento;

  if (contexto === 'cliente') {
    return {
      inicio: clienteInicio || null,
      fim: clienteFim || null,
    };
  }

  if (contexto === 'prestador') {
    return {
      inicio: prestadorInicio || clienteInicio || null,
      fim: prestadorFim || clienteFim || null,
    };
  }

  // ambos
  return {
    cliente: { inicio: clienteInicio || null, fim: clienteFim || null },
    prestador: { inicio: prestadorInicio || clienteInicio || null, fim: prestadorFim || clienteFim || null },
  };
}

/**
 * Infer appointment type from ficha data when tipo_agendamento is null.
 */
export function inferirTipoAgendamento(ficha: any): string {
  if (ficha.data_retorno) return 'retorno';
  if (ficha.data_visita_tecnica || ficha.horario_visita_tecnica) return 'visita_tecnica';
  return 'servico';
}

/**
 * Format a time window as a display string like "08:00 - 09:00"
 */
export function formatJanela(inicio: string | null, fim: string | null): string {
  if (!inicio) return '';
  const i = inicio.slice(0, 5);
  if (!fim) return i;
  return `${i} - ${fim.slice(0, 5)}`;
}
