
-- Step 1: Create/update prestadores_chat entries with names from prestadores table
INSERT INTO public.prestadores_chat (telefone, nome, cpf, ultima_interacao)
SELECT DISTINCT 
  m_conv.cliente_id,
  COALESCE(
    p.nome,
    (SELECT c.nome FROM clientes c WHERE c.telefone = m_conv.cliente_id LIMIT 1),
    REPLACE(m_conv.cliente_id, 'whatsapp:+', '')
  ),
  p.cpf,
  (SELECT MAX(m2.data_hora) FROM mensagens m2 WHERE m2.cliente_id = m_conv.cliente_id)
FROM (
  SELECT DISTINCT cliente_id FROM mensagens WHERE remetente LIKE '%554138910814%'
) m_conv
LEFT JOIN prestadores p ON (
  REPLACE(REPLACE(m_conv.cliente_id, 'whatsapp:+55', ''), 'whatsapp:+', '') = p.telefone
  OR p.telefone = REPLACE(m_conv.cliente_id, 'whatsapp:+', '')
  OR ('55' || p.telefone) = REPLACE(m_conv.cliente_id, 'whatsapp:+', '')
)
ON CONFLICT (telefone) DO UPDATE SET
  nome = COALESCE(EXCLUDED.nome, prestadores_chat.nome),
  cpf = COALESCE(EXCLUDED.cpf, prestadores_chat.cpf),
  ultima_interacao = GREATEST(EXCLUDED.ultima_interacao, prestadores_chat.ultima_interacao);

-- Step 2: Copy ALL messages from these conversations to mensagens_prestadores
INSERT INTO public.mensagens_prestadores (
  id, prestador_telefone, texto, tipo, arquivo_url, data_hora,
  remetente, status, message_sid, ficha_id, enviado_por_id,
  numero_twilio, reply_to_message_id
)
SELECT
  m.id, m.cliente_id, m.texto, m.tipo, m.arquivo_url, m.data_hora,
  m.remetente, m.status, m.message_sid, m.ficha_id, m.enviado_por_id,
  COALESCE(m.numero_twilio, 'whatsapp:+554138910814'), m.reply_to_message_id
FROM public.mensagens m
WHERE m.cliente_id IN (
  SELECT DISTINCT cliente_id FROM mensagens WHERE remetente LIKE '%554138910814%'
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Delete moved messages from mensagens (no FK issues here)
DELETE FROM public.mensagens
WHERE id IN (
  SELECT m.id FROM public.mensagens m
  WHERE m.cliente_id IN (
    SELECT DISTINCT m2.cliente_id FROM public.mensagens m2 WHERE m2.remetente LIKE '%554138910814%'
  )
);
