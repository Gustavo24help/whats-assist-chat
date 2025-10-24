-- Criar tabela para armazenar templates do WhatsApp
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_sid text NOT NULL UNIQUE,
  friendly_name text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Atendentes podem ver todos os templates"
ON public.whatsapp_templates
FOR SELECT
USING (true);

CREATE POLICY "Admins podem inserir templates"
ON public.whatsapp_templates
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins podem atualizar templates"
ON public.whatsapp_templates
FOR UPDATE
USING (true);

CREATE POLICY "Admins podem deletar templates"
ON public.whatsapp_templates
FOR DELETE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();