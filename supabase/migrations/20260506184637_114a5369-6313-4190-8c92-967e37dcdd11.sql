-- Função: cria vínculo cliente↔ficha automaticamente no INSERT da ficha
CREATE OR REPLACE FUNCTION public.auto_vincular_conversa_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age se houver telefone do cliente
  IF NEW.telefone_cliente IS NULL OR btrim(NEW.telefone_cliente) = '' THEN
    RETURN NEW;
  END IF;

  -- Idempotente: não cria se já houver vínculo ativo desse cliente+ficha
  IF EXISTS (
    SELECT 1 FROM public.conversa_ficha_vinculo
    WHERE ficha_id = NEW.id
      AND cliente_telefone = NEW.telefone_cliente
      AND ativo = true
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversa_ficha_vinculo (
    ficha_id, cliente_telefone, vinculado_por, ativo
  ) VALUES (
    NEW.id, NEW.telefone_cliente, 'trigger_auto', true
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebrar a criação da ficha por causa do vínculo
  RAISE LOG '[auto_vincular_conversa_ficha] erro ao vincular ficha %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT em fichas_de_servico
DROP TRIGGER IF EXISTS trg_auto_vincular_conversa_ficha ON public.fichas_de_servico;
CREATE TRIGGER trg_auto_vincular_conversa_ficha
AFTER INSERT ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.auto_vincular_conversa_ficha();