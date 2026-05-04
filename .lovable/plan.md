Você tem razão em reclamar. Eu não vou fingir que a correção anterior resolveu. Agora eu encontrei um motivo técnico concreto para o comportamento continuar igual.

Diagnóstico objetivo

- O banco tem cerca de 1567 conversas ativas.
- A tabela correta de leitura por operador, `mensagem_leitura_operador`, tem cerca de 1567 registros por operador.
- Mas o frontend busca esses registros assim: `.from('mensagem_leitura_operador').select(...).eq('user_id', user.id)` sem paginação.
- A API retorna por padrão no máximo 1000 linhas.
- Resultado: para centenas de conversas, o navegador não recebe o `last_read_at`, então acha que não existe leitura e recalcula a bolinha como não lida logo depois do clique.
- Isso explica exatamente o sintoma: você clica, a bolinha some por estado local, a lista recarrega, os dados vêm incompletos e a bolinha volta.

Também encontrei um resíduo antigo no banco:

- Ainda existe uma trigger antiga `mark_client_unread_on_new_message` que escreve em `clientes.marcado_nao_lido`, mesmo o sistema novo dizendo que a fonte correta é `mensagem_leitura_operador`.
- Isso não deveria mais participar da regra atual e precisa ser removido para não haver duas fontes conflitantes.

Plano de correção definitiva

1. Parar de calcular não lido no frontend com um mapa incompleto

Criar uma função de banco nova, por operador autenticado, que retorna o estado de não lido de cada conversa diretamente no banco:

```text
get_unread_cliente_state(_telefones text[])
→ cliente_id
→ ultima_data_cliente
→ last_read_at
→ manual_unread
→ total_nao_lidas
→ is_unread
```

Essa função vai fazer o join direto com `mensagem_leitura_operador` usando o usuário logado, sem depender de o frontend carregar 1000 ou 1567 linhas.

2. Atualizar as listas de conversa para usar essa função

Alterar:

- `src/components/ConversationList.tsx`
- `src/components/ConversationListBeta.tsx`
- `src/components/mobile/MobileConversationList.tsx`

Para que a bolinha venha de uma única regra calculada no banco:

```text
não lida = manual_unread = true
         OU existe mensagem do cliente após last_read_at
```

Assim, abrir a conversa e recarregar a lista não vai mais depender de uma busca truncada.

3. Paginar a lista clássica de clientes

A lista beta já pagina `clientes`, mas a lista clássica ainda não. Vou corrigir a lista clássica para buscar todos os clientes com `.range()` em páginas de 1000, igual já existe no beta.

Isso evita outro problema parecido: qualquer lógica sobre conversas acima da linha 1000 ficar inconsistente.

4. Remover a fonte antiga global de não lido

Criar migration para:

- Derrubar a trigger antiga `on_new_client_message_mark_unread`.
- Transformar/remover a função antiga `mark_client_unread_on_new_message`, se não for mais usada.
- Limpar `clientes.marcado_nao_lido = false` e `marcado_nao_lido_manual_em = null`.

A partir daí, `clientes.marcado_nao_lido` deixa de interferir de vez.

5. Reset real dos não lidos após corrigir a causa

Depois que a regra estiver correta, fazer um reset controlado:

- Para todo operador ativo × toda conversa ativa:
  - `last_read_at = now()`
  - `manual_unread = false`
  - `manual_unread_at = null`
- Não alterar mensagens.
- Não alterar fichas.
- Não alterar financeiro.
- Não alterar horários de agendamento.
- Não alterar status de atendimento.

6. Verificação antes de entregar

Rodar consultas de verificação para confirmar:

- Quantidade de registros de leitura por operador = quantidade de conversas ativas.
- `manual_unread = 0` após reset.
- `is_unread = 0` para todos logo após reset.
- Uma nova mensagem real do cliente volta a gerar bolinha normalmente.
- Abrir a conversa remove a bolinha e ela não volta no refresh seguinte.

Resultado esperado

- As bolinhas antigas somem de verdade.
- Ao clicar em uma conversa, a bolinha não volta sozinha.
- Mensagens novas de clientes continuam criando não lido.
- Marcar manualmente como não lida continua funcionando.
- O sistema não depende mais de carregar milhares de linhas no navegador para decidir se está lido ou não.

Se você aprovar, eu implemento exatamente isso. Esta correção mexe apenas no sistema de leitura/não leitura do chat e no reset desses indicadores.

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>