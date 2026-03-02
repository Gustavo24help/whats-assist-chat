ALTER TABLE public.fichas_de_servico
ADD COLUMN IF NOT EXISTS comparecimento_prestador TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fichas_de_servico_comparecimento_prestador_check'
  ) THEN
    ALTER TABLE public.fichas_de_servico
    ADD CONSTRAINT fichas_de_servico_comparecimento_prestador_check
    CHECK (
      comparecimento_prestador IS NULL OR
      comparecimento_prestador IN (
        'Foi',
        'Atrasou',
        'Atrasou e avisou',
        'Não foi',
        'Não foi e avisou'
      )
    );
  END IF;
END $$;
