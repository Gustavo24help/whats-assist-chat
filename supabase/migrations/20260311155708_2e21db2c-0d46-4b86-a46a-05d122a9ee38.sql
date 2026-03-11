
-- 1. Add banco to prestadores
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS banco text DEFAULT NULL;

-- 2. Add prestador_anterior_id and motivo_troca_prestador to fichas_de_servico
ALTER TABLE public.fichas_de_servico ADD COLUMN IF NOT EXISTS prestador_anterior_id text DEFAULT NULL;
ALTER TABLE public.fichas_de_servico ADD COLUMN IF NOT EXISTS motivo_troca_prestador text DEFAULT NULL;

-- 3. Create prestador_historico table for tracking provider events
CREATE TABLE IF NOT EXISTS public.prestador_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_cpf text NOT NULL,
  ficha_id text,
  tipo_evento text NOT NULL,
  descricao text NOT NULL,
  dados_extras jsonb DEFAULT '{}',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prestador_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver historico prestador" ON public.prestador_historico
  FOR SELECT TO public USING (true);

CREATE POLICY "Atendentes podem inserir historico prestador" ON public.prestador_historico
  FOR INSERT TO public WITH CHECK (true);
