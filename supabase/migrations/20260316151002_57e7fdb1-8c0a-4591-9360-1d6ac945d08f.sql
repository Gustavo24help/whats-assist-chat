-- Corrigir mensagens de clientes que foram salvas com cliente_id errado (número da 24help)
-- O cliente_id correto é o remetente (quem enviou a mensagem)
UPDATE mensagens
SET cliente_id = remetente
WHERE cliente_id = 'whatsapp:+554138911555'
  AND remetente != 'whatsapp:+554138911555'
  AND remetente != 'atendente'
  AND remetente != 'bot'
  AND remetente != 'operador';