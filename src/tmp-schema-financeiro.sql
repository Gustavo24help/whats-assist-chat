-- =====================================================
-- MÓDULO FINANCEIRO 24HELP
-- Schema SQL Completo
-- =====================================================

-- 1. Tabela de Transações Financeiras (principal)
CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referências
  ficha_id TEXT NOT NULL REFERENCES fichas_de_servico(id) ON DELETE CASCADE,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id),
  cliente_id TEXT NOT NULL,
  
  -- Dados adicionais do prestador
  prestador_nome TEXT NOT NULL,
  prestador_codigo TEXT NULL,
  prestador_cpf TEXT NULL,
  prestador_cnpj TEXT NULL,
  
  -- Dados adicionais do cliente
  cliente_nome TEXT NOT NULL,
  
  -- Datas importantes
  data_contratacao TIMESTAMPTZ NOT NULL, -- Quando status mudou para "Agendado"
  data_execucao TIMESTAMPTZ NOT NULL, -- Quando status mudou para "Finalizado"
  data_pagamento_prevista TIMESTAMPTZ NOT NULL, -- 2 dias úteis após execução
  data_pagamento_realizada TIMESTAMPTZ NULL, -- Quando realmente foi pago
  
  -- Valores do serviço
  valor_mao_obra DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_material DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_visita DECIMAL(10,2) NOT NULL DEFAULT 0,
  adiantamento_cliente DECIMAL(10,2) NOT NULL DEFAULT 0,
  adiantamento_prestador DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_subtotal DECIMAL(10,2) GENERATED ALWAYS AS (valor_mao_obra + valor_material + taxa_visita) STORED,
  
  -- Cálculo automático do valor final (arredondado)
  margem_percentual DECIMAL(5,2) NOT NULL DEFAULT 23.00, -- Margem padrão 23%
  valor_cliente_calculado DECIMAL(10,2) NOT NULL, -- (mao_obra + material) / 0.77
  valor_cliente_final DECIMAL(10,2) NOT NULL, -- Arredondado para terminar em 8
  
  -- Valores financeiros
  valor_lucro_bruto DECIMAL(10,2) GENERATED ALWAYS AS (valor_cliente_final - valor_subtotal) STORED,
  margem_operacional_real DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN valor_cliente_final > 0 
      THEN ((valor_cliente_final - valor_subtotal) / valor_cliente_final * 100)
      ELSE 0 
    END
  ) STORED,
  
  -- Valor a pagar ao prestador
  material_pago_24help BOOLEAN NOT NULL DEFAULT false,
  valor_a_pagar_prestador DECIMAL(10,2) NOT NULL, -- Pode ser editado manualmente
  
  -- Pagamento e Status
  forma_pagamento_cliente TEXT NULL, -- "pix", "cartao", "boleto", "dinheiro"
  status_pagamento_cliente TEXT NOT NULL DEFAULT 'pendente', -- pendente, pago, cancelado
  status_pagamento_prestador TEXT NOT NULL DEFAULT 'pendente', -- pendente, pago, cancelado
  link_pagamento_asaas TEXT NULL,
  
  -- Dados do prestador
  pix_prestador TEXT NULL,
  banco_prestador TEXT NULL,
  agencia_prestador TEXT NULL,
  conta_prestador TEXT NULL,
  
  -- Categorização
  categoria TEXT NULL,
  
  -- Observações e ajustes
  tem_adiantamento BOOLEAN DEFAULT false,
  tem_desconto BOOLEAN DEFAULT false,
  observacoes TEXT NULL,
  
  -- Auditoria
  criado_por UUID REFERENCES auth.users(id),
  atualizado_por UUID REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ NULL,
  
  -- Sincronização com Sheets
  sincronizado_sheets BOOLEAN DEFAULT false,
  sheets_row_id TEXT NULL,
  sincronizado_em TIMESTAMPTZ NULL,
  
  -- Constraints
  CONSTRAINT valor_cliente_final_positivo CHECK (valor_cliente_final >= 0),
  CONSTRAINT valor_a_pagar_positivo CHECK (valor_a_pagar_prestador >= 0)
);

-- Índices
CREATE INDEX idx_transacoes_ficha ON transacoes_financeiras(ficha_id);
CREATE INDEX idx_transacoes_prestador ON transacoes_financeiras(prestador_id);
CREATE INDEX idx_transacoes_data_pagamento ON transacoes_financeiras(data_pagamento_prevista);
CREATE INDEX idx_transacoes_status_prestador ON transacoes_financeiras(status_pagamento_prestador);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_transacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transacoes_updated_at
BEFORE UPDATE ON transacoes_financeiras
FOR EACH ROW
EXECUTE FUNCTION update_transacoes_updated_at();

-- =====================================================
-- 2. Tabela de Adiantamentos
-- =====================================================
CREATE TABLE IF NOT EXISTS adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referências
  prestador_id TEXT NOT NULL REFERENCES prestadores(id),
  ficha_id TEXT NULL REFERENCES fichas_de_servico(id), -- Pode ser NULL se adiantamento geral
  transacao_id UUID NULL REFERENCES transacoes_financeiras(id),
  
  -- Dados do adiantamento
  valor DECIMAL(10,2) NOT NULL,
  data_adiantamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo TEXT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, compensado, cancelado
  compensado_em TIMESTAMPTZ NULL,
  
  -- Auditoria
  criado_por UUID REFERENCES auth.users(id),
  
  CONSTRAINT valor_adiantamento_positivo CHECK (valor > 0)
);

CREATE INDEX idx_adiantamentos_prestador ON adiantamentos(prestador_id);
CREATE INDEX idx_adiantamentos_ficha ON adiantamentos(ficha_id);

-- =====================================================
-- 3. Tabela de Conta Corrente do Prestador
-- =====================================================
CREATE TABLE IF NOT EXISTS conta_corrente_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referências
  prestador_id TEXT NOT NULL REFERENCES prestadores(id),
  transacao_id UUID NULL REFERENCES transacoes_financeiras(id),
  adiantamento_id UUID NULL REFERENCES adiantamentos(id),
  
  -- Movimentação
  tipo TEXT NOT NULL, -- 'credito', 'debito'
  origem TEXT NOT NULL, -- 'servico', 'adiantamento', 'ajuste_manual', 'desconto'
  valor DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(10,2) NOT NULL,
  
  -- Descrição
  descricao TEXT NOT NULL,
  
  -- Data
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Auditoria
  criado_por UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_conta_corrente_prestador ON conta_corrente_prestador(prestador_id);
CREATE INDEX idx_conta_corrente_data ON conta_corrente_prestador(data_movimentacao);

-- =====================================================
-- 4. Tabela de Descontos/Ajustes
-- =====================================================
CREATE TABLE IF NOT EXISTS descontos_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referências
  transacao_id UUID NOT NULL REFERENCES transacoes_financeiras(id),
  
  -- Dados do desconto/ajuste
  tipo TEXT NOT NULL, -- 'desconto_cliente', 'desconto_prestador', 'ajuste_manual', 'material_24help'
  valor DECIMAL(10,2) NOT NULL,
  percentual DECIMAL(5,2) NULL,
  motivo TEXT NOT NULL,
  
  -- Auditoria
  criado_por UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_descontos_transacao ON descontos_ajustes(transacao_id);

-- =====================================================
-- 5. View: Saldo Atual por Prestador
-- =====================================================
CREATE OR REPLACE VIEW saldo_prestadores AS
SELECT 
  p.id as prestador_id,
  p.nome as prestador_nome,
  COALESCE(SUM(
    CASE 
      WHEN cc.tipo = 'credito' THEN cc.valor
      WHEN cc.tipo = 'debito' THEN -cc.valor
      ELSE 0
    END
  ), 0) as saldo_atual,
  COUNT(cc.id) as total_movimentacoes,
  MAX(cc.data_movimentacao) as ultima_movimentacao
FROM prestadores p
LEFT JOIN conta_corrente_prestador cc ON p.id = cc.prestador_id
GROUP BY p.id, p.nome;

-- =====================================================
-- 6. View: Agenda de Pagamentos
-- =====================================================
CREATE OR REPLACE VIEW agenda_pagamentos AS
SELECT 
  t.id,
  t.ficha_id,
  t.prestador_id,
  p.nome as prestador_nome,
  t.data_pagamento_prevista,
  t.data_pagamento_realizada,
  t.valor_a_pagar_prestador,
  t.status_pagamento_prestador,
  t.pix_prestador,
  t.tem_adiantamento,
  COALESCE(SUM(a.valor), 0) as total_adiantamentos,
  (t.valor_a_pagar_prestador - COALESCE(SUM(a.valor), 0)) as valor_liquido,
  sp.saldo_atual as saldo_conta_corrente
FROM transacoes_financeiras t
JOIN prestadores p ON t.prestador_id = p.id
LEFT JOIN adiantamentos a ON a.transacao_id = t.id AND a.status = 'compensado'
LEFT JOIN saldo_prestadores sp ON sp.prestador_id = t.prestador_id
WHERE t.status_pagamento_prestador != 'cancelado'
GROUP BY t.id, p.nome, sp.saldo_atual
ORDER BY t.data_pagamento_prevista ASC;

-- =====================================================
-- 7. Function: Calcular valor arredondado para terminar em 8
-- =====================================================
CREATE OR REPLACE FUNCTION arredondar_para_8(valor DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  valor_inteiro INTEGER;
  ultimo_digito INTEGER;
BEGIN
  valor_inteiro := CEIL(valor);
  ultimo_digito := valor_inteiro % 10;
  
  -- Se já termina em 8, retorna
  IF ultimo_digito = 8 THEN
    RETURN valor_inteiro;
  END IF;
  
  -- Se termina em 9, adiciona 9 (vai para próxima dezena terminada em 8)
  IF ultimo_digito = 9 THEN
    RETURN valor_inteiro + 9;
  END IF;
  
  -- Para outros casos, adiciona até chegar em 8
  RETURN valor_inteiro + (8 - ultimo_digito);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 8. Function: Calcular dias úteis
-- =====================================================
CREATE OR REPLACE FUNCTION adicionar_dias_uteis(data_base TIMESTAMPTZ, dias INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  data_resultado TIMESTAMPTZ;
  dias_adicionados INTEGER := 0;
  dia_semana INTEGER;
BEGIN
  data_resultado := data_base;
  
  WHILE dias_adicionados < dias LOOP
    data_resultado := data_resultado + INTERVAL '1 day';
    dia_semana := EXTRACT(DOW FROM data_resultado); -- 0=Domingo, 6=Sábado
    
    -- Pula finais de semana
    IF dia_semana != 0 AND dia_semana != 6 THEN
      dias_adicionados := dias_adicionados + 1;
    END IF;
  END LOOP;
  
  RETURN data_resultado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 9. Function: Criar transação financeira automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION criar_transacao_financeira(
  p_ficha_id TEXT,
  p_valor_mao_obra DECIMAL,
  p_valor_material DECIMAL,
  p_taxa_visita DECIMAL DEFAULT 0,
  p_adiantamento_cliente DECIMAL DEFAULT 0,
  p_adiantamento_prestador DECIMAL DEFAULT 0,
  p_material_pago_24help BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_transacao_id UUID;
  v_ficha RECORD;
  v_prestador RECORD;
  v_cliente RECORD;
  v_valor_calculado DECIMAL;
  v_valor_final DECIMAL;
  v_margem DECIMAL := 23.00;
  v_valor_a_pagar DECIMAL;
BEGIN
  -- Buscar dados da ficha
  SELECT * INTO v_ficha FROM fichas_de_servico WHERE id = p_ficha_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha de serviço não encontrada: %', p_ficha_id;
  END IF;
  
  -- Buscar dados do prestador
  SELECT * INTO v_prestador FROM prestadores WHERE id = v_ficha.prestador_responsavel_id;
  
  -- Buscar dados do cliente
  SELECT nome INTO v_cliente FROM clientes WHERE telefone = v_ficha.telefone_cliente;
  
  -- Calcular valor para o cliente
  v_valor_calculado := (p_valor_mao_obra + p_valor_material + p_taxa_visita) / 0.77;
  v_valor_final := arredondar_para_8(v_valor_calculado);
  
  -- Calcular valor a pagar ao prestador
  IF p_material_pago_24help THEN
    v_valor_a_pagar := p_valor_mao_obra + p_taxa_visita; -- Só mão de obra + taxa visita
  ELSE
    v_valor_a_pagar := p_valor_mao_obra + p_valor_material + p_taxa_visita;
  END IF;
  
  -- Descontar adiantamento ao prestador
  v_valor_a_pagar := v_valor_a_pagar - p_adiantamento_prestador;
  
  -- Inserir transação
  INSERT INTO transacoes_financeiras (
    ficha_id,
    prestador_id,
    cliente_id,
    prestador_nome,
    prestador_codigo,
    prestador_cpf,
    prestador_cnpj,
    cliente_nome,
    data_contratacao,
    data_execucao,
    data_pagamento_prevista,
    valor_mao_obra,
    valor_material,
    taxa_visita,
    adiantamento_cliente,
    adiantamento_prestador,
    margem_percentual,
    valor_cliente_calculado,
    valor_cliente_final,
    material_pago_24help,
    valor_a_pagar_prestador,
    pix_prestador,
    banco_prestador,
    agencia_prestador,
    conta_prestador,
    categoria
  ) VALUES (
    p_ficha_id,
    v_ficha.prestador_responsavel_id,
    v_ficha.telefone_cliente,
    v_prestador.nome,
    v_prestador.codigo,
    v_prestador.cpf,
    v_prestador.cnpj,
    COALESCE(v_cliente.nome, 'Cliente sem nome'),
    v_ficha.data_agendamento,
    NOW(),
    adicionar_dias_uteis(NOW(), 2),
    p_valor_mao_obra,
    p_valor_material,
    p_taxa_visita,
    p_adiantamento_cliente,
    p_adiantamento_prestador,
    v_margem,
    v_valor_calculado,
    v_valor_final,
    p_material_pago_24help,
    v_valor_a_pagar,
    v_prestador.pix,
    v_prestador.banco,
    v_prestador.agencia,
    v_prestador.conta,
    v_ficha.servico_categoria
  ) RETURNING id INTO v_transacao_id;
  
  RETURN v_transacao_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. RLS (Row Level Security)
-- =====================================================
ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_corrente_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE descontos_ajustes ENABLE ROW LEVEL SECURITY;

-- Policy: Admins e financeiro podem ver tudo
CREATE POLICY "Admins e financeiro podem ver transações"
ON transacoes_financeiras FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM usuarios WHERE role IN ('admin', 'financeiro')
  )
);

-- Policy: Admins e financeiro podem editar
CREATE POLICY "Admins e financeiro podem editar transações"
ON transacoes_financeiras FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM usuarios WHERE role IN ('admin', 'financeiro')
  )
);

-- =====================================================
-- 11. Inserir dados iniciais (opcional)
-- =====================================================
-- Comentário: Adicione dados de teste se necessário
