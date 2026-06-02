## Objetivo

Quando a operadora **Paula** ou **Valentina** enviar mensagem em uma conversa atribuída a outro operador, o sistema deve **assumir automaticamente** a conversa e enviar a mensagem, sem mostrar o AlertDialog de "Tem certeza?".

Para todos os outros operadores, o comportamento atual (popup de confirmação) continua igual.

## Onde está hoje

Existem dois componentes que mostram esse popup quando `isOtherOperatorTicket` é true:

- `src/components/ChatWindowBeta.tsx` — Chat BETA (rota `/chat-beta`, em uso principal)
- `src/components/ChatWindow.tsx` — Chat clássico (ainda usado no mobile / fallback)

Em ambos, o fluxo é:

```text
enviarMensagem() 
  └── se isOtherOperatorTicket → abre AlertDialog (takeoverConfirmOpen)
        └── usuário clica "Sim" → handleConfirmTakeoverAndSend()
              ├── atribuirOperador(currentUser, nome, undefined, true)  ← assume
              └── enviarMensagemReal()                                   ← envia
```

## Mudança

Em **`enviarMensagem()`** (ambos os arquivos), antes de abrir o dialog, verificar o `full_name` do operador logado. Se o primeiro nome (normalizado, sem acento, lowercase) for `paula` ou `valentina`, pular o dialog e executar diretamente o mesmo fluxo do `handleConfirmTakeoverAndSend` (assumir + enviar).

Pseudocódigo:

```ts
const AUTO_TAKEOVER_NAMES = ["paula", "valentina"];

const enviarMensagem = async () => {
  if (isOtherOperatorTicket) {
    const firstName = currentUserFullName
      ?.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().split(/\s+/)[0]?.toLowerCase();

    if (firstName && AUTO_TAKEOVER_NAMES.includes(firstName)) {
      await handleConfirmTakeoverAndSend(); // assume e envia, sem dialog
      return;
    }
    setTakeoverConfirmOpen(true);
    return;
  }
  enviarMensagemReal();
};
```

O `full_name` já é buscado dentro de `handleConfirmTakeoverAndSend` via `profiles`. Vou cachear o `full_name` do usuário atual em um `useRef`/`useState` no mount do componente (já existe lookup parecido em outros pontos) para ter a checagem disponível no momento do clique sem `await` extra.

## Detalhes / salvaguardas

- **Identificação por primeiro nome** (Paula/Valentina) — match exato, sem acento, case-insensitive. Não uso ID hardcoded para não amarrar a uuids específicos; se amanhã elas trocarem de conta o comportamento segue válido pelo nome.
- **Nenhuma mudança no banco**, nas policies ou em edge functions. Só lógica de UI.
- **Outros operadores**: dialog continua aparecendo igual. A função `handleConfirmTakeoverAndSend` permanece intacta (continua sendo chamada pelo "Sim" do dialog).
- **Logs**: a chamada interna `atribuirOperador(..., true)` já registra a troca de dono no histórico — o auto-takeover continua rastreável.
- **Mobile**: `MobileActionsSheet` apenas mostra ações; o envio de mensagem mobile passa pelo `ChatWindow.tsx`, então a mudança lá cobre o mobile também.

## Arquivos a editar

1. `src/components/ChatWindowBeta.tsx` — adicionar lista `AUTO_TAKEOVER_NAMES`, cachear `full_name` do usuário e ajustar `enviarMensagem()`.
2. `src/components/ChatWindow.tsx` — mesma mudança no `enviarMensagem()` equivalente (linha ~1751).

Nada mais é alterado.
