-- Criar tabela para armazenar dados de NPS
CREATE TABLE public.nps_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id TEXT NOT NULL,
  telefone_cliente TEXT NOT NULL,
  prestador_id TEXT,
  nota INTEGER CHECK (nota >= 0 AND nota <= 10),
  classificacao TEXT CHECK (classificacao IN ('promotor', 'neutro', 'detrator')),
  feedback TEXT,
  tipo_feedback TEXT CHECK (tipo_feedback IN ('positivo', 'neutro', 'negativo')),
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  respondido_em TIMESTAMP WITH TIME ZONE,
  feedback_respondido_em TIMESTAMP WITH TIME ZONE,
  prioridade BOOLEAN DEFAULT false,
  supervisor_alertado BOOLEAN DEFAULT false,
  operador_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Atendentes podem ver todos os NPS" 
ON public.nps_respostas 
FOR SELECT 
USING (true);

CREATE POLICY "Atendentes podem inserir NPS" 
ON public.nps_respostas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar NPS" 
ON public.nps_respostas 
FOR UPDATE 
USING (true);

-- Índices para performance
CREATE INDEX idx_nps_ficha ON public.nps_respostas(ficha_id);
CREATE INDEX idx_nps_telefone ON public.nps_respostas(telefone_cliente);
CREATE INDEX idx_nps_prestador ON public.nps_respostas(prestador_id);
CREATE INDEX idx_nps_data ON public.nps_respostas(enviado_em);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.nps_respostas;