-- Add 'Retorno' to the status enum
ALTER TYPE status_ficha_enum ADD VALUE IF NOT EXISTS 'Retorno';

-- Add calendar-related columns to fichas_de_servico
ALTER TABLE fichas_de_servico
ADD COLUMN IF NOT EXISTS tipo_agendamento text,
ADD COLUMN IF NOT EXISTS hora_inicio_agendamento time,
ADD COLUMN IF NOT EXISTS hora_fim_agendamento time,
ADD COLUMN IF NOT EXISTS data_retorno timestamptz,
ADD COLUMN IF NOT EXISTS hora_inicio_retorno time,
ADD COLUMN IF NOT EXISTS hora_fim_retorno time;

-- Validation trigger for tipo_agendamento values
CREATE OR REPLACE FUNCTION public.validate_tipo_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo_agendamento IS NOT NULL AND NEW.tipo_agendamento NOT IN ('servico', 'visita_tecnica', 'retorno') THEN
    RAISE EXCEPTION 'tipo_agendamento must be servico, visita_tecnica, or retorno';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_tipo_agendamento_trigger ON fichas_de_servico;
CREATE TRIGGER validate_tipo_agendamento_trigger
  BEFORE INSERT OR UPDATE ON fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tipo_agendamento();