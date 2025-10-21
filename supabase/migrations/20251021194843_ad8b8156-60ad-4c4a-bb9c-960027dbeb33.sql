-- Reestruturação completa para usar IDs fixos

-- 1. Remover constraints e tabelas existentes para recriar com nova estrutura
DROP TABLE IF EXISTS public.orcamentos CASCADE;
DROP TABLE IF EXISTS public.mensagens CASCADE;
DROP TABLE IF EXISTS public.fichas_de_servico CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.prestadores CASCADE;

-- 2. Recriar tabela de clientes usando telefone como PK
CREATE TABLE public.clientes (
  telefone text PRIMARY KEY,
  nome text NOT NULL DEFAULT 'Cliente Desconhecido',
  status_conversa status_conversa_enum DEFAULT 'aberta',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ultima_interacao timestamptz DEFAULT now()
);

-- 3. Recriar tabela de prestadores usando CPF como PK
CREATE TABLE public.prestadores (
  cpf text PRIMARY KEY,
  id_azure text,
  nome text NOT NULL,
  telefone text NOT NULL,
  cnpj text,
  categoria text,
  especialidade text,
  id_crm text,
  created_at timestamptz DEFAULT now()
);

-- 4. Recriar tabela de fichas usando nome_ficha como PK
CREATE TABLE public.fichas_de_servico (
  id text PRIMARY KEY, -- nome da ficha
  telefone_cliente text NOT NULL REFERENCES public.clientes(telefone) ON DELETE CASCADE,
  nome_ficha text,
  status status_ficha_enum DEFAULT 'pendente',
  categoria_id integer REFERENCES public.categorias(id),
  descricao text,
  prestador_id text REFERENCES public.prestadores(cpf),
  valor_total numeric DEFAULT 0,
  valor_mao_obra numeric DEFAULT 0,
  valor_pecas numeric DEFAULT 0,
  horario_agendamento timestamptz,
  cpf text,
  endereco text,
  pagamento_gerar_link boolean DEFAULT false,
  pagamento_tipo tipo_pagamento_enum,
  pagamento_parcelas integer DEFAULT 1,
  id_zoho text,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Recriar tabela de orçamentos
CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL REFERENCES public.fichas_de_servico(id) ON DELETE CASCADE,
  cpf_prestador text,
  valor numeric NOT NULL,
  valor_mao_obra numeric,
  valor_pecas numeric,
  descricao text NOT NULL,
  categoria text,
  status status_orcamento_enum DEFAULT 'pendente',
  enviado boolean DEFAULT false,
  data_envio timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 6. Recriar tabela de mensagens
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id text NOT NULL REFERENCES public.clientes(telefone) ON DELETE CASCADE,
  ficha_id text REFERENCES public.fichas_de_servico(id),
  remetente text NOT NULL,
  texto text,
  arquivo_url text,
  tipo tipo_mensagem_enum DEFAULT 'texto',
  status status_mensagem_enum DEFAULT 'enviado',
  data_hora timestamptz DEFAULT now()
);

-- 7. Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_de_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- 8. Recriar políticas RLS (permitir tudo para atendentes)
CREATE POLICY "Atendentes podem ver todos os clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar clientes" ON public.clientes FOR UPDATE USING (true);

CREATE POLICY "Atendentes podem ver todos os prestadores" ON public.prestadores FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir prestadores" ON public.prestadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar prestadores" ON public.prestadores FOR UPDATE USING (true);

CREATE POLICY "Atendentes podem ver todas as fichas" ON public.fichas_de_servico FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir fichas" ON public.fichas_de_servico FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar fichas" ON public.fichas_de_servico FOR UPDATE USING (true);

CREATE POLICY "Atendentes podem ver todos os orçamentos" ON public.orcamentos FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir orçamentos" ON public.orcamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar orçamentos" ON public.orcamentos FOR UPDATE USING (true);

CREATE POLICY "Atendentes podem ver todas as mensagens" ON public.mensagens FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir mensagens" ON public.mensagens FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar mensagens" ON public.mensagens FOR UPDATE USING (true);

-- 9. Recriar trigger para updated_at
CREATE TRIGGER update_fichas_de_servico_updated_at
  BEFORE UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prestadores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fichas_de_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;