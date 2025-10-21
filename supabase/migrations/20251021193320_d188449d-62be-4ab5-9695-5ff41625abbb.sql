-- Adicionar campos faltantes na tabela fichas_de_servico
ALTER TABLE public.fichas_de_servico
ADD COLUMN IF NOT EXISTS nome_ficha TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS categoria_id INTEGER,
ADD COLUMN IF NOT EXISTS id_zoho TEXT;

-- Adicionar campos faltantes na tabela orcamentos
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS cpf_prestador TEXT,
ADD COLUMN IF NOT EXISTS valor_mao_obra NUMERIC,
ADD COLUMN IF NOT EXISTS valor_pecas NUMERIC,
ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Adicionar campos faltantes na tabela prestadores
ALTER TABLE public.prestadores
ADD COLUMN IF NOT EXISTS id_azure TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS id_crm TEXT;

-- Criar tabela de categorias caso precise no futuro
CREATE TABLE IF NOT EXISTS public.categorias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela categorias
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias
CREATE POLICY "Atendentes podem ver todas as categorias" 
ON public.categorias 
FOR SELECT 
USING (true);

CREATE POLICY "Atendentes podem inserir categorias" 
ON public.categorias 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar categorias" 
ON public.categorias 
FOR UPDATE 
USING (true);