CREATE OR REPLACE FUNCTION public.ensure_nome_cliente_preenchido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
BEGIN
  IF NEW.nome_cliente IS NULL OR btrim(NEW.nome_cliente) = '' THEN
    IF NEW.telefone_cliente IS NOT NULL THEN
      SELECT NULLIF(btrim(nome), '') INTO v_nome
      FROM public.clientes
      WHERE telefone = NEW.telefone_cliente
      LIMIT 1;
    END IF;
    NEW.nome_cliente := COALESCE(v_nome, 'Cliente');
  ELSE
    NEW.nome_cliente := btrim(NEW.nome_cliente);
  END IF;

  -- Zoho exige Last_Name. Make divide por espaço; se só houver 1 palavra, Last_Name fica vazio.
  IF position(' ' in NEW.nome_cliente) = 0 THEN
    NEW.nome_cliente := NEW.nome_cliente || ' (sem sobrenome)';
  END IF;

  RETURN NEW;
END;
$function$;