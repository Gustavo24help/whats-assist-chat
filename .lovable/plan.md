## Problema

O botão "Ajustar Data Finalização" só aparece quando o status da ficha é exatamente `Finalizado`. Quando a ficha avança automaticamente para `Garantia` (após o pagamento), o botão some e o operador perde a capacidade de corrigir a data — mesmo que o registro original de `Finalizado` continue presente em `ficha_status_historico`.

A lógica interna do dialog (`AjustarDataFinalizacaoDialog.tsx`) já busca o histórico pelo `status_novo = 'Finalizado'`, então **funciona normalmente em fichas que estão em Garantia** — só a UI está bloqueando.

## Mudanças (apenas frontend, sem alterar dados)

Estender a condição de exibição do botão/dialog para aceitar também `Garantia`:

1. **`src/components/FichaServicoTab.tsx`**
   - Linha 2705: trocar `ficha.status === 'Finalizado'` por `(ficha.status === 'Finalizado' || ficha.status === 'Garantia')` no bloco do botão.
   - Linha 2757: mesma mudança no bloco de montagem do `<AjustarDataFinalizacaoDialog>`.

2. **`src/pages/Fichas.tsx`**
   - Linha ~200: na lista de fichas, trocar `f.status === "Finalizado"` por `(f.status === "Finalizado" || f.status === "Garantia")` no botão de ajuste rápido.

## Salvaguardas (preservação de dados)

- Nenhuma alteração em banco, triggers, RLS ou edge functions.
- O `AjustarDataFinalizacaoDialog` já preserva hora/minuto/segundo do registro original (não há shift de timezone).
- Já protege transações com `pago` (`.neq("status_pagamento_prestador", "pago")`), então ajustar data em ficha de Garantia **não vai sobrescrever pagamentos já realizados** ao prestador. Apenas transações pendentes serão recalculadas — comportamento correto.
- O webhook `webhook-update-planilha` continua sendo chamado normalmente (não-bloqueante).

## Validação após implementar

- Abrir uma ficha em status `Garantia` → confirmar que botão laranja "Ajustar Data Finalização" aparece.
- Abrir o dialog, escolher nova data, confirmar → verificar toast de sucesso.
- Confirmar no banco que `ficha_status_historico` do `Finalizado` foi atualizado e que transações já `pago` permaneceram intactas.