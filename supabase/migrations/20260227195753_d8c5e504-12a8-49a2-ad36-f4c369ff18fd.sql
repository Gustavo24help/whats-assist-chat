
-- =====================================================
-- MÓDULO FINANCEIRO 24HELP
-- =====================================================

-- 1. Função: Arredondar valor para terminar em 8
CREATE OR REPLACE FUNCTION public.arredondar_para_8(valor DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  valor_inteiro INTEGER;
  ultimo_digito INTEGER;
BEGIN
  valor_inteiro := CEIL(valor);
  ultimo_digito := valor_inteiro % 10;
  
  IF ultimo_digito = 8 THEN
    RETURN valor_inteiro;
  END IF;
  
  IF ultimo_digito = 9 THEN
    RETURN valor_inteiro + 9;
  END IF;
  
  RETURN valor_inteiro + (8 - ultimo_digito);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 2. Função: Adicionar dias úteis
CREATE OR REPLACE FUNCTION public.adicionar_dias_uteis(data_base TIMESTAMPTZ, dias INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  data_resultado TIMESTAMPTZ;
  dias_adicionados INTEGER := 0;
  dia_semana INTEGER;
BEGIN
  data_resultado := data_base;
  
  WHILE dias_adicionados < dias LOOP
    data_resultado := data_resultado + INTERVAL '1 day';
    dia_semana := EXTRACT(DOW FROM data_resultado);
    
    IF dia_semana != 0 AND dia_semana != 6 THEN
      dias_adicionados := dias_adicionados + 1;
    END IF;
  END LOOP;
  
  RETURN data_resultado;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 3. Tabela de Transações Financeiras
CREATE TABLE public.transacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referências
  ficha_id TEXT NOT NULL,
  prestador_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  
  -- Dados do prestador (snapshot)
  prestador_nome TEXT NOT NULL,
  prestador_codigo TEXT NULL,
  prestador_cpf TEXT NULL,
  prestador_cnpj TEXT NULL,
  
  -- Dados do cliente (snapshot)
  cliente_nome TEXT NOT NULL DEFAULT 'Cliente',
  
  -- Datas importantes
  data_contratacao TIMESTAMPTZ NULL,
  data_execucao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_pagamento_prevista TIMESTAMPTZ NOT NULL,
  data_pagamento_realizada TIMESTAMPTZ NULL,
  
  -- Valores do serviço
  valor_mao_obra DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_material DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_visita DECIMAL(10,2) NOT NULL DEFAULT 0,
  adiantamento_cliente DECIMAL(10,2) NOT NULL DEFAULT 0,
  adiantamento_prestador DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Margem
  margem_percentual DECIMAL(5,2) NOT NULL DEFAULT 23.00,
  valor_cliente_calculado DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_cliente_final DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Lucro
  valor_lucro_bruto DECIMAL(10,2) NOT NULL DEFAULT 0,
  margem_operacional_real DECIMAL(5,2) NOT NULL DEFAULT 0,
  
  -- Prestador
  material_pago_24help BOOLEAN NOT NULL DEFAULT false,
  valor_a_pagar_prestador DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Pagamento e Status
  forma_pagamento_cliente TEXT NULL,
  status_pagamento_cliente TEXT NOT NULL DEFAULT 'pendente',
  status_pagamento_prestador TEXT NOT NULL DEFAULT 'pendente',
  link_pagamento_asaas TEXT NULL,
  
  -- Dados bancários do prestador (snapshot)
  pix_prestador TEXT NULL,
  banco_prestador TEXT NULL,
  agencia_prestador TEXT NULL,
  conta_prestador TEXT NULL,
  
  -- Categorização
  categoria TEXT NULL,
  
  -- Flags
  tem_adiantamento BOOLEAN DEFAULT false,
  tem_desconto BOOLEAN DEFAULT false,
  observacoes TEXT NULL,
  
  -- Auditoria
  criado_por UUID NULL,
  atualizado_por UUID NULL,
  aprovado_por UUID NULL,
  aprovado_em TIMESTAMPTZ NULL,
  
  -- Sincronização
  sincronizado_sheets BOOLEAN DEFAULT false,
  sheets_row_id TEXT NULL,
  sincronizado_em TIMESTAMPTZ NULL
);

CREATE INDEX idx_transacoes_ficha ON public.transacoes_financeiras(ficha_id);
CREATE INDEX idx_transacoes_prestador ON public.transacoes_financeiras(prestador_id);
CREATE INDEX idx_transacoes_data_pagamento ON public.transacoes_financeiras(data_pagamento_prevista);
CREATE INDEX idx_transacoes_status_prestador ON public.transacoes_financeiras(status_pagamento_prestador);

-- Trigger updated_at
CREATE TRIGGER trigger_update_transacoes_updated_at
BEFORE UPDATE ON public.transacoes_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver transações"
ON public.transacoes_financeiras FOR SELECT USING (true);

CREATE POLICY "Atendentes podem inserir transações"
ON public.transacoes_financeiras FOR INSERT WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar transações"
ON public.transacoes_financeiras FOR UPDATE USING (true);

-- 4. Tabela de Adiantamentos
CREATE TABLE public.adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  prestador_id TEXT NOT NULL,
  ficha_id TEXT NULL,
  transacao_id UUID NULL REFERENCES public.transacoes_financeiras(id),
  
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  data_adiantamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo TEXT NULL,
  
  status TEXT NOT NULL DEFAULT 'pendente',
  compensado_em TIMESTAMPTZ NULL,
  
  criado_por UUID NULL
);

CREATE INDEX idx_adiantamentos_prestador ON public.adiantamentos(prestador_id);
CREATE INDEX idx_adiantamentos_ficha ON public.adiantamentos(ficha_id);
CREATE INDEX idx_adiantamentos_status ON public.adiantamentos(status);

ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver adiantamentos"
ON public.adiantamentos FOR SELECT USING (true);

CREATE POLICY "Atendentes podem inserir adiantamentos"
ON public.adiantamentos FOR INSERT WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar adiantamentos"
ON public.adiantamentos FOR UPDATE USING (true);

-- 5. Tabela Conta Corrente Prestador
CREATE TABLE public.conta_corrente_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  prestador_id TEXT NOT NULL,
  transacao_id UUID NULL REFERENCES public.transacoes_financeiras(id),
  adiantamento_id UUID NULL REFERENCES public.adiantamentos(id),
  
  tipo TEXT NOT NULL,
  origem TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_anterior DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  descricao TEXT NOT NULL DEFAULT '',
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  criado_por UUID NULL
);

CREATE INDEX idx_conta_corrente_prestador ON public.conta_corrente_prestador(prestador_id);
CREATE INDEX idx_conta_corrente_data ON public.conta_corrente_prestador(data_movimentacao);

ALTER TABLE public.conta_corrente_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver conta corrente"
ON public.conta_corrente_prestador FOR SELECT USING (true);

CREATE POLICY "Atendentes podem inserir na conta corrente"
ON public.conta_corrente_prestador FOR INSERT WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar conta corrente"
ON public.conta_corrente_prestador FOR UPDATE USING (true);

-- 6. Tabela Descontos e Ajustes
CREATE TABLE public.descontos_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  transacao_id UUID NOT NULL REFERENCES public.transacoes_financeiras(id),
  
  tipo TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  percentual DECIMAL(5,2) NULL,
  motivo TEXT NOT NULL DEFAULT '',
  
  criado_por UUID NULL
);

CREATE INDEX idx_descontos_transacao ON public.descontos_ajustes(transacao_id);

ALTER TABLE public.descontos_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver descontos"
ON public.descontos_ajustes FOR SELECT USING (true);

CREATE POLICY "Atendentes podem inserir descontos"
ON public.descontos_ajustes FOR INSERT WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar descontos"
ON public.descontos_ajustes FOR UPDATE USING (true);
