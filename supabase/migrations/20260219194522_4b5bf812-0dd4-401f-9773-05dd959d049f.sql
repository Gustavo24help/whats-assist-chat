
-- Tabela avaliacao_prestador (espelhada no nps_respostas)
CREATE TABLE public.avaliacao_prestador (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id text NOT NULL,
  telefone_cliente text NOT NULL,
  prestador_id text,
  nota integer,
  classificacao text,
  feedback text,
  tipo_feedback text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  feedback_respondido_em timestamptz,
  prioridade boolean DEFAULT false,
  supervisor_alertado boolean DEFAULT false,
  operador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.avaliacao_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver todas avaliacoes prestador"
  ON public.avaliacao_prestador FOR SELECT USING (true);

CREATE POLICY "Atendentes podem inserir avaliacoes prestador"
  ON public.avaliacao_prestador FOR INSERT WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar avaliacoes prestador"
  ON public.avaliacao_prestador FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.avaliacao_prestador;
