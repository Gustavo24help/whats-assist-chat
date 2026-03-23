

# Pagamento Dividido na Troca de Prestador (Ficha Agendada)

## Resumo

Quando um prestador é trocado em uma ficha com status "Agendado", o sistema abrirá dois popups sequenciais para que o operador defina manualmente quanto cada prestador receberá. Isso gera duas transações financeiras separadas para a mesma ficha, com marcações visuais no módulo Financeiro.

## Fluxo do Operador

1. Operador clica em "Trocar Prestador" numa ficha com status "Agendado"
2. Preenche o motivo e confirma a troca (fluxo existente)
3. **Popup 1 — Prestador Anterior**: Exibe o valor total da ficha e pede que o operador digite o valor a pagar ao prestador que saiu, com campo de justificativa obrigatório
4. **Popup 2 — Prestador Substituto**: Exibe o valor restante (total - valor do anterior), campo de justificativa. Se o operador digitar valor que excede o restante, mostra aviso. Se sobrar valor não alocado, mostra alerta
5. Ambas as transações são criadas em `transacoes_financeiras` com um campo extra `tipo_troca` (`prestador_trocado` ou `prestador_substituto`) e `justificativa_troca`

## Alterações Técnicas

### 1. Migração SQL — adicionar campos à `transacoes_financeiras`
- `tipo_troca TEXT` — valores: `prestador_trocado`, `prestador_substituto`, ou NULL (normal)
- `justificativa_troca TEXT` — justificativa do operador para a divisão de valores
- `ficha_troca_ref TEXT` — referência à outra transação da mesma troca (para vincular o par)

### 2. Novo componente `TrocaPrestadorPagamentoDialog.tsx`
Dialog com dois passos sequenciais (step 1 e step 2):
- **Step 1 (Prestador Anterior)**: Mostra nome do prestador, valor total da ficha como referência, input para valor a pagar, campo de justificativa
- **Step 2 (Prestador Substituto)**: Mostra o restante automático (total - valor anterior), input editável com aviso se exceder/sobrar, campo de justificativa
- Ao confirmar o Step 2, cria as duas transações no banco

### 3. Atualizar `TrocarPrestadorDialog.tsx`
- Após a troca bem-sucedida, se o status da ficha for "Agendado", abrir o novo `TrocaPrestadorPagamentoDialog` em vez de simplesmente fechar
- Passar os dados de ambos os prestadores e da ficha

### 4. Atualizar `PagamentoPrestadoresTabV2.tsx`
- Na query de `transacoes_financeiras`, incluir os novos campos `tipo_troca` e `justificativa_troca`
- Nos cards de pagamento pendente: exibir badge "Prestador Trocado" (laranja) ou "Prestador Substituto" (azul) quando `tipo_troca` não for null
- Ao clicar no badge, exibir popup com a justificativa

### 5. Salvar histórico na ficha
- Registrar no `prestador_historico` os dados da divisão de pagamento (valores, justificativas) em `dados_extras`
- Consultável na aba Histórico da ficha (`FichaDetalhes`)

## Detalhes da Lógica de Valores

- Valor de referência = `valor_total` da ficha (mão de obra + peças)
- Operador digita livremente o valor do 1º prestador
- Valor restante = referência - valor digitado no step 1
- Se step 2 exceder o restante → aviso amarelo "Valor excede o restante"
- Se step 2 for menor que o restante → aviso "R$ X não alocado"
- Ambos os valores são salvos independentemente (o sistema não bloqueia, apenas avisa)

## Impacto
- Apenas fichas com status "Agendado" disparam o fluxo de pagamento dividido
- Fichas com outros status continuam com a troca simples existente
- Duas entradas separadas no Financeiro permitem controle individual de pagamento
- Justificativas ficam registradas e consultáveis

