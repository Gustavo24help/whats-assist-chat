-- Criar tabela de histórico do bot
CREATE TABLE public.bot_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone_cliente TEXT NOT NULL REFERENCES public.clientes(telefone),
  acao TEXT NOT NULL CHECK (acao IN ('ligado', 'desligado')),
  origem TEXT NOT NULL CHECK (origem IN ('manual', 'automatico', 'sistema')),
  executado_por_id UUID REFERENCES public.profiles(id),
  ficha_id TEXT REFERENCES public.fichas_de_servico(id),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_bot_historico_telefone ON public.bot_historico(telefone_cliente);
CREATE INDEX idx_bot_historico_created_at ON public.bot_historico(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.bot_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Atendentes podem ver histórico do bot"
ON public.bot_historico
FOR SELECT
USING (true);

CREATE POLICY "Sistema pode inserir histórico do bot"
ON public.bot_historico
FOR INSERT
WITH CHECK (true);

-- Adicionar à realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_historico;

COMMENT ON TABLE public.bot_historico IS 'Histórico de ligação/desligamento do bot para cada cliente';