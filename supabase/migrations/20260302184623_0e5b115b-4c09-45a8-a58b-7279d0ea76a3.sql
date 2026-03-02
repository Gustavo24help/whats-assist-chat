
-- Criar tabela tv_layouts para persistir configurações de layout da TV
CREATE TABLE public.tv_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL DEFAULT 'default',
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tv_layouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuários autenticados CRUD nos próprios layouts
CREATE POLICY "Users can view own layouts"
  ON public.tv_layouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layouts"
  ON public.tv_layouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own layouts"
  ON public.tv_layouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own layouts"
  ON public.tv_layouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_tv_layouts_updated_at
  BEFORE UPDATE ON public.tv_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida do layout default do usuário
CREATE INDEX idx_tv_layouts_user_default ON public.tv_layouts (user_id, is_default);

-- Garantir que dashboard_metas.tipo seja UNIQUE para upsert funcionar
ALTER TABLE public.dashboard_metas ADD CONSTRAINT dashboard_metas_tipo_unique UNIQUE (tipo);
