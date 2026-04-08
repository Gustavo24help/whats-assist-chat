
-- Create registro_ponto table
CREATE TABLE public.registro_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entrada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  entrada_oficial TIMESTAMPTZ,
  saida_em TIMESTAMPTZ,
  tipo TEXT NOT NULL DEFAULT 'normal',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create configuracao_ponto table
CREATE TABLE public.configuracao_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  carga_diaria_minutos INTEGER NOT NULL DEFAULT 480,
  hora_inicio_prevista TIME NOT NULL DEFAULT '08:00',
  hora_fim_prevista TIME NOT NULL DEFAULT '17:00',
  saldo_inicial_minutos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registro_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_ponto ENABLE ROW LEVEL SECURITY;

-- RLS policies for registro_ponto
CREATE POLICY "Users can view own ponto records"
  ON public.registro_ponto FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ponto records"
  ON public.registro_ponto FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own ponto records"
  ON public.registro_ponto FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ponto records"
  ON public.registro_ponto FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for configuracao_ponto
CREATE POLICY "Users can view own config"
  ON public.configuracao_ponto FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all configs"
  ON public.configuracao_ponto FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own config"
  ON public.configuracao_ponto FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON public.configuracao_ponto FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on configuracao_ponto
CREATE TRIGGER update_configuracao_ponto_updated_at
  BEFORE UPDATE ON public.configuracao_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_registro_ponto_user_entrada ON public.registro_ponto (user_id, entrada_em DESC);
