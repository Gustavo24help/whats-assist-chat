-- 1) FUNÇÃO de sincronização
CREATE OR REPLACE FUNCTION public.sync_transacao_on_pagamento_realizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_prestador prestadores%ROWTYPE;
  v_cliente_nome text;
  v_data_finalizacao timestamptz;
  v_valor_mao_obra numeric;
  v_valor_pecas numeric;
  v_valor_total numeric;
  v_liquido_prestador numeric;
  v_lucro_bruto numeric;
  v_margem_pct numeric := 23.00;
  v_data_pgto_prevista timestamptz;
  v_now timestamptz := now();
BEGIN
  IF NEW.pagamento_realizado IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.pagamento_realizado, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM transacoes_financeiras WHERE ficha_id = NEW.id
  ORDER BY created_at ASC LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE transacoes_financeiras
    SET status_pagamento_cliente = 'pago',
        data_pagamento_realizada = COALESCE(data_pagamento_realizada, v_now),
        atualizado_por = auth.uid(),
        updated_at = v_now
    WHERE ficha_id = NEW.id AND status_pagamento_cliente <> 'pago';
    RETURN NEW;
  END IF;

  IF NEW.prestador_id IS NULL OR COALESCE(NEW.valor_total, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_prestador FROM prestadores WHERE cpf = NEW.prestador_id LIMIT 1;
  v_cliente_nome := COALESCE(NEW.nome_cliente, 'Cliente');
  v_valor_mao_obra := COALESCE(NEW.valor_final_mao_obra, NEW.valor_mao_obra, 0);
  v_valor_pecas := COALESCE(NEW.valor_final_pecas, NEW.valor_pecas, 0);
  v_valor_total := COALESCE(NEW.valor_total, v_valor_mao_obra + v_valor_pecas);
  v_liquido_prestador := v_valor_mao_obra * (1 - v_margem_pct/100);
  IF NEW.material_pago_24help IS NOT TRUE THEN
    v_liquido_prestador := v_liquido_prestador + v_valor_pecas;
  END IF;
  v_lucro_bruto := v_valor_total - v_liquido_prestador;

  SELECT data_inicio INTO v_data_finalizacao
  FROM ficha_status_historico
  WHERE ficha_id = NEW.id AND status_novo = 'Finalizado'
  ORDER BY data_inicio DESC LIMIT 1;
  v_data_finalizacao := COALESCE(v_data_finalizacao, v_now);
  v_data_pgto_prevista := public.adicionar_dias_uteis(v_data_finalizacao, 2);

  INSERT INTO transacoes_financeiras (
    ficha_id, prestador_id, prestador_nome, prestador_cpf, prestador_cnpj,
    cliente_id, cliente_nome,
    data_execucao, data_pagamento_prevista, data_pagamento_realizada,
    valor_mao_obra, valor_material, valor_subtotal,
    valor_cliente_calculado, valor_cliente_final,
    valor_a_pagar_prestador, valor_lucro_bruto,
    margem_percentual, margem_operacional_real,
    material_pago_24help,
    pix_prestador, banco_prestador, agencia_prestador, conta_prestador,
    status_pagamento_cliente, status_pagamento_prestador,
    criado_por
  ) VALUES (
    NEW.id, NEW.prestador_id, COALESCE(v_prestador.nome, 'Prestador'),
    v_prestador.cpf, v_prestador.cnpj,
    NEW.telefone_cliente, v_cliente_nome,
    v_data_finalizacao, v_data_pgto_prevista, v_now,
    v_valor_mao_obra, v_valor_pecas, v_valor_total,
    v_valor_total, v_valor_total,
    v_liquido_prestador, v_lucro_bruto,
    v_margem_pct,
    CASE WHEN v_valor_total > 0 THEN (v_lucro_bruto / v_valor_total * 100) ELSE 0 END,
    COALESCE(NEW.material_pago_24help, false),
    v_prestador.chave_pix, v_prestador.banco, v_prestador.agencia, v_prestador.conta,
    'pago', 'pendente',
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- 2) TRIGGER
DROP TRIGGER IF EXISTS trg_sync_transacao_on_pagamento ON public.fichas_de_servico;
CREATE TRIGGER trg_sync_transacao_on_pagamento
AFTER INSERT OR UPDATE OF pagamento_realizado ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.sync_transacao_on_pagamento_realizado();

-- 3) BACKFILL 1: sincronizar transações desatualizadas (37 casos)
UPDATE transacoes_financeiras t
SET status_pagamento_cliente = 'pago',
    data_pagamento_realizada = COALESCE(t.data_pagamento_realizada, f.updated_at, now()),
    updated_at = now()
FROM fichas_de_servico f
WHERE t.ficha_id = f.id
  AND f.pagamento_realizado = true
  AND f.status = 'Finalizado'
  AND t.status_pagamento_cliente <> 'pago';

-- 4) BACKFILL 2: criar transações faltantes (19 casos)
INSERT INTO transacoes_financeiras (
  ficha_id, prestador_id, prestador_nome, prestador_cpf, prestador_cnpj,
  cliente_id, cliente_nome,
  data_execucao, data_pagamento_prevista, data_pagamento_realizada,
  valor_mao_obra, valor_material, valor_subtotal,
  valor_cliente_calculado, valor_cliente_final,
  valor_a_pagar_prestador, valor_lucro_bruto,
  margem_percentual, margem_operacional_real,
  material_pago_24help,
  pix_prestador, banco_prestador, agencia_prestador, conta_prestador,
  status_pagamento_cliente, status_pagamento_prestador
)
SELECT
  f.id, f.prestador_id, COALESCE(p.nome, 'Prestador'),
  p.cpf, p.cnpj,
  f.telefone_cliente, COALESCE(f.nome_cliente, 'Cliente'),
  COALESCE(
    (SELECT data_inicio FROM ficha_status_historico
     WHERE ficha_id = f.id AND status_novo = 'Finalizado'
     ORDER BY data_inicio DESC LIMIT 1),
    f.updated_at, now()),
  public.adicionar_dias_uteis(
    COALESCE(
      (SELECT data_inicio FROM ficha_status_historico
       WHERE ficha_id = f.id AND status_novo = 'Finalizado'
       ORDER BY data_inicio DESC LIMIT 1),
      f.updated_at, now()), 2),
  CASE WHEN f.pagamento_realizado THEN COALESCE(f.updated_at, now()) ELSE NULL END,
  COALESCE(f.valor_final_mao_obra, f.valor_mao_obra, 0),
  COALESCE(f.valor_final_pecas, f.valor_pecas, 0),
  COALESCE(f.valor_total, 0),
  COALESCE(f.valor_total, 0),
  COALESCE(f.valor_total, 0),
  COALESCE(f.valor_final_mao_obra, f.valor_mao_obra, 0) * 0.77
    + CASE WHEN f.material_pago_24help IS NOT TRUE
           THEN COALESCE(f.valor_final_pecas, f.valor_pecas, 0) ELSE 0 END,
  COALESCE(f.valor_total, 0) - (
    COALESCE(f.valor_final_mao_obra, f.valor_mao_obra, 0) * 0.77
    + CASE WHEN f.material_pago_24help IS NOT TRUE
           THEN COALESCE(f.valor_final_pecas, f.valor_pecas, 0) ELSE 0 END),
  23.00,
  CASE WHEN COALESCE(f.valor_total, 0) > 0 THEN
    ((COALESCE(f.valor_total,0) - (
      COALESCE(f.valor_final_mao_obra, f.valor_mao_obra, 0) * 0.77
      + CASE WHEN f.material_pago_24help IS NOT TRUE
             THEN COALESCE(f.valor_final_pecas, f.valor_pecas, 0) ELSE 0 END
    )) / COALESCE(f.valor_total,1) * 100) ELSE 0 END,
  COALESCE(f.material_pago_24help, false),
  p.chave_pix, p.banco, p.agencia, p.conta,
  CASE WHEN f.pagamento_realizado THEN 'pago' ELSE 'pendente' END,
  'pendente'
FROM fichas_de_servico f
LEFT JOIN prestadores p ON p.cpf = f.prestador_id
WHERE f.status = 'Finalizado'
  AND COALESCE(f.valor_total, 0) > 0
  AND f.prestador_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM transacoes_financeiras t WHERE t.ficha_id = f.id);