
UPDATE public.clientes
SET bot_habilitado = true,
    bot_desligado_manualmente = false,
    atendente_id = NULL,
    ficha_ativa_id = NULL,
    status_conversa = 'aberta'
WHERE telefone = 'whatsapp:+554198751600';

UPDATE public.conversa_ficha_vinculo
SET ativo = false
WHERE cliente_telefone = 'whatsapp:+554198751600'
  AND ativo = true;

UPDATE public.bot_reactivation_schedule
SET executed = true
WHERE telefone_cliente = 'whatsapp:+554198751600'
  AND executed = false;
