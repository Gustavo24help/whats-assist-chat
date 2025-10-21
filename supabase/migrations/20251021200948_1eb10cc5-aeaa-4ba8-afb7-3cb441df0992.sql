-- Primeiro, vamos dropar e recriar o enum com todos os valores
DROP TYPE IF EXISTS status_ficha_enum CASCADE;

CREATE TYPE status_ficha_enum AS ENUM (
  'Não foi adiante',
  'Ficha Criada',
  'Contato Inicial',
  'Dúvida Prestador',
  'Orçamento Enviado',
  'Negociação',
  'Visita Técnica',
  'Orçamento Aprovado / Agendamento',
  'Orçamento Não Aprovado',
  'Agendado',
  'Em andamento',
  'Finalizado',
  'Garantia',
  'Perdido',
  'pendente'
);

-- Recriar a coluna status que foi dropada com o CASCADE
ALTER TABLE fichas_de_servico 
  ADD COLUMN status status_ficha_enum DEFAULT 'pendente';