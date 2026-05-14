
## Problema

Na janela de chat, ao abrir **Notas Internas** e começar a digitar, o texto é sobrescrito antes do usuário conseguir clicar em "Salvar Notas".

## Causa raiz

Em `ChatWindow.tsx` e `ChatWindowBeta.tsx` existe um polling de 30 s (e outras chamadas) que executa `fetchClienteData()`. Essa função faz:

```ts
setNotasInternas(clienteData.notas_internas || "");
```

Como o `<Textarea value={notasInternas}>` é controlado por esse mesmo state, qualquer recarga durante a digitação substitui o texto pelo valor salvo no banco — exatamente o comportamento relatado ("o que foi escrito é apagado").

A janela de Notas é um diálogo que pode ficar aberto por minutos enquanto o operador escreve. Em ~30 s o polling roda e zera o input.

## Correção

Não recarregar o conteúdo de **notas_internas** enquanto o diálogo de Notas estiver aberto. As demais informações (bot, atendente, ficha ativa) continuam sendo atualizadas normalmente.

Implementação:

1. Em ambos os componentes (`ChatWindow.tsx` e `ChatWindowBeta.tsx`), criar um `notasDialogOpenRef = useRef(false)` e mantê-lo sincronizado com `notasDialogOpen` via `useEffect`. Usar ref evita o problema de closure obsoleta dentro do `setInterval`.
2. Dentro de `fetchClienteData`, envolver as duas linhas que tocam o estado das notas:

   ```ts
   if (!notasDialogOpenRef.current) {
     setNotasInternas(clienteData.notas_internas || "");
     setHasNotas(!!clienteData.notas_internas && clienteData.notas_internas.trim().length > 0);
   }
   ```

3. `salvarNotas` continua igual: ao salvar, fecha o diálogo, e a próxima `fetchClienteData` (ou chamada manual após salvar, se quisermos) repõe o `hasNotas` corretamente. Na prática o próprio `salvarNotas` já atualiza `hasNotas` localmente, então nada quebra.

## Salvaguardas

- Nenhuma alteração no schema, RLS, edge functions ou em `transacoes_financeiras`.
- O valor exibido no Textarea continua vindo do banco na primeira carga (quando o diálogo está fechado).
- Se outro operador editar a nota enquanto o diálogo está aberto, o operador atual mantém o texto local até salvar — comportamento esperado para evitar perda de digitação. Após fechar (cancelar ou salvar), o próximo refresh traz o estado atual do banco.
- Sem efeitos colaterais nos demais campos atualizados por `fetchClienteData` (bot, atendente, ficha ativa).

## Arquivos a alterar

- `src/components/ChatWindow.tsx` — adicionar `notasDialogOpenRef`, sincronizar com `notasDialogOpen`, guardar `setNotasInternas`/`setHasNotas` em `fetchClienteData`.
- `src/components/ChatWindowBeta.tsx` — mesma alteração.

## Validação

1. Abrir uma conversa, abrir o diálogo de Notas, começar a digitar e aguardar > 30 s sem clicar em Salvar — o texto deve permanecer intacto.
2. Salvar — o toast "Notas salvas com sucesso" aparece e o badge `hasNotas` reflete o novo conteúdo.
3. Cancelar sem salvar — ao reabrir o diálogo, o último valor persistido é exibido.
