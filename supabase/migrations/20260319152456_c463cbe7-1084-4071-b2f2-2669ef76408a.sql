
ALTER TABLE public.fichas_de_servico
  ADD COLUMN IF NOT EXISTS tipo_desconto_mao_obra text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS desconto_valor_mao_obra numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS desconto_percentual_mao_obra numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_final_mao_obra numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_desconto_pecas text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS desconto_valor_pecas numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS desconto_percentual_pecas numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_final_pecas numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_antes_arredondamento numeric DEFAULT NULL;
