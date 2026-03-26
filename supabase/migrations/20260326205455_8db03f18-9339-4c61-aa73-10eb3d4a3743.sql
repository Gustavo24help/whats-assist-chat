ALTER TABLE fichas_de_servico
  ADD COLUMN IF NOT EXISTS recibo_enviado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recibo_enviado_em timestamptz;