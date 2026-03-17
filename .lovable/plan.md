

## Problema

O relatório de exportação do Dashboard (`ExportReportSection.tsx`) puxa dados financeiros da tabela `fichas_de_servico`, onde `pagamento_realizado` é um **booleano** (Sim/Não). A maioria aparece como "Não" porque esse campo só marca se o cliente pagou.

O módulo Financeiro (`HistoricoTransacoes.tsx`) usa a tabela `transacoes_financeiras`, que tem dados completos: valor cliente, valor prestador, lucro, margem, status de pagamento cliente/prestador.

## Solução

Reformular o grupo "Financeiro" do exportador para buscar dados da tabela `transacoes_financeiras` (fazendo JOIN por `ficha_id`), alinhando com o módulo financeiro.

### Mudanças em `ExportReportSection.tsx`

**1. Substituir colunas financeiras**

Trocar as colunas atuais do grupo "Financeiro":
- ~~Valor Total da OS~~ / ~~Valor Mão de Obra~~ / ~~Valor Material/Peças~~ / ~~Serviço Pago~~ / ~~Tipo de Pagamento~~

Por colunas equivalentes ao Financeiro:
- Valor Cliente (valor_cliente_final)
- Valor Prestador (valor_a_pagar_prestador)  
- Lucro Bruto (valor_lucro_bruto)
- Margem % (margem_operacional_real)
- Status Pgto Cliente (status_pagamento_cliente)
- Status Pgto Prestador (status_pagamento_prestador)
- Data Pagamento (data_pagamento_realizada)
- Categoria Financeira (categoria da transação)

**2. Buscar transações financeiras no export**

Após carregar as fichas, buscar `transacoes_financeiras` com `.in("ficha_id", fichaIds)` e criar um Map por `ficha_id` para acessar os dados financeiros de cada ficha.

**3. Atualizar filtro de pagamento**

O filtro "Apenas Pagos" / "Apenas Pendentes" passará a filtrar por `status_pagamento_cliente` da transação (pago/pendente) em vez do booleano `pagamento_realizado`.

**4. Manter colunas da ficha como opção**

As colunas originais da ficha (valor_total, valor_mao_obra, valor_pecas) continuam disponíveis no grupo "Ficha" para quem quiser, mas o grupo "Financeiro" refletirá os dados reais de `transacoes_financeiras`.

### Arquivo afetado
- `src/components/dashboard/ExportReportSection.tsx`

