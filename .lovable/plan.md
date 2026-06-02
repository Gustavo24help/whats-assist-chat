## Objetivo
Criar arquivo `documentação/dashboard-executivo.md` documentando a origem (tabela, coluna, filtro, lógica) de cada indicador exibido no dashboard executivo.

## Escopo
Documentar as seguintes seções e métricas:

1. **Funil de Conversão**
   - FS Criadas
   - Com Orçamento
   - Agendados
   - Finalizados
   - Pago (cliente)
   - Taxa de fechamento global
   - Variações percentuais

2. **Financeiro**
   - Valor Total OS
   - Mão de Obra
   - Peças
   - Pago a Prestadores
   - Líquido 24help
   - % Take Rate

3. **Volume de Atendimento**
   - Reaproveita dados do hook de KPIs
   - Pago ao Prestador (usa `data_pagamento_realizada` de transações)

4. **B2B vs B2C**
   - Classificação por CNPJ/CPF
   - Contagem, receita, ticket médio, clientes únicos

## Arquivos a serem lidos (referência)
- `src/hooks/useOperationalKPIs.ts` — origem dos KPIs operacionais
- `src/components/ExecutiveDashboardSection.tsx` — funil e financeiro
- `src/components/B2BvsB2CSection.tsx` — B2B vs B2C
- `src/components/DashboardContent.tsx` — layout geral

## Entregável
Arquivo `documentação/dashboard-executivo.md` com:
- Tabela de mapeamento métrica → tabela/campo/filtro
- Notas sobre campos de fallback (ex: `valor_final_mao_obra ?? valor_mao_obra`)
- Observações sobre distinção entre status histórico vs status atual
- Mencionar que quase tudo filtra por `created_at` da ficha, exceto "Pago ao Prestador"

Nenhuma alteração de código necessária. Apenas documentação.