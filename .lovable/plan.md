
Objetivo: corrigir a lógica do Financeiro Prestadores para separar corretamente “Pendentes” (prestador ainda não pago por nós) e “Pagos”, e reconstruir `/planilha/controle-financeiro` para espelhar a planilha Excel enviada, sem ficar vazia.

Resumo do diagnóstico
- Os 3 “Pendentes” na `/planilha/controle-pagamentos` são de cliente (`fichas_de_servico.pagamento_realizado`), não de prestador.
- `PagamentoPrestadoresTabV2` hoje mistura duas regras erradas para o seu caso:
  1. usa `updated_at` como corte operacional; como houve atualização em massa recente, isso puxou muitos registros antigos;
  2. considera “pendente” todo item sem transação paga.
- `transacoes_financeiras` está vazia no banco hoje. Por isso:
  - a aba “Pagos” de prestadores não tem base confiável;
  - `/planilha/controle-financeiro` fica vazia, porque ela lê só dessa tabela.
- A `/planilha/controle-financeiro` atual também está incompleta: ela tem 26 colunas, enquanto o Excel oficial tem uma estrutura maior.

Plano de implementação

1. Corrigir a fonte canônica dos pagamentos de prestador
- Criar uma camada compartilhada de montagem dos dados financeiros de prestador.
- Base principal: `fichas_de_servico` + `prestadores` + `clientes` + `categorias` + `transacoes_financeiras`.
- Regra correta:
  - Pendente = ficha elegível para pagamento ao prestador e `status_pagamento_prestador != "pago"` (ou sem transação paga);
  - Pago = `status_pagamento_prestador = "pago"`.

2. Ajustar o Financeiro Prestadores para o fluxo operacional correto
- Em `PagamentoPrestadoresTabV2.tsx`:
  - manter “Pendentes” e “Pagos” como abas separadas;
  - remover a lógica automática de “vencidos” como filtro implícito;
  - manter “mostrar todos” por padrão;
  - deixar o DatePicker apenas como filtro opcional.
- Manter PIX visível e copiável no card e no popup de confirmação.

3. Parar de usar `updated_at` como corte da operação
- Trocar o corte operacional para um campo coerente com o processo:
  - `created_at`/data da ficha para elegibilidade;
  - `data_pagamento_realizada` para histórico de pagos.
- Isso evita que fichas antigas reapareçam só porque foram tocadas por atualização posterior.

4. Reconstruir `/planilha/controle-financeiro`
- Trocar a página para não depender só de `transacoes_financeiras`.
- Montar linhas também para fichas elegíveis sem transação ainda, preenchendo os cálculos com fallback da própria ficha.
- Alinhar o layout com a planilha Excel oficial enviada, incluindo as colunas extras hoje ausentes.

5. Fazer backfill do histórico para não perder registro
- Como `transacoes_financeiras` está zerada, será necessário um preenchimento inicial:
  - importar/migrar o histórico da planilha Excel enviada para recuperar pagamentos já registrados fora do sistema;
  - criar transações faltantes para fichas atuais que já deveriam aparecer no controle financeiro.
- Isso resolve a página vazia e permite separar corretamente “Pendentes” de “Pagos”.

6. Garantir persistência daqui para frente
- Revisar os pontos onde a operação financeira nasce para que toda ficha financeira relevante gere/atualize `transacoes_financeiras` desde o início do processo, e não apenas no momento final do pagamento ao prestador.
- Assim o controle financeiro deixa de depender de planilha externa para existir.

Detalhes técnicos
- Arquivos principais:
  - `src/components/financeiro/PagamentoPrestadoresTabV2.tsx`
  - `src/pages/PlanilhaControleFinanceiro.tsx`
  - novo helper/hook compartilhado para montar os dados financeiros
- Correções específicas da planilha:
  - o filtro atual “pago/pendente” usa status de pagamento do cliente; precisa passar a usar o status do prestador na planilha financeira;
  - a descrição “Dados financeiros de transações confirmadas” deixará de servir, porque a tela precisa mostrar também pendentes ainda não pagos ao prestador.
- Colunas do Excel a espelhar na página:
  - datas, ID, prestador, CPF/CNPJ, PIX, categoria, cliente, telefone, forma/confirmação de pagamento, adiantamentos, taxa visita, MO, peças, taxa 24help, total OS, líquido prestador, desconto, lucro, rentabilidade, status e campos de envio/sincronização.
- Não vejo necessidade de alterar schema para essa correção; o problema principal é lógica de leitura, montagem dos dados e backfill inicial.

Resultado esperado
- `/financeiro` Prestadores:
  - aba “Pendentes” = somente fichas/serviços cujo prestador ainda não foi pago;
  - aba “Pagos” = somente os já pagos;
  - filtro por data opcional, sem esconder registros por padrão.
- `/planilha/controle-financeiro`:
  - deixa de ficar vazia;
  - passa a refletir a estrutura da planilha oficial;
  - registra tanto pendentes quanto pagos com os detalhes necessários para operação.
