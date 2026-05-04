Você está certo em desconfiar: hoje o sistema já tem webhook, sync manual e monitor, mas ainda não existe uma “fonte de verdade” visível que compare continuamente o que a Twilio tem com o que entrou no Lovable.

Pelo que encontrei:
- `twilio-webhook` salva mensagens recebidas em `mensagens` / `mensagens_prestadores` e registra alguns eventos em `webhook_debug_logs`.
- `sync-twilio-messages` busca mensagens recentes na Twilio e tenta inserir as que faltam.
- `monitor-mensagens` existe, mas hoje compara apenas um número Twilio principal, filtra de forma antiga e não cobre bem todos os números/rotas.
- `mensagens_backup_queue` existe, mas o webhook atual não usa essa fila quando falha ao salvar.
- O callback de status (`update-message-status`) praticamente só atualiza status de mensagens enviadas e descarta `failed/undelivered` sem gravar diagnóstico rico.

Plano pro próximo passo: transformar isso em um sistema de controle operacional, não só correções pontuais.

## 1. Conectar/usar Twilio pelo conector do Lovable
Vou vincular o conector Twilio ao projeto para que novas chamadas de diagnóstico usem o gateway seguro do Lovable, em vez de depender só de `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` manuais.

Isso ajuda em:
- teste de credencial direto;
- menos risco de token antigo/errado;
- padronização das consultas de mensagens;
- base para um botão “Testar Twilio” dentro do app.

Não vou alterar o envio principal de mensagens neste primeiro passo para evitar risco em produção.

## 2. Criar uma reconciliação robusta Twilio x Lovable
Vou criar/ajustar uma função de backend para comparar, em uma janela configurável, as mensagens da Twilio contra o banco do Lovable.

Ela deverá:
- consultar todos os números WhatsApp gerenciados, não apenas um;
- separar cliente x prestador;
- comparar por `MessageSid`;
- retornar mensagens presentes na Twilio e ausentes no Lovable;
- retornar mensagens no Lovable sem `MessageSid`;
- mostrar divergências por hora, por número Twilio e por rota;
- permitir filtro por telefone do cliente/prestador;
- permitir janela de tempo: 1h, 6h, 24h, 7 dias.

## 3. Criar tabela de auditoria de reconciliação
Vou adicionar uma tabela nova para guardar cada execução de diagnóstico, sem alterar mensagens existentes.

Exemplo do que será salvo:
- período analisado;
- total encontrado na Twilio;
- total encontrado no Lovable;
- quantidade faltando;
- lista dos SIDs faltantes;
- número Twilio envolvido;
- telefone do cliente/prestador;
- status Twilio;
- erro/detalhes quando houver.

Safeguard: essa tabela será apenas de auditoria. Não mexe em horários, status ou conteúdo de mensagens já existentes.

## 4. Reforçar recuperação automática sem duplicar mensagens
Vou evoluir a recuperação para usar `MessageSid` como chave principal.

Comportamento:
- se a mensagem existe no Lovable, não duplica;
- se está faltando, insere com o timestamp original da Twilio (`date_sent`/`date_created`);
- se for mídia, preserva tipo e URL;
- se for prestador, salva na tabela de prestadores;
- se for cliente, salva em `mensagens`;
- se falhar ao inserir, grava na fila `mensagens_backup_queue` com payload e erro.

Safeguard importante: nenhuma mensagem existente será atualizada em massa. A função só insere mensagens comprovadamente ausentes por `MessageSid`, ou marca tentativas na fila de backup.

## 5. Fazer o webhook usar a fila de backup em falhas
Hoje, quando `twilio-webhook` falha ao salvar, ele registra log, mas não necessariamente deixa a mensagem pronta para reprocessamento.

Vou ajustar para:
- registrar payload completo mínimo na fila quando houver erro de insert;
- guardar `MessageSid`, telefone e payload normalizado;
- permitir reprocessamento posterior sem depender do webhook original.

## 6. Melhorar logs de status da Twilio
Vou enriquecer o callback de status para gravar eventos importantes:
- `failed`;
- `undelivered`;
- `ErrorCode`;
- `ErrorMessage`;
- SID sem correspondência no banco;
- status recebido, entregue e lido.

Isso vai para logs internos/auditoria, para você conseguir entender se a mensagem:
- nem chegou no webhook;
- chegou no webhook mas falhou ao salvar;
- foi enviada mas falhou na Twilio;
- existe na Twilio mas não existe no Lovable.

## 7. Criar painel visual em Manutenção/Logs Twilio
Vou adicionar uma área no app para você enxergar isso sem depender de console técnico.

A tela terá:
- botão “Testar conexão Twilio”;
- botão “Comparar últimas 24h”;
- seletor de período;
- campo para buscar por telefone;
- cards com totais Twilio x Lovable;
- lista de mensagens faltantes com `MessageSid`, horário, número, telefone, status e trecho do texto;
- botão “Recuperar faltantes”;
- histórico das últimas reconciliações.

## 8. Corrigir o monitor atual
O `monitor-mensagens` atual usa lógica antiga, especialmente filtro por remetente e número único. Vou atualizar para reaproveitar a lógica nova e evitar falsos positivos/negativos.

## 9. Validação depois da implementação
Depois de implementar, vou testar:
- execução sem filtro nas últimas 24h;
- execução por telefone específico;
- recuperação sem duplicidade;
- callback de status com payload simulado;
- leitura dos resultados no painel.

## Resultado esperado
Você passa a ter um controle objetivo:

```text
Twilio recebeu/enviou X mensagens
Lovable salvou Y mensagens
Faltam Z mensagens
Estas são as mensagens faltantes
Clique para recuperar
Se falhar, fica em fila e mostra o erro
```

Isso não promete que a Twilio nunca falhe, mas elimina o “escuro”: se uma mensagem passou pela Twilio e não apareceu no Lovable, o sistema passa a identificar, listar e recuperar com muito mais segurança.