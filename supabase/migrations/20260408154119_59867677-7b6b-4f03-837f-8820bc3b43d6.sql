-- Add provider time window columns to fichas_de_servico
ALTER TABLE public.fichas_de_servico
  ADD COLUMN IF NOT EXISTS hora_inicio_prestador_agendamento time without time zone,
  ADD COLUMN IF NOT EXISTS hora_fim_prestador_agendamento time without time zone,
  ADD COLUMN IF NOT EXISTS hora_inicio_prestador_retorno time without time zone,
  ADD COLUMN IF NOT EXISTS hora_fim_prestador_retorno time without time zone;