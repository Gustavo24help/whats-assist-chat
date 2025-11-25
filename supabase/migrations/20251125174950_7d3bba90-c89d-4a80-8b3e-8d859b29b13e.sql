-- Criar tabela de tags com cores
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Atendentes podem ver todas as tags"
  ON public.tags
  FOR SELECT
  USING (true);

CREATE POLICY "Atendentes podem inserir tags"
  ON public.tags
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar tags"
  ON public.tags
  FOR UPDATE
  USING (true);

CREATE POLICY "Atendentes podem deletar tags"
  ON public.tags
  FOR DELETE
  USING (true);

-- Migrar tags existentes dos clientes para a nova tabela
WITH tags_expandidas AS (
  SELECT DISTINCT unnest(tags) as nome
  FROM public.clientes
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
)
INSERT INTO public.tags (nome, cor)
SELECT 
  nome,
  CASE 
    WHEN nome = 'urgente' THEN '#EF4444'
    WHEN nome = 'APOLAR' THEN '#3B82F6'
    ELSE '#6B7280'
  END as cor
FROM tags_expandidas
ON CONFLICT (nome) DO NOTHING;