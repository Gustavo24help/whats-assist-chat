-- Adicionar coluna para controlar se a notificação de bot desativado foi vista
ALTER TABLE clientes 
ADD COLUMN bot_desativado_notificacao_vista boolean DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN clientes.bot_desativado_notificacao_vista IS 'Indica se a notificação de bot desativado foi vista pelo atendente. NULL = bot ativo, false = precisa mostrar notificação, true = notificação já vista';