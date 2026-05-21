
CREATE TABLE IF NOT EXISTS public.analise_operacional_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_analise date NOT NULL,
  cliente_telefone text NOT NULL,
  ficha_id uuid,
  fase text,
  operador_principal text,
  total_msgs_cliente integer DEFAULT 0,
  total_msgs_atendente integer DEFAULT 0,
  tempo_primeira_resposta_min numeric,
  tempo_resposta_medio_min numeric,
  tempo_em_fase_horas numeric,
  lacuna_sem_resposta boolean DEFAULT false,
  lacuna_sem_janela_horario boolean DEFAULT false,
  lacuna_orcamento_pendente boolean DEFAULT false,
  lacuna_problema_servico boolean DEFAULT false,
  lacuna_sem_followup boolean DEFAULT false,
  lacuna_detalhes jsonb DEFAULT '[]'::jsonb,
  ia_resumo text,
  ia_tom text,
  ia_qualidade_ortografica integer,
  ia_insatisfacao_detectada boolean DEFAULT false,
  ia_momento_critico text,
  ia_sugestao text,
  tokens_usados integer DEFAULT 0,
  processado_em timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analise_op_diaria_unique UNIQUE (data_analise, cliente_telefone)
);

CREATE INDEX IF NOT EXISTS idx_aod_data ON public.analise_operacional_diaria(data_analise DESC);
CREATE INDEX IF NOT EXISTS idx_aod_ficha ON public.analise_operacional_diaria(ficha_id);
CREATE INDEX IF NOT EXISTS idx_aod_operador ON public.analise_operacional_diaria(operador_principal);

ALTER TABLE public.analise_operacional_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler analise diaria"
  ON public.analise_operacional_diaria
  FOR SELECT
  TO authenticated
  USING (true);
