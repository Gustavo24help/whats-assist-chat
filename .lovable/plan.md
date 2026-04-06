

## Plan

### Problem 1: Total no Detalhamento por Mês está errado

O campo `total` está usando `valor_total` da ficha (que inclui margem/markup da 24help), quando deveria ser simplesmente `maoObra + pecas` (o valor relevante para o prestador).

**Correção em `src/pages/PrestadorPortal.tsx`:**
- Linha 365: mudar `metricas.total` de `s.valor_total` para `(s.valor_mao_obra || 0) + (s.valor_pecas || 0)`
- Linha 389: mudar `dadosPorMes[].total` de `servico.valor_total` para `(servico.valor_mao_obra || 0) + (servico.valor_pecas || 0)`
- Linha 369: ajustar `ticketMedio` para usar o novo total recalculado

Isso garante que o prestador veja apenas mão de obra + peças, sem a margem da empresa.

---

### Problem 2: Inserir histórico de serviços anteriores ao sistema

Não precisa criar uma tabela nova. A tabela `fichas_de_servico` já é a fonte de dados do portal do prestador. Para inserir histórico, basta fazer INSERTs diretamente nela.

**Campos necessários por registro histórico:**
```sql
INSERT INTO fichas_de_servico (
  id,                    -- ex: 'HIST-001' (ID único)
  nome_ficha,            -- descrição do serviço
  telefone_cliente,      -- telefone do cliente (obrigatório, pode ser placeholder)
  prestador_id,          -- CPF do prestador (vincula ao prestador)
  valor_mao_obra,        -- valor pago de mão de obra
  valor_pecas,           -- valor de material/peças
  valor_total,           -- valor total cobrado do cliente
  bairro,                -- bairro do serviço
  horario_agendamento,   -- data do serviço (usado para agrupar por mês)
  status,                -- 'Finalizado'
  created_at             -- data de criação original
) VALUES (...);
```

**Observações importantes:**
- O portal filtra por `prestador_id = cpf` e status `IN ('Agendado', 'Finalizado', 'Em andamento', 'Visita Técnica')`, então o status deve ser `'Finalizado'` para histórico.
- O campo `horario_agendamento` é usado para agrupar por mês no gráfico/tabela.
- Para datas de finalização, inserir também em `ficha_status_historico` com `status_novo = 'Finalizado'` e `data_inicio` = data real da finalização.
- Para datas de pagamento, inserir em `transacoes_financeiras` com `data_pagamento_realizada` preenchida.
- Use IDs com prefixo (ex: `HIST-001`) para não conflitar com fichas reais.
- O campo `telefone_cliente` é NOT NULL; para histórico sem cliente real, usar um placeholder como `'0000000000'`.

Posso executar os INSERTs via ferramenta de inserção de dados quando tiver a planilha/dados prontos.

