-- Ajustar tabela de orçamentos conforme requisitos

-- Renomear colunas para novos nomes
ALTER TABLE public.orcamentos RENAME COLUMN ficha_id TO ficha_nome;
ALTER TABLE public.orcamentos RENAME COLUMN cpf_prestador TO prestador_cpf;
ALTER TABLE public.orcamentos RENAME COLUMN valor TO valor_total;
ALTER TABLE public.orcamentos RENAME COLUMN descricao TO observacoes;
ALTER TABLE public.orcamentos RENAME COLUMN created_at TO data_criacao;

-- Tornar prestador_cpf obrigatório
ALTER TABLE public.orcamentos ALTER COLUMN prestador_cpf SET NOT NULL;

-- Tornar valor_total opcional
ALTER TABLE public.orcamentos ALTER COLUMN valor_total DROP NOT NULL;

-- Tornar observacoes opcional
ALTER TABLE public.orcamentos ALTER COLUMN observacoes DROP NOT NULL;

-- Remover coluna data_envio
ALTER TABLE public.orcamentos DROP COLUMN IF EXISTS data_envio;

-- Remover coluna enviado (não mencionada como necessária)
ALTER TABLE public.orcamentos DROP COLUMN IF EXISTS enviado;