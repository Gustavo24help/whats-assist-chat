
-- 1. Tabela de leitura por operador individual
CREATE TABLE public.mensagem_leitura_operador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_telefone, user_id)
);

ALTER TABLE public.mensagem_leitura_operador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own read status"
  ON public.mensagem_leitura_operador FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own read status"
  ON public.mensagem_leitura_operador FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own read status"
  ON public.mensagem_leitura_operador FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- 2. Tabela de tarefas operacionais
CREATE TABLE public.tarefas_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  urgencia TEXT NOT NULL DEFAULT 'media',
  criado_por UUID,
  ficha_id TEXT,
  cliente_telefone TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  prazo TIMESTAMPTZ,
  tolerancia_aviso_minutos INTEGER DEFAULT 0,
  ultimo_aviso_em TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  resolvido_nota TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tarefas_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view all tarefas_op"
  ON public.tarefas_operacionais FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can create tarefas_op"
  ON public.tarefas_operacionais FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update tarefas_op"
  ON public.tarefas_operacionais FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Creator can delete tarefas_op"
  ON public.tarefas_operacionais FOR DELETE
  TO authenticated USING (criado_por = auth.uid());

-- 3. Tabela de atribuídos às tarefas operacionais
CREATE TABLE public.tarefas_operacionais_atribuidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas_operacionais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tarefa_id, user_id)
);

ALTER TABLE public.tarefas_operacionais_atribuidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view atribuidos"
  ON public.tarefas_operacionais_atribuidos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can manage atribuidos"
  ON public.tarefas_operacionais_atribuidos FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete atribuidos"
  ON public.tarefas_operacionais_atribuidos FOR DELETE
  TO authenticated USING (true);

-- 4. Realtime para tarefas operacionais
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas_operacionais;

-- 5. Função atômica para encontrar ou criar conversa interna (anti-duplicação)
CREATE OR REPLACE FUNCTION public.find_or_create_internal_conversation(
  p_user1 UUID,
  p_user2 UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  -- Find existing 1-on-1 conversation between these two users
  SELECT icm1.conversation_id INTO v_conv_id
  FROM internal_conversation_members icm1
  JOIN internal_conversation_members icm2 ON icm1.conversation_id = icm2.conversation_id
  JOIN internal_conversations ic ON ic.id = icm1.conversation_id
  WHERE icm1.user_id = p_user1
    AND icm2.user_id = p_user2
    AND ic.is_group = false
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new conversation
  v_conv_id := gen_random_uuid();
  INSERT INTO internal_conversations (id, is_group) VALUES (v_conv_id, false);
  INSERT INTO internal_conversation_members (conversation_id, user_id) VALUES (v_conv_id, p_user1);
  INSERT INTO internal_conversation_members (conversation_id, user_id) VALUES (v_conv_id, p_user2);

  RETURN v_conv_id;
END;
$$;
