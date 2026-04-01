
-- Fix FS1-260319: finalization was March 28, payment should be March 31
UPDATE transacoes_financeiras 
SET data_execucao = '2026-03-28T03:00:00+00:00',
    data_pagamento_prevista = '2026-03-31T12:00:00+00:00'
WHERE ficha_id = 'FS1-260319';

-- Fix FS3-260327: payment should be March 31
UPDATE transacoes_financeiras 
SET data_execucao = '2026-03-30T13:36:10+00:00',
    data_pagamento_prevista = '2026-03-31T12:00:00+00:00'
WHERE ficha_id = 'FS3-260327';

-- Fix FS3-260325: no transacao exists, create one with correct dates
INSERT INTO transacoes_financeiras (
  ficha_id, prestador_id, cliente_id, prestador_nome, cliente_nome,
  data_execucao, data_pagamento_prevista, 
  valor_mao_obra, valor_material, valor_subtotal,
  status_pagamento_prestador, status_pagamento_cliente
)
SELECT 
  f.id,
  f.prestador_id,
  f.telefone_cliente,
  COALESCE(p.nome, 'N/A'),
  COALESCE(f.nome_cliente, f.telefone_cliente),
  '2026-03-30T13:24:46+00:00',
  '2026-03-31T12:00:00+00:00',
  COALESCE(f.valor_mao_obra, 0),
  COALESCE(f.valor_pecas, 0),
  COALESCE(f.valor_total, 0),
  'pendente',
  CASE WHEN f.pagamento_realizado THEN 'pago' ELSE 'pendente' END
FROM fichas_de_servico f
LEFT JOIN prestadores p ON p.cpf = f.prestador_id
WHERE f.id = 'FS3-260325'
AND NOT EXISTS (SELECT 1 FROM transacoes_financeiras WHERE ficha_id = 'FS3-260325');
