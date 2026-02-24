
-- Tabela de avisos
CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  imagem_url text,
  criado_por uuid REFERENCES auth.users(id),
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver avisos"
  ON public.avisos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins podem criar avisos"
  ON public.avisos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela de leituras
CREATE TABLE public.aviso_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aviso_id, user_id)
);

ALTER TABLE public.aviso_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver suas leituras"
  ON public.aviso_leituras FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios podem marcar como lido"
  ON public.aviso_leituras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Bucket para imagens de avisos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avisos-images', 'avisos-images', true);

-- Qualquer autenticado pode ver imagens de avisos
CREATE POLICY "Autenticados podem ver imagens de avisos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avisos-images');

-- Apenas admins podem fazer upload
CREATE POLICY "Admins podem fazer upload de imagens de avisos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avisos-images' AND public.has_role(auth.uid(), 'admin'));

-- Admins podem deletar imagens
CREATE POLICY "Admins podem deletar imagens de avisos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avisos-images' AND public.has_role(auth.uid(), 'admin'));
