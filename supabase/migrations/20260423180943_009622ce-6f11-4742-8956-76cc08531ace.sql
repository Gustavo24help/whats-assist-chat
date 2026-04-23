DROP TRIGGER IF EXISTS on_new_client_message_mark_unread ON public.mensagens;

CREATE UNIQUE INDEX IF NOT EXISTS mensagem_leitura_operador_user_cliente_uniq
  ON public.mensagem_leitura_operador (user_id, cliente_telefone);