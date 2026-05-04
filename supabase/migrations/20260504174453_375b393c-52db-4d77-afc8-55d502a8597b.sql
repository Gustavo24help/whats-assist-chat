
-- Trigger BEFORE INSERT/UPDATE em fichas_de_servico para garantir nome_cliente preenchido
CREATE OR REPLACE FUNCTION public.ensure_nome_cliente_preenchido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  -- Se nome_cliente vazio, tentar buscar da tabela clientes
  IF NEW.nome_cliente IS NULL OR btrim(NEW.nome_cliente) = '' THEN
    IF NEW.telefone_cliente IS NOT NULL THEN
      SELECT NULLIF(btrim(nome), '') INTO v_nome
      FROM public.clientes
      WHERE telefone = NEW.telefone_cliente
      LIMIT 1;
    END IF;

    -- Fallback final: nunca deixar vazio (Zoho exige Last_Name)
    NEW.nome_cliente := COALESCE(v_nome, 'Cliente');

    -- Log defensivo (não falha se logger der problema)
    BEGIN
      INSERT INTO public.system_logs (nivel, categoria, mensagem, detalhes, url)
      VALUES (
        'warn',
        'data_integrity',
        'nome_cliente vazio preenchido automaticamente na ficha ' || COALESCE(NEW.id, '(novo)'),
        jsonb_build_object(
          'ficha_id', NEW.id,
          'telefone_cliente', NEW.telefone_cliente,
          'nome_aplicado', NEW.nome_cliente,
          'origem', 'trigger ensure_nome_cliente_preenchido',
          'op', TG_OP
        ),
        'trigger://ensure_nome_cliente_preenchido'
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_nome_cliente_preenchido ON public.fichas_de_servico;
CREATE TRIGGER trg_ensure_nome_cliente_preenchido
BEFORE INSERT OR UPDATE OF nome_cliente, telefone_cliente
ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.ensure_nome_cliente_preenchido();

-- View para alerta no app: fichas recentes sem nome real (24h)
-- Usamos função simples ao invés de view para parametrizar
CREATE OR REPLACE FUNCTION public.fichas_sem_nome_cliente_recentes()
RETURNS TABLE (
  id text,
  nome_ficha text,
  telefone_cliente text,
  nome_cliente text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.nome_ficha, f.telefone_cliente, f.nome_cliente, f.status::text, f.created_at
  FROM public.fichas_de_servico f
  WHERE f.created_at >= now() - interval '24 hours'
    AND (f.nome_cliente IS NULL OR btrim(f.nome_cliente) = '' OR f.nome_cliente = 'Cliente')
  ORDER BY f.created_at DESC
  LIMIT 100;
$$;
