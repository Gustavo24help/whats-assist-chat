// Sinais detectados do cliente
export interface ClienteSignals {
  urgencia: boolean;
  perguntasTecnicas: number;
  tempoSemResposta: number;
  profileCliente: 'urgente' | 'explorador' | 'desconfiado' | 'decidido' | 'sensivel_preco' | 'normal';
  sinais: string[];
}

// Coaching gerado pela skill
export interface CoachingSuggestion {
  perfil: string;
  conversaoBase: number;
  conversaoMeta: number;
  proximoPassoLabel: string;
  sugestaoMensagem: string;
  checklist: {
    tpr: number;
    multiplosOrcamentos: number;
    ratioClienteOp: number;
    ultimaMsgDoCliente: boolean;
  };
  prioridade: 'maxima' | 'normal';
}

// Dados de leitura por operador
export interface OperadorUnreadData {
  naoLidos: number;
  ultimaLeitura: Date | null;
  outroOpLeuNome: string | null;
  outroOpLeuEm: Date | null;
  outroOpLeuHa: string | null;
}

// Conversa com dados de leitura
export interface ConversaComLeitura {
  clienteTelefone: string;
  clienteNome: string;
  ultima_mensagem: string | null;
  updated_at: string | null;
  naoLidosPorEsteOp: number;
  outroOpLeuNome: string | null;
  outroOpLeuHa: string | null;
  urgencia?: boolean;
}
