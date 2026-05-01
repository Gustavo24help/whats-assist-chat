ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS disable_bot_on_send boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_templates.disable_bot_on_send IS
'Quando true, o envio deste template desliga o bot da conversa via toggle-bot-status. Substitui o campo legado desliga_bot. Default false: novos templates nunca desligam o bot a menos que explicitamente marcado.';