<final-text>Diagnóstico fechado

O que eu confirmei no backend agora:
- Hoje, a tabela `public.fichas_de_servico` está sem trigger ativa. A consulta em `information_schema.triggers` voltou vazia para essa tabela.
- A função `public.trigger_auto_finalizacao()` existe no banco, mas não está conectada à tabela.
- A ficha `FGM8@260414` já tem:
  - `status = Agendado`
  - `valor_total = 8`
  - `pagamento_link` preenchido
  - mensagem automática salva em `mensagens`
  - registro em `contas_receber`
  Isso mostra que a automação funcionou quando foi disparada manualmente/reprocessada, não automaticamente.
- A ficha `FGM5@260413` está:
  - `status = Garantia`
  - `pagamento_realizado = true`
  - `recibo_enviado = false`
  - `recibo_url = null`
  Ou seja: o pagamento foi marcado, mas o recibo automático não aconteceu.
- Não há logs recentes de `asaas-webhook` nem de `send-recibo` para esse caso, então o backend não processou essa confirmação de pagamento.

Por que não funcionou
1. Causa principal confirmada
- A automação de cobrança não dispara sozinha porque a trigger não está anexada à tabela no banco real.
- Por isso, mudar a ficha para `Agendado` ou `Finalizado` não chama `auto-finalizacao`.

2. Causa confirmada do caso “Asaas pago, ficha pendente”
- O webhook de pagamento não processou esse pagamento no backend.
- Resultado: a ficha não foi atualizada automaticamente pelo fluxo correto e o recibo também não foi enviado.

3. Problemas estruturais que também causam ou podem causar falhas
- Há migrations conflitantes/inconsistentes:
  - uma versão antiga cria trigger `AFTER UPDATE`
  - outra cria `BEFORE UPDATE` com outro nome
  - no estado atual do banco, nenhuma está ativa
- Se as duas forem aplicadas em algum ambiente, pode haver disparo duplicado.
- `auto-finalizacao` cria `contas_receber` com `insert`, não `upsert`:
  - retries/reprocessamentos podem gerar duplicidade.
- `asaas-webhook` não atualiza `contas_receber` para `pago` nem salva `asaas_id/asaas_status`:
  - mesmo com webhook funcionando, a ficha pode ficar coerente e a conta a receber continuar “aguardando”.
- Fluxos manuais do front quebram consistência:
  - `ContasReceber -> Marcar Pago` atualiza só `contas_receber`
  - `PagamentoClientesTab -> marcarClientePagou` atualiza ficha/transação, mas não fecha todo o fluxo nem envia recibo
  - o checkbox `pagamento_realizado` na ficha permite mexer direto no dado sem passar pelo fluxo completo
- `FGM5@260413` confirma isso: ficou paga, em Garantia, mas sem recibo.
- Falta trilha de auditoria técnica da automação:
  - hoje está difícil saber se falhou no trigger, no HTTP do banco, no webhook externo ou no envio do recibo.

Plano para arrumar
1. Corrigir a origem
- Criar uma migration de saneamento que:
  - remove qualquer trigger antiga/conflitante de cobrança
  - recria uma única trigger oficial
  - usa `AFTER UPDATE` (não `BEFORE`)
  - opcionalmente cobre também `INSERT` para ficha criada já em status elegível

2. Tornar o disparo confiável
- Ajustar `trigger_auto_finalizacao()` para:
  - funcionar para `UPDATE` e, se necessário, `INSERT`
  - registrar logs estruturados de disparo
  - evitar duplicidade
- Validar o retorno do `net.http_post` com rastreio melhor, para não ficar falha silenciosa.

3. Tornar a cobrança idempotente
- Em `auto-finalizacao`:
  - trocar `insert` em `contas_receber` por `upsert`/atualização por `ficha_id`
  - salvar também metadados do pagamento quando existirem
  - impedir duplicação de conta e de envio em reprocessos

4. Fechar corretamente o fluxo do pagamento
- Em `asaas-webhook`:
  - além de marcar `pagamento_realizado` e mover para `Garantia`
  - atualizar `contas_receber.status = pago`
  - preencher `data_pagamento`, `asaas_id`, `asaas_status`
  - manter atualização de transação financeira
  - disparar `send-recibo`
  - registrar idempotência por `payment.id`/evento para evitar reprocesso duplo

5. Fechar os buracos dos fluxos manuais
- Substituir atualizações manuais espalhadas por um único fluxo backend de “confirmar pagamento”.
- Fazer os pontos manuais do front chamarem esse fluxo único.
- Interceptar também o checkbox `pagamento_realizado` com aviso forte e caminho correto, para não deixar o operador “marcar pago” pela metade.

6. Recuperar os casos quebrados
- Reprocessar `FGM5@260413`:
  - garantir conta/estado financeiro coerentes
  - gerar/enviar recibo faltante
  - registrar auditoria correta
- Validar `FGM8@260414`:
  - confirmar que o disparo foi reprocessado e não veio do trigger
  - deixar o histórico consistente

7. Adicionar observabilidade
- Criar uma tabela simples de auditoria da automação, por exemplo:
  - ficha_id
  - etapa (`trigger`, `auto_finalizacao`, `webhook_pagamento`, `recibo`)
  - status (`started`, `success`, `error`, `skipped`)
  - detalhe/erro
  - timestamps
- Isso evita novo “não aconteceu nada” sem explicação.

8. Teste final
- Testar ponta a ponta:
  - ficha criada com valor
  - mudar para `Agendado`
  - link gerado
  - mensagem enviada
  - pagamento confirmado
  - ficha vai para `Garantia`
  - `contas_receber` vai para `pago`
  - recibo enviado
- Testar também:
  - fora da janela de 24h
  - retry por mudança de valor
  - tentativa manual do operador
  - reprocessamento sem duplicar

Detalhes técnicos importantes
- O principal erro não é “valor 0”; no estado atual, o problema raiz é ausência de trigger no banco real.
- A migration recente com `BEFORE UPDATE` não é a forma ideal para esse caso; o correto aqui é disparar após a atualização estar persistida.
- Vou implementar com salvaguarda para não alterar datas/horários existentes nem mexer em registros antigos além do necessário para corrigir inconsistências já quebradas.</final-text>