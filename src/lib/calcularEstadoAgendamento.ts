export interface AgendamentoData {
  tipo_agendamento: string | null;
  horario_agendamento: string | null;
  hora_inicio_agendamento: string | null;
  hora_fim_agendamento: string | null;
  data_retorno: string | null;
  hora_inicio_retorno: string | null;
  hora_fim_retorno: string | null;
  status: string | null;
  data_visita_tecnica: string | null;
  horario_visita_tecnica: string | null;
}

export interface EstadoAgendamento {
  estado: 'futuro' | 'alerta' | 'andamento' | 'atrasado' | 'normal';
  cor: string;
  piscar: boolean;
  classe: string;
}

const corPorTipo: Record<string, string> = {
  servico: '#10B981',
  visita_tecnica: '#FBBF24',
  retorno: '#F97316',
};

export function getAgendamentoDates(ag: AgendamentoData): { inicio: Date | null; fim: Date | null } {
  let inicio: Date | null = null;
  let fim: Date | null = null;

  // Inferir tipo real quando tipo_agendamento é null
  let tipo = ag.tipo_agendamento;
  if (!tipo) {
    if (ag.data_retorno) {
      tipo = 'retorno';
    } else if (ag.data_visita_tecnica || ag.horario_visita_tecnica) {
      tipo = 'visita_tecnica';
    } else {
      tipo = 'servico';
    }
  }

  if (tipo === 'retorno') {
    if (!ag.data_retorno) return { inicio: null, fim: null };
    const dataBase = ag.data_retorno.split('T')[0];
    if (ag.hora_inicio_retorno) {
      inicio = new Date(`${dataBase}T${ag.hora_inicio_retorno}`);
    } else {
      inicio = new Date(ag.data_retorno);
    }
    if (ag.hora_fim_retorno) {
      fim = new Date(`${dataBase}T${ag.hora_fim_retorno}`);
    }
  } else if (tipo === 'visita_tecnica') {
    if (ag.horario_visita_tecnica) {
      inicio = new Date(ag.horario_visita_tecnica);
    } else if (ag.data_visita_tecnica) {
      inicio = new Date(`${ag.data_visita_tecnica}T09:00:00`);
    } else if (ag.horario_agendamento) {
      inicio = new Date(ag.horario_agendamento);
    }
    if (!inicio) return { inicio: null, fim: null };
    const dataBase = inicio.toISOString().split('T')[0];
    if (ag.hora_inicio_agendamento) {
      inicio = new Date(`${dataBase}T${ag.hora_inicio_agendamento}`);
    }
    if (ag.hora_fim_agendamento) {
      fim = new Date(`${dataBase}T${ag.hora_fim_agendamento}`);
    }
  } else {
    // servico or default
    if (!ag.horario_agendamento) return { inicio: null, fim: null };
    inicio = new Date(ag.horario_agendamento);
    const dataBase = inicio.toISOString().split('T')[0];
    if (ag.hora_inicio_agendamento) {
      inicio = new Date(`${dataBase}T${ag.hora_inicio_agendamento}`);
    }
    if (ag.hora_fim_agendamento) {
      fim = new Date(`${dataBase}T${ag.hora_fim_agendamento}`);
    }
  }

  return { inicio, fim };
}

export function calcularEstadoAgendamento(ag: AgendamentoData): EstadoAgendamento {
  const tipo = ag.tipo_agendamento || 'servico';
  const corBase = corPorTipo[tipo] || '#10B981';
  const defaultResult: EstadoAgendamento = { estado: 'normal', cor: corBase, piscar: false, classe: '' };

  const { inicio, fim } = getAgendamentoDates(ag);
  if (!inicio) return defaultResult;

  const agora = new Date();
  const duasHorasAntes = new Date(inicio.getTime() - 2 * 60 * 60 * 1000);

  // Futuro
  if (agora < duasHorasAntes) {
    return { estado: 'futuro', cor: corBase, piscar: false, classe: '' };
  }

  // Alerta (2h antes até início)
  if (agora >= duasHorasAntes && agora < inicio) {
    return { estado: 'alerta', cor: corBase, piscar: true, classe: 'agendamento-alerta' };
  }

  // Em andamento
  if (fim && agora >= inicio && agora <= fim) {
    return { estado: 'andamento', cor: '#3B82F6', piscar: false, classe: '' };
  }

  if (!fim && agora >= inicio) {
    const dozeHorasDepois = new Date(inicio.getTime() + 12 * 60 * 60 * 1000);
    if (agora <= dozeHorasDepois) {
      // Check if should be atrasado based on status
      if (!['Finalizado', 'Em andamento'].includes(ag.status || '')) {
        // Still within 12h window, show as in progress
      }
      return { estado: 'andamento', cor: '#3B82F6', piscar: false, classe: '' };
    }
  }

  // Atrasado
  const limiteAtraso = fim ? fim : new Date(inicio.getTime() + 12 * 60 * 60 * 1000);

  if (agora > limiteAtraso && !['Finalizado', 'Em andamento'].includes(ag.status || '')) {
    return { estado: 'atrasado', cor: '#EF4444', piscar: true, classe: 'agendamento-atrasado' };
  }

  return defaultResult;
}

export function getCorTipo(tipo: string | null): string {
  return corPorTipo[tipo || 'servico'] || '#10B981';
}

export function getLabelTipo(tipo: string | null): string {
  switch (tipo) {
    case 'visita_tecnica': return 'Visita Técnica';
    case 'retorno': return 'Retorno';
    default: return 'Serviço';
  }
}
