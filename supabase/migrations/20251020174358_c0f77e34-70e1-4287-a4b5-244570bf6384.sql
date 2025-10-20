-- Create enum types
CREATE TYPE status_conversa_enum AS ENUM ('aberta', 'fechada');
CREATE TYPE status_ficha_enum AS ENUM ('pendente', 'em_andamento', 'concluido');
CREATE TYPE status_orcamento_enum AS ENUM ('pendente', 'aprovado', 'rejeitado');
CREATE TYPE tipo_mensagem_enum AS ENUM ('texto', 'arquivo');
CREATE TYPE status_mensagem_enum AS ENUM ('enviado', 'recebido', 'lido');
CREATE TYPE tipo_pagamento_enum AS ENUM ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto', 'transferencia');

-- Create Prestadores table
CREATE TABLE public.prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  especialidade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'Cliente Desconhecido',
  telefone TEXT UNIQUE NOT NULL,
  status_conversa status_conversa_enum DEFAULT 'aberta',
  ultima_interacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create FichasDeServico table
CREATE TABLE public.fichas_de_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  descricao TEXT,
  notas TEXT,
  valor_total DECIMAL(10,2) DEFAULT 0,
  valor_mao_obra DECIMAL(10,2) DEFAULT 0,
  valor_pecas DECIMAL(10,2) DEFAULT 0,
  cpf TEXT,
  endereco TEXT,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  horario_agendamento TIMESTAMP WITH TIME ZONE,
  pagamento_tipo tipo_pagamento_enum,
  pagamento_parcelas INTEGER DEFAULT 1,
  pagamento_gerar_link BOOLEAN DEFAULT false,
  status status_ficha_enum DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Orcamentos table
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID NOT NULL REFERENCES public.fichas_de_servico(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  enviado BOOLEAN DEFAULT false,
  data_envio TIMESTAMP WITH TIME ZONE,
  status status_orcamento_enum DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Mensagens table
CREATE TABLE public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ficha_id UUID REFERENCES public.fichas_de_servico(id) ON DELETE SET NULL,
  texto TEXT,
  tipo tipo_mensagem_enum DEFAULT 'texto',
  arquivo_url TEXT,
  data_hora TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status status_mensagem_enum DEFAULT 'enviado',
  remetente TEXT NOT NULL CHECK (remetente IN ('cliente', 'atendente'))
);

-- Enable Row Level Security
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_de_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (permitir acesso a usuários autenticados)
CREATE POLICY "Atendentes podem ver todos os prestadores"
  ON public.prestadores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir prestadores"
  ON public.prestadores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar prestadores"
  ON public.prestadores FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem ver todos os clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem ver todas as fichas"
  ON public.fichas_de_servico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir fichas"
  ON public.fichas_de_servico FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar fichas"
  ON public.fichas_de_servico FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem ver todos os orçamentos"
  ON public.orcamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir orçamentos"
  ON public.orcamentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar orçamentos"
  ON public.orcamentos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem ver todas as mensagens"
  ON public.mensagens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir mensagens"
  ON public.mensagens FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar mensagens"
  ON public.mensagens FOR UPDATE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for fichas_de_servico
CREATE TRIGGER update_fichas_de_servico_updated_at
  BEFORE UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_clientes_telefone ON public.clientes(telefone);
CREATE INDEX idx_clientes_status_conversa ON public.clientes(status_conversa);
CREATE INDEX idx_clientes_ultima_interacao ON public.clientes(ultima_interacao DESC);
CREATE INDEX idx_mensagens_cliente_id ON public.mensagens(cliente_id);
CREATE INDEX idx_mensagens_data_hora ON public.mensagens(data_hora DESC);
CREATE INDEX idx_fichas_cliente_id ON public.fichas_de_servico(cliente_id);
CREATE INDEX idx_orcamentos_ficha_id ON public.orcamentos(ficha_id);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fichas_de_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;