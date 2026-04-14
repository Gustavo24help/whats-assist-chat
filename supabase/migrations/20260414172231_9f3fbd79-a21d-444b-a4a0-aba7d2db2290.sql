
UPDATE fichas_de_servico 
SET pagamento_realizado = true, 
    status = 'Garantia',
    notas = COALESCE(notas, '') || E'\n' || '[14/04/2026] ✅ Pagamento marcado manualmente como realizado (confirmado no Asaas, webhook não processou)'
WHERE id = 'FGM5@260413' AND pagamento_realizado = false;
