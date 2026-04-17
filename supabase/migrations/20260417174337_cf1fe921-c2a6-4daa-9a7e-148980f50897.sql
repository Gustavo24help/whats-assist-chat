ALTER TABLE public.fichas_de_servico
ADD COLUMN IF NOT EXISTS link_pagamento_envio_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_pagamento_ultimo_envio_em timestamptz,
ADD COLUMN IF NOT EXISTS link_pagamento_ultimo_envio_origem text,
ADD COLUMN IF NOT EXISTS link_pagamento_ultimo_envio_por uuid,
ADD COLUMN IF NOT EXISTS recibo_envio_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS recibo_ultimo_envio_origem text,
ADD COLUMN IF NOT EXISTS recibo_ultimo_envio_por uuid;

COMMENT ON COLUMN public.fichas_de_servico.link_pagamento_envio_count IS 'Quantas vezes o link de pagamento foi enviado ao cliente (auto + manual).';
COMMENT ON COLUMN public.fichas_de_servico.link_pagamento_ultimo_envio_origem IS 'Origem do último envio: automatico | manual.';
COMMENT ON COLUMN public.fichas_de_servico.link_pagamento_ultimo_envio_por IS 'user_id do operador que fez o envio manual (null para automatico).';
COMMENT ON COLUMN public.fichas_de_servico.recibo_envio_count IS 'Quantas vezes o recibo foi enviado ao cliente.';
COMMENT ON COLUMN public.fichas_de_servico.recibo_ultimo_envio_origem IS 'Origem do último envio do recibo: automatico | manual.';
COMMENT ON COLUMN public.fichas_de_servico.recibo_ultimo_envio_por IS 'user_id do operador que fez o envio manual do recibo.';