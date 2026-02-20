export const mockData = {
  hero: {
    receita: { current: 10543, previous: 7856, change: 34.2, target: 16200 },
    lucro: { current: 3200, previous: 2500, change: 28.0, margin: 30.4, target: 5000 },
    servicos: { current: 30, previous: 43, change: -30.2, target: 40 },
  },

  funnel: [
    { label: 'Cliques Anúncios', value: 450, change: 25.3, icon: '🎯', color: 'green' as const },
    { label: 'Conversas Iniciadas', value: 284, change: 43.4, icon: '💬', color: 'blue' as const },
    { label: 'FS Criadas', value: 199, change: 39.2, icon: '📋', color: 'purple' as const },
    { label: 'Serviços Agendados', value: 37, change: 250, icon: '📅', color: 'orange' as const },
    { label: 'Serviços Executados', value: 33, change: 12.5, icon: '✅', color: 'cyan' as const },
    { label: 'Pagos', value: 30, change: -30.2, icon: '💰', color: 'emerald' as const },
  ],

  taxasConversao: [
    { label: 'Agendados / FS Criadas', valor: 18.6, calculo: '37 / 199', meta: 25, status: 'warning' as const },
    { label: 'Pagos / FS Criadas', valor: 15.1, calculo: '30 / 199', meta: 20, status: 'danger' as const },
    { label: 'Pagos / Agendados', valor: 81.1, calculo: '30 / 37', meta: 85, status: 'success' as const },
    { label: 'Pagos / Cliques', valor: 6.7, calculo: '30 / 450', meta: 10, status: 'warning' as const },
    { label: 'Conversas / Cliques', valor: 63.1, calculo: '284 / 450', meta: 60, status: 'success' as const },
    { label: 'Executados / Agendados', valor: 89.2, calculo: '33 / 37', meta: 90, status: 'success' as const },
  ],

  metrics: {
    tempoResposta: { value: 45, target: 60, status: 'success' as const, unit: 'min', label: 'Tempo Resposta 24help', icon: '⚡' },
    tempoOrcamento: { value: 135, target: 120, status: 'danger' as const, unit: 'min', label: 'Tempo Receb. Orçamento', icon: '🎯' },
    engagement: { value: 78, target: 70, status: 'success' as const, unit: '%', label: 'Engajamento', icon: '💬' },
    fsAgendado: { value: 1.5, change: -12, unit: 'dias', label: 'FS Criada → Agendado', icon: '📅', status: 'success' as const, target: 2 },
    agendadoExecutado: { value: 3.2, change: 5, unit: 'dias', label: 'Agendado → Executado', icon: '🔄', status: 'warning' as const, target: 3 },
    cicloCompleto: { value: 5.2, change: -8, unit: 'dias', label: 'Ciclo Completo', icon: '🏁', status: 'success' as const, target: 7 },
  },

  sparklineData: {
    receita: [
      { value: 5200 }, { value: 6100 }, { value: 5800 }, { value: 7200 },
      { value: 8400 }, { value: 7856 }, { value: 9200 }, { value: 10543 },
    ],
    lucro: [
      { value: 1500 }, { value: 1800 }, { value: 2100 }, { value: 1900 },
      { value: 2300 }, { value: 2500 }, { value: 2800 }, { value: 3200 },
    ],
    servicos: [
      { value: 35 }, { value: 40 }, { value: 38 }, { value: 42 },
      { value: 45 }, { value: 43 }, { value: 36 }, { value: 30 },
    ],
  },

  ticker: [
    '🔥 3 orçamentos pendentes >2h',
    '🎯 Próxima meta: R$2.500',
    '⚡ Top: João Silva (R$890)',
    '📊 Progresso: 30/40 meta',
    '🚀 Conversão subiu 12% hoje',
    '⏰ 5 visitas agendadas amanhã',
  ],
};
