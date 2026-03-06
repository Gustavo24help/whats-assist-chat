
DROP TRIGGER IF EXISTS on_orcamento_created ON public.orcamentos;

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
  SELECT COALESCE(nome_ficha, id) INTO _ficha_nome
  FROM fichas_de_servico WHERE id = NEW.ficha_nome;

  SELECT nome INTO _prestador_nome
  FROM prestadores WHERE cpf = NEW.prestador_cpf;

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

CREATE TRIGGER on_orcamento_created
  AFTER INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_orcamento_created();
