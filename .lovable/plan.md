

# Revisão Completa: Lógica de Dados em /prestadores

## Problemas Identificados

### 1. Ticket Médio usa `valor_total` (inclui margem da empresa) — deveria usar Mão de Obra + Peças

O relatório calcula ticket médio como `valor_total / fichas com valor`. Mas o `valor_total` inclui a margem da empresa. Conforme a documentação do sistema (Portal do Prestador), o ticket médio deve ser baseado estritamente em **Mão de Obra + Peças**.

**Exemplo real (Maycon):**
- Ticket médio atual (valor_total): R$ 318,75
- Ticket médio correto (MO + Peças): R$ 246,33
- Diferença: ~30% a mais

**Correção:** Trocar `valor_total` por `valor_mao_obra + valor_pecas` no cálculo de ticket médio e no valor total exibido.

### 2. "Executados" conta apenas fichas `Finalizado` — ignora outros status ativos

A coluna "Executados" na tabela e nos KPIs (`totalServicos`) usa apenas `fichasFinalizadas.length`. Mas o fetch traz fichas com status `Finalizado`, `Agendado`, `Em andamento` e `Perdido`. "Executados" só mostra finalizadas, enquanto o ranking por orçamentos mistura dados de todos os status.

**Impacto:** Se a planilha conta fichas em todos os status, os números não batem.

**Correção:** Renomear "Executados" para "Finalizados" para deixar claro, ou adicionar uma coluna separada com o total de fichas atribuídas no período (incluindo todos os status).

### 3. Filtro de fichas por período usa `horario_agendamento || created_at` — inconsistente com filtro de orçamentos

- Fichas: filtradas por `horario_agendamento` (fallback para `created_at`)
- Orçamentos: filtrados por `data_criacao`

Se uma ficha foi criada em março mas agendada para abril, ela aparece em abril. Mas o orçamento dessa ficha (criado em março) pode ficar fora do filtro de abril. Isso causa divergência entre orçamentos enviados/aceitos e fichas executadas no mesmo período.

### 4. Status `Orçamento Enviado` excluído do fetch de fichas

O fetch filtra fichas com `.in("status", ["Finalizado", "Agendado", "Em andamento", "Perdido"])`. Existem 11 fichas com status `Orçamento Enviado`, 12 com `pendente`, e outras em `Ficha Criada`, `Garantia`, `Retorno`, etc. — todas excluídas. Se a planilha considera esses status, os totais divergem.

### 5. Contagem de "Aceitos" com lógica estrita correta, mas "Rejeitados" pode contar aprovados de outro

A lógica de aceitos (status `aprovado` + ficha atribuída ao mesmo CPF) está correta. Mas "Rejeitados" inclui:
- Orçamentos com status `rejeitado`
- Orçamentos `aprovado` onde outro prestador foi escolhido

Isso está tecnicamente correto ("Não Aprovados"), mas pode confundir se a planilha separa "rejeitados pelo cliente" de "outro prestador escolhido".

### 6. "Baixa Atividade" usa threshold fixo por período — pode não bater com critérios da planilha

O threshold é: 0 para hoje, 1 para semana, 2 para mês, 3 para período total. Se a planilha usa outro critério, os prestadores listados serão diferentes.

## Plano de Correção

### Arquivo: `src/pages/PrestadoresReport.tsx`

1. **Ticket Médio** — Mudar cálculo para `(valor_mao_obra + valor_pecas)` em vez de `valor_total`. Ajustar nos KPIs, na tabela ranking, e no card de detalhes.

2. **Incluir mais status no fetch** — Adicionar `Orçamento Enviado`, `Ficha Criada`, `Garantia`, `Retorno`, `Visita Técnica`, `Contato Inicial`, `pendente`, `Não foi adiante` ao filtro de fichas. Ou remover o filtro de status completamente (trazer todas com `prestador_id`).

3. **Separar colunas na tabela** — Adicionar coluna "Total Fichas" (todos os status) além de "Finalizados". Renomear "Executados" para "Finalizados".

4. **Consistência de período** — Usar a mesma base de data para fichas e orçamentos. Sugestão: filtrar fichas por `created_at` (data de criação da ficha), igual ao `data_criacao` dos orçamentos, para que o período cubra os mesmos registros.

5. **KPIs de valor** — "Total" e "Mão de Obra" e "Peças" nos detalhes do prestador já estão separados, mas o "Total" mostrado é `valor_total` da ficha (com margem). Ajustar para exibir soma de MO + Peças como total do prestador.

### Resumo de Impacto

| Métrica | Hoje | Correção |
|---------|------|----------|
| Ticket Médio | valor_total / fichas | (MO + Peças) / fichas |
| Executados | só Finalizado | Renomear + adicionar Total |
| Fichas consideradas | 4 status | Todos com prestador_id |
| Filtro período fichas | horario_agendamento | created_at (consistente com orçamentos) |
| Valor Total prestador | valor_total (com margem) | MO + Peças |

Nenhum dado existente será alterado — apenas a leitura/exibição no frontend.

