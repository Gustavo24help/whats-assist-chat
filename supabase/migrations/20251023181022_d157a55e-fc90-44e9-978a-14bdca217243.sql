-- Criar tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor text,
  descricao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem ver todas as configurações"
  ON public.configuracoes FOR SELECT
  USING (true);

CREATE POLICY "Admins podem inserir configurações"
  ON public.configuracoes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins podem atualizar configurações"
  ON public.configuracoes FOR UPDATE
  USING (true);

CREATE POLICY "Admins podem deletar configurações"
  ON public.configuracoes FOR DELETE
  USING (true);

-- Inserir configuração do webhook
INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES 
  ('webhook_criar_ficha', '', 'URL do webhook para criação de fichas'),
  ('janela_whatsapp_24h', 'true', 'Controlar janela de 24h do WhatsApp')
ON CONFLICT (chave) DO NOTHING;