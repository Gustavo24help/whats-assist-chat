
-- ============================================
-- Tabela 1: conversa_operador_leitura
-- ============================================
CREATE TABLE public.conversa_operador_leitura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL REFERENCES clientes(telefone) ON DELETE CASCADE,
  operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  mensagens_nao_lidas INTEGER DEFAULT 0,
  ultima_leitura TIMESTAMPTZ,
  
  outro_operador_leu_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  outro_operador_leu_em TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cliente_telefone, operador_id)
);

CREATE INDEX idx_conversa_op_leitura_operador ON conversa_operador_leitura(operador_id);
CREATE INDEX idx_conversa_op_leitura_cliente ON conversa_operador_leitura(cliente_telefone);

-- ============================================
-- Tabela 2: ficha_coaching
-- ============================================
CREATE TABLE public.ficha_coaching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL REFERENCES clientes(telefone) ON DELETE CASCADE,
  ficha_id TEXT REFERENCES fichas_de_servico(id) ON DELETE SET NULL,
  
  urgencia BOOLEAN DEFAULT FALSE,
  perguntas_tecnicas INTEGER DEFAULT 0,
  tempo_sem_resposta_minutos INTEGER DEFAULT 0,
  profile_cliente VARCHAR(50),
  
  conversao_base NUMERIC(3,2),
  conversao_meta NUMERIC(3,2),
  
  tpr_minutos INTEGER,
  multiplos_orcamentos INTEGER,
  ratio_cliente_op NUMERIC(3,2),
  ultima_msg_cliente BOOLEAN,
  
  sugestao_mensagem TEXT,
  proximo_passo VARCHAR(100),
  prioridade VARCHAR(20),
  
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cliente_telefone)
);

CREATE INDEX idx_ficha_coaching_cliente ON ficha_coaching(cliente_telefone);

-- ============================================
-- RLS: conversa_operador_leitura
-- ============================================
ALTER TABLE public.conversa_operador_leitura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operador_ve_proprios_registros"
ON public.conversa_operador_leitura
FOR SELECT TO authenticated
USING (operador_id = auth.uid());

CREATE POLICY "operador_atualiza_proprios_registros"
ON public.conversa_operador_leitura
FOR UPDATE TO authenticated
USING (operador_id = auth.uid());

CREATE POLICY "sistema_pode_inserir"
ON public.conversa_operador_leitura
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "anon_full_access_conversa_leitura"
ON public.conversa_operador_leitura
FOR ALL TO anon
USING (true) WITH CHECK (true);

-- ============================================
-- RLS: ficha_coaching
-- ============================================
ALTER TABLE public.ficha_coaching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access_coaching"
ON public.ficha_coaching
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_coaching"
ON public.ficha_coaching
FOR ALL TO anon
USING (true) WITH CHECK (true);

-- ============================================
-- Trigger: incrementar não lidos
-- ============================================
CREATE OR REPLACE FUNCTION public.aumentar_nao_lidos_nova_msg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.remetente = 'cliente' THEN
    INSERT INTO conversa_operador_leitura 
      (cliente_telefone, operador_id, mensagens_nao_lidas)
    SELECT 
      NEW.cliente_id,
      ur.user_id,
      1
    FROM user_roles ur
    WHERE ur.role IN ('operador', 'admin', 'chefe', 'admin_ti')
    ON CONFLICT (cliente_telefone, operador_id) 
    DO UPDATE SET 
      mensagens_nao_lidas = conversa_operador_leitura.mensagens_nao_lidas + 1,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aumentar_nao_lidos_msg
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.aumentar_nao_lidos_nova_msg();
