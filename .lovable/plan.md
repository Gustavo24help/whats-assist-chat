

# Plano: Corrigir popup de atribuição disparando ao enviar mensagem

## Problema encontrado

Quando um operador envia uma mensagem, o código em `enviarMensagem()` (linha 1635-1646 de ChatWindow.tsx) faz auto-atribuição se `atendenteAtual` estiver `null`:

```typescript
if (!atendenteAtual) {
  await atribuirOperador(user.id, ...);
}
```

Isso atualiza `clientes.atendente_id`, o que dispara o Realtime UPDATE. O `AtribuicaoOperadorPopup` escuta esse evento e mostra o popup toda vez que `newRow.atendente_id === user.id && oldRow.atendente_id !== user.id` — sem distinguir se foi **auto-atribuição** ou se **outra pessoa** atribuiu.

Resultado: toda mensagem enviada pelo operador que causa auto-atribuição gera o popup "Conversa atribuída a você" para ele mesmo.

## Solução

Alterar `AtribuicaoOperadorPopup.tsx` para **ignorar auto-atribuições**. A forma mais simples e robusta:

No `AtribuicaoOperadorPopup`, após detectar que `newRow.atendente_id === user.id`, verificar se **quem fez a mudança** é o próprio usuário. Como o Realtime não fornece "quem alterou", usaremos uma abordagem de flag local:

1. **Criar um flag global** (`window.__selfAssignmentInProgress`) que é setado em `true` antes de qualquer auto-atribuição ou "assumir para mim" e resetado logo após.
2. No `AtribuicaoOperadorPopup`, checar esse flag e ignorar o evento se estiver `true`.

Isso cobre:
- Auto-atribuição ao enviar mensagem
- "Assumir para mim" (botão manual)
- Qualquer outra auto-atribuição feita pelo próprio operador

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/components/ChatWindow.tsx` | Setar flag antes/depois de `atribuirOperador` quando é auto-atribuição e em `assumirParaMim` |
| `src/components/AtribuicaoOperadorPopup.tsx` | Checar flag e ignorar evento se auto-atribuição |

## Detalhe técnico

No `ChatWindow.tsx`, antes de chamar `atribuirOperador` na auto-atribuição (linha 1645) e em `assumirParaMim`:
```typescript
(window as any).__selfAssignmentInProgress = true;
await atribuirOperador(user.id, ...);
setTimeout(() => { (window as any).__selfAssignmentInProgress = false; }, 2000);
```

No `AtribuicaoOperadorPopup.tsx`, na condição (linha 36):
```typescript
if (newRow.atendente_id === user.id && oldRow.atendente_id !== user.id) {
  if ((window as any).__selfAssignmentInProgress) return; // ← adicionar
  ...
}
```

## Impacto
- Nenhuma mudança em dados
- Popups de atribuição feita por **outros operadores** continuam funcionando normalmente
- Apenas auto-atribuições (enviar mensagem, assumir) param de gerar popup

