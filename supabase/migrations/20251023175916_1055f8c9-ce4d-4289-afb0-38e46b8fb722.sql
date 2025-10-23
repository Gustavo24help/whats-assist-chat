-- Criar tabela de mensagens padronizadas
CREATE TABLE public.mensagens_padronizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tag TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar coluna tempo_servico na tabela fichas_de_servico
ALTER TABLE public.fichas_de_servico 
ADD COLUMN tempo_servico TEXT;

-- Habilitar RLS
ALTER TABLE public.mensagens_padronizadas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mensagens padronizadas
CREATE POLICY "Atendentes podem ver todas as mensagens padronizadas"
ON public.mensagens_padronizadas
FOR SELECT
USING (true);

CREATE POLICY "Atendentes podem inserir mensagens padronizadas"
ON public.mensagens_padronizadas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar mensagens padronizadas"
ON public.mensagens_padronizadas
FOR UPDATE
USING (true);

CREATE POLICY "Atendentes podem deletar mensagens padronizadas"
ON public.mensagens_padronizadas
FOR DELETE
USING (true);