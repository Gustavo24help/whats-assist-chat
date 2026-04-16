
-- Table: ficha_grupos
CREATE TABLE public.ficha_grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_principal_id text NOT NULL REFERENCES public.fichas_de_servico(id),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text
);

ALTER TABLE public.ficha_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access ficha_grupos" ON public.ficha_grupos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access ficha_grupos" ON public.ficha_grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: ficha_grupo_membros
CREATE TABLE public.ficha_grupo_membros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES public.ficha_grupos(id) ON DELETE CASCADE,
  ficha_id text NOT NULL REFERENCES public.fichas_de_servico(id),
  papel text NOT NULL DEFAULT 'vinculada',
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  adicionado_por uuid,
  CONSTRAINT ficha_grupo_membros_ficha_unique UNIQUE (ficha_id)
);

ALTER TABLE public.ficha_grupo_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access ficha_grupo_membros" ON public.ficha_grupo_membros FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access ficha_grupo_membros" ON public.ficha_grupo_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ficha_grupo_membros_grupo_id ON public.ficha_grupo_membros(grupo_id);
CREATE INDEX idx_ficha_grupo_membros_ficha_id ON public.ficha_grupo_membros(ficha_id);
CREATE INDEX idx_ficha_grupos_principal ON public.ficha_grupos(ficha_principal_id);
