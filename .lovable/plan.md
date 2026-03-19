

# Revisão: Fluxo "Pagar" no Pagamento Prestadores

## Problemas Encontrados

### 1. `marcarPago` NÃO dispara webhook para planilha
O fluxo `marcarPago` (linhas 229-274 do `PagamentoPrestadoresTabV2.tsx`) apenas:
- Cria/atualiza `transacoes_financeiras` com `status_pagamento_prestador: "pago"`
- **NÃO chama** `webhook-financeiro` nem `webhook-update-planilha`

Resultado: a `/planilha` (PlanilhaControlePagamentos) vai mostrar os dados atualizados porque lê direto do banco, mas a **planilha externa (Google Sheets via Make.com)** NÃO será notificada.

### 2. Dados PIX estão visíveis e copiáveis — OK
- A query na linha 156 busca `chave_pix, nome_pix, banco` dos prestadores
- Na lista pendente (linhas 436-444), o PIX aparece com botão de copiar
- No popup de confirmação (linhas 606-640), nome PIX, chave PIX (com botão copiar) e banco são exibidos
- Se não há dados PIX cadastrados, mostra "Nenhum dado PIX cadastrado"

### 3. Informações sobre a ficha NÃO são atualizadas
O `marcarPago` não atualiza a `fichas_de_servico` (por exemplo, não seta `webhook_pendente` ou outros campos). A ficha permanece inalterada — só a `transacoes_financeiras` é modificada.

### 4. `PopupConfirmacaoFinanceira` não é usado no fluxo de Prestadores
O popup de confirmação do PagamentoPrestadoresTabV2 (linhas 579-682) é um dialog inline simples. O componente `PopupConfirmacaoFinanceira.tsx` é outro fluxo (para confirmação de clientes/financeiro geral) que **chama** o webhook-financeiro. Mas no fluxo de "Pagar Prestador", esse componente não é invocado.

## Plano de Correção

### 1. Adicionar chamada ao webhook após `marcarPago`
No `marcarPago` (PagamentoPrestadoresTabV2.tsx), após criar/atualizar a transação, chamar `webhook-update-planilha` com os dados relevantes (ficha_id, prestador, status_pagamento_prestador, data_pagamento_realizada, valor).

### 2. Atualizar `fichas_de_servico` no `marcarPago`
Após confirmar pagamento do prestador, setar `webhook_pendente: true` na ficha para sinalizar que houve atualização financeira.

### Arquivos a modificar
- `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` — adicionar webhook call e update na ficha dentro do `marcarPago`

