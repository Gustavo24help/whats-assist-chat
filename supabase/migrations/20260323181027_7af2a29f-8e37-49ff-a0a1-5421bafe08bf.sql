
-- Step 1: Create prestadores_chat entries for phone numbers that have messages on the prestador number
-- but don't exist in prestadores_chat yet
INSERT INTO public.prestadores_chat (telefone, nome, created_at)
SELECT DISTINCT
  m.cliente_id,
  COALESCE(c.nome, 'Prestador'),
  NOW()
FROM public.mensagens m
LEFT JOIN public.clientes c ON c.telefone = m.cliente_id
LEFT JOIN public.prestadores_chat pc ON pc.telefone = m.cliente_id
WHERE m.numero_twilio IN ('whatsapp:+554138910814', '+554138910814')
  AND pc.telefone IS NULL
ON CONFLICT (telefone) DO NOTHING;

-- Step 2: Copy messages from mensagens to mensagens_prestadores
INSERT INTO public.mensagens_prestadores (
  id, prestador_telefone, texto, tipo, arquivo_url, data_hora,
  remetente, status, message_sid, ficha_id, enviado_por_id,
  numero_twilio, reply_to_message_id
)
SELECT
  id, cliente_id, texto, tipo, arquivo_url, data_hora,
  remetente, status, message_sid, ficha_id, enviado_por_id,
  numero_twilio, reply_to_message_id
FROM public.mensagens
WHERE numero_twilio IN ('whatsapp:+554138910814', '+554138910814')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Delete the moved messages from mensagens
DELETE FROM public.mensagens
WHERE numero_twilio IN ('whatsapp:+554138910814', '+554138910814');

-- Step 4: Clean up clientes entries that ONLY had messages from the prestador number
-- (only delete if they have no remaining messages in the mensagens table)
DELETE FROM public.clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.mensagens m WHERE m.cliente_id = c.telefone
)
AND EXISTS (
  SELECT 1 FROM public.mensagens_prestadores mp WHERE mp.prestador_telefone = c.telefone
)
AND c.ficha_ativa_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.fichas_de_servico f WHERE f.telefone_cliente = c.telefone
);
