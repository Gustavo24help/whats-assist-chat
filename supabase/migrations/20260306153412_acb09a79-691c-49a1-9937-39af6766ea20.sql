
-- Create function to notify all authenticated users when orcamento is created
CREATE OR REPLACE FUNCTION public.notify_orcamento_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _ficha_nome text;
  _prestador_nome text;
BEGIN
  -- Get ficha display name
  SELECT COALESCE(nome_ficha, id) INTO _ficha_nome
  FROM fichas_de_servico WHERE id = NEW.ficha_nome;

  -- Get prestador name
  SELECT nome INTO _prestador_nome
  FROM prestadores WHERE cpf = NEW.prestador_cpf;

  -- Notify all users with roles (operators)
  FOR _user_id IN
    SELECT DISTINCT user_id FROM user_roles
  LOOP
    INSERT INTO notificacoes (usuario_destino, tipo, referencia_id, titulo, descricao)
    VALUES (
      _user_id,
      'orcamento',
      NEW.ficha_nome,
      'Novo orçamento recebido',
      COALESCE(_prestador_nome, 'Prestador') || ' enviou orçamento para ' || COALESCE(_ficha_nome, NEW.ficha_nome) ||
      ' - R$ ' || COALESCE(NEW.valor_total::text, '0')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and recreate
DROP TRIGGER IF EXISTS on_orcamento_created ON public.orcamentos;

CREATE TRIGGER on_orcamento_created
  AFTER INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_orcamento_created();
