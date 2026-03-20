
ALTER TABLE fichas_de_servico
ADD COLUMN observacao_financeira text,
ADD COLUMN observacao_financeira_por uuid REFERENCES auth.users(id);
