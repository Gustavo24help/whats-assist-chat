-- Avaliação operacional opcional (1 a 5) vinculada à ficha
CREATE TABLE public.avaliacoes_operacionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id TEXT NOT NULL UNIQUE,
  telefone_cliente TEXT NOT NULL,
  nota INTEGER CHECK (nota BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondida', 'cancelada')),
  enviada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  respondida_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver avaliações operacionais"
ON public.avaliacoes_operacionais
FOR SELECT
USING (true);

CREATE POLICY "Atendentes podem inserir avaliações operacionais"
ON public.avaliacoes_operacionais
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar avaliações operacionais"
ON public.avaliacoes_operacionais
FOR UPDATE
USING (true);

CREATE INDEX idx_avaliacoes_operacionais_telefone_status_data
ON public.avaliacoes_operacionais(telefone_cliente, status, enviada_em DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.avaliacoes_operacionais;
