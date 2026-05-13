
-- Tabela de auditoria das confirmações de reativação manual de bot
CREATE TABLE IF NOT EXISTS public.bot_reactivation_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente text NOT NULL,
  ficha_id text,
  operador_id uuid,
  origem_tela text,
  user_agent text,
  ip_address text,
  modal_aberto_em timestamptz NOT NULL DEFAULT now(),
  texto_digitado text,
  digitado_em timestamptz,
  clicado_em timestamptz,
  resultado text NOT NULL DEFAULT 'pendente',
  consumido boolean NOT NULL DEFAULT false,
  consumido_em timestamptz,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brc_telefone ON public.bot_reactivation_confirmations(telefone_cliente);
CREATE INDEX IF NOT EXISTS idx_brc_operador ON public.bot_reactivation_confirmations(operador_id);
CREATE INDEX IF NOT EXISTS idx_brc_created ON public.bot_reactivation_confirmations(created_at DESC);

ALTER TABLE public.bot_reactivation_confirmations ENABLE ROW LEVEL SECURITY;

-- Apenas authenticated pode ler/inserir/atualizar suas próprias confirmações;
-- service_role (edge function) bypassa RLS automaticamente.
CREATE POLICY "auth pode ler suas confirmacoes"
  ON public.bot_reactivation_confirmations FOR SELECT
  TO authenticated
  USING (operador_id = auth.uid());

CREATE POLICY "auth pode criar suas confirmacoes"
  ON public.bot_reactivation_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (operador_id = auth.uid());

CREATE POLICY "auth pode atualizar suas confirmacoes"
  ON public.bot_reactivation_confirmations FOR UPDATE
  TO authenticated
  USING (operador_id = auth.uid())
  WITH CHECK (operador_id = auth.uid());

-- RPC: cria desafio quando o modal abre
CREATE OR REPLACE FUNCTION public.create_bot_reactivation_challenge(
  _telefone text,
  _ficha_id text DEFAULT NULL,
  _origem_tela text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _telefone IS NULL OR btrim(_telefone) = '' THEN
    RAISE EXCEPTION 'telefone required';
  END IF;

  INSERT INTO public.bot_reactivation_confirmations
    (telefone_cliente, ficha_id, operador_id, origem_tela, user_agent)
  VALUES (_telefone, _ficha_id, v_uid, _origem_tela, _user_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bot_reactivation_challenge(text,text,text,text) TO authenticated;

-- RPC: registra a digitação do operador (cada keystroke pode chamar; guarda último valor + timestamp da primeira vez que ficou == LIGAR)
CREATE OR REPLACE FUNCTION public.record_bot_reactivation_typed(
  _challenge_id uuid,
  _texto text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  UPDATE public.bot_reactivation_confirmations
  SET texto_digitado = _texto,
      digitado_em = CASE
        WHEN upper(btrim(_texto)) = 'LIGAR' AND digitado_em IS NULL THEN now()
        ELSE digitado_em
      END
  WHERE id = _challenge_id
    AND operador_id = v_uid
    AND consumido = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bot_reactivation_typed(uuid,text) TO authenticated;
