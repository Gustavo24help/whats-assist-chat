export const DADOS_CONVERSAO = {
  urgente: { conversao: 0.44, base: 'Cliente com urgência' },
  explorador: { conversao: 0.26, base: 'Cliente explorando' },
  desconfiado: { conversao: 0.27, base: 'Cliente com objeção' },
  decidido: { conversao: 0.70, base: 'Cliente muito engajado' },
  sensivel_preco: { conversao: 0.27, base: 'Sensível a preço' },
  normal: { conversao: 0.27, base: 'Cliente normal' }
} as const;

export const PONTOS_CRITICOS = {
  tpr_30min: { bom: 0.41, ruim: 0.30, label: 'Tempo até orçamento' },
  multiplos_orcamentos: {
    '1': 0.24,
    '2': 0.39,
    '3': 0.46,
    label: 'Múltiplos orçamentos'
  },
  ultima_msg_cliente: {
    sim: 0.446,
    nao: 0.25,
    label: 'Última msg do cliente'
  },
  resposta_pos_orc: {
    '0-5min': 0.488,
    '6-15min': 0.362,
    '1-4h': 0.242,
    '4h+': 0.109,
    label: 'Resposta após orçamento'
  }
} as const;

export const PALAVRAS_URGENCIA = [
  'urgente', 'hoje', 'agora', 'já', 'preciso',
  'sem luz', 'sem água', 'sem porta', 'queimado',
  'rompeu', 'vazamento', 'inundação'
];

export const PERFIS_CLIENTE = {
  urgente: 'Cliente com urgência (alta prioridade)',
  explorador: 'Cliente explorando opções',
  desconfiado: 'Cliente com objeções/desconfiança',
  decidido: 'Cliente muito engajado/decidido',
  sensivel_preco: 'Cliente sensível a preço',
  normal: 'Cliente normal'
} as const;
