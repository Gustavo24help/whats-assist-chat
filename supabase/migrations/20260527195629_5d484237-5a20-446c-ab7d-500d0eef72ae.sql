
UPDATE public.clientes
SET bot_habilitado = true,
    bot_desligado_manualmente = false,
    atendente_id = NULL,
    ficha_ativa_id = NULL
WHERE telefone = 'whatsapp:+554198751600';
