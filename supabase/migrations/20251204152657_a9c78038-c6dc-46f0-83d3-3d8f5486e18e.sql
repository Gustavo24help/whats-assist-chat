-- Adicionar campos cpf e endereco na tabela clientes
ALTER TABLE clientes 
ADD COLUMN cpf text,
ADD COLUMN endereco text;