-- Função: promove automaticamente o status de "Ficha Criada" para "Orçamento Enviado"
-- quando o valor_total for preenchido (> 0). Funciona em INSERT e UPDATE,
-- garantindo consistência mesmo quando a ficha é alterada por edge functions,
-- webhooks externos ou outras vias além do app.
CREATE OR REPLACE FUNCTION public.auto_promote_status_on_valor_manual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age quando há valor_total > 0 e status é "Ficha Criada"
  IF NEW.status = 'Ficha Criada'
     AND NEW.valor_total IS NOT NULL
     AND NEW.valor_total > 0 THEN

    -- Em UPDATE: só promove se houve mudança real (valor passou a > 0
    -- ou status acabou de virar "Ficha Criada" com valor já > 0).
    IF TG_OP = 'INSERT'
       OR COALESCE(OLD.valor_total, 0) <= 0
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.status := 'Orçamento Enviado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE para garantir que a regra rode
-- antes dos demais triggers que dependem de NEW.status (ex.: registrar mudança).
DROP TRIGGER IF EXISTS trg_auto_promote_status_on_valor_manual ON public.fichas_de_servico;

CREATE TRIGGER trg_auto_promote_status_on_valor_manual
BEFORE INSERT OR UPDATE OF valor_total, status ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_status_on_valor_manual();