-- Fix function security issue with CASCADE
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_fichas_de_servico_updated_at
  BEFORE UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();