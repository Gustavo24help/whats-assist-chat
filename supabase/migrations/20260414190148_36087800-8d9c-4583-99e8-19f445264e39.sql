
-- Atualizar ficha
UPDATE fichas_de_servico 
SET pagamento_realizado = true,
    status = 'Garantia',
    notas = COALESCE(notas, '') || E'\n' || '[14/04/2026 16:00] ✅ Pagamento confirmado manualmente (Asaas confirmado, webhook não recebido) — Valor: R$ 8.00'
WHERE id = 'FGM9@260414';

-- Atualizar conta a receber
UPDATE contas_receber 
SET status = 'pago',
    data_pagamento = '2026-04-14'
WHERE ficha_id = 'FGM9@260414';

-- Atualizar transação financeira
UPDATE transacoes_financeiras 
SET status_pagamento_cliente = 'pago',
    data_pagamento_realizada = now()
WHERE ficha_id = 'FGM9@260414';

-- Registrar auditoria
INSERT INTO automation_audit (ficha_id, etapa, status, detalhe)
VALUES ('FGM9@260414', 'webhook_pagamento', 'success', 'Processado manualmente — webhook Asaas não foi recebido (endpoint não configurado no Asaas)');
