ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS desliga_bot boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_templates.desliga_bot IS 'Se true (padrão), enviar o template desativa o bot do cliente. Se false, o bot permanece no estado atual.';