## Plano

1. **Corrigir a fonte da etiqueta “Bot: Ativado/Desativado” nos dois chats**
   - Ajustar `ChatWindow.tsx` e `ChatWindowBeta.tsx` para considerar o bot desativado quando qualquer um destes campos indicar bloqueio:
     - `bot_snoozed_until` futuro/`infinity`
     - `bot_habilitado === false`
     - `bot_desligado_manualmente === true`
   - Isso resolve o caso mostrado: o backend registra o bot como inativo/manual, mas a etiqueta volta para ativo porque hoje ela olha praticamente só a “soneca”.

2. **Atualizar realtime e recarregamento de dados**
   - Nos dois chats, mudar os selects e listeners de `clientes` para também buscar `bot_habilitado` e `bot_desligado_manualmente`.
   - Assim a etiqueta não “pisca” nem volta errado quando chega atualização em tempo real.

3. **Garantir consistência após clicar em desativar/reativar**
   - Depois do toggle, usar o retorno do backend e/ou uma nova leitura do cliente para atualizar o estado visual com os três campos.
   - Manter a regra atual de segurança para reativação manual com confirmação; não alterar status da ficha, mensagens, histórico nem dados existentes.

4. **Backend mínimo, se necessário**
   - Se o retorno atual de `toggle-bot-status` não trouxer `bot_habilitado`/`bot_desligado_manualmente`, ajustar a função para retornar o estado final completo.
   - Não farei migração de dados para esse problema, porque o dado atual já está correto; o erro é de exibição/sincronização da etiqueta.

## Validação

- Conferir o cliente do print (`whatsapp:+554198751600`) com `bot_habilitado=false` e `bot_desligado_manualmente=true` exibindo `Bot: Desativado` nos dois chats.
- Verificar que ao reativar com confirmação a etiqueta muda para `Ativado`, e ao desativar novamente permanece `Desativado`.