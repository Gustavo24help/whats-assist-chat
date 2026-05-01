UPDATE public.whatsapp_templates
SET disable_bot_on_send = true
WHERE desliga_bot = true
  AND disable_bot_on_send = false;