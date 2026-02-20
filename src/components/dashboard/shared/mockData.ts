export const mockData = {
  hero: {
    revenue: { current: 10543, previous: 7856, change: 34.2, target: 16200 },
    profit: { current: 3200, previous: 2500, change: 28.0, margin: 30.4 },
    services: { current: 30, previous: 43, change: -30.2, target: 40 },
  },

  funnel: [
    { label: 'Conversas', value: 284, change: 43.4, icon: '🎯', color: 'green' as const },
    { label: 'FS Criadas', value: 199, change: 39.2, icon: '📋', color: 'blue' as const },
    { label: 'Agendados', value: 37, change: 250, icon: '📅', color: 'purple' as const },
    { label: 'Pagos', value: 30, change: -30.2, icon: '✅', color: 'orange' as const },
  ],

  metrics: {
    responseTime: { value: 45, target: 60, status: 'success' as const, unit: 'min', label: 'Response Time', icon: '⚡' },
    quoteSpeed: { value: 135, target: 120, status: 'danger' as const, unit: 'min', label: 'Quote Speed', icon: '🎯' },
    engagement: { value: 78, target: 70, status: 'success' as const, unit: '%', label: 'Engagement', icon: '💬' },
    leadToSchedule: { value: 1.5, change: -12, unit: 'days', label: 'Lead → Schedule', icon: '📅', status: 'info' as const },
    scheduleToDone: { value: 3.2, change: 5, unit: 'days', label: 'Schedule → Done', icon: '🔄', status: 'warning' as const },
    rescheduleRate: { value: 8, target: 5, status: 'warning' as const, unit: '%', label: 'Reschedule Rate', icon: '🎪' },
  },

  sparklineData: {
    revenue: [
      { value: 5200 }, { value: 6100 }, { value: 5800 }, { value: 7200 },
      { value: 8400 }, { value: 7856 }, { value: 9200 }, { value: 10543 },
    ],
    profit: [
      { value: 1500 }, { value: 1800 }, { value: 2100 }, { value: 1900 },
      { value: 2300 }, { value: 2500 }, { value: 2800 }, { value: 3200 },
    ],
    services: [
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
