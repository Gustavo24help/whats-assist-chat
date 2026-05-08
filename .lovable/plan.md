# Plano

## 1. `supabase/functions/processar-pagamento/index.ts`
- Remover bloco que valida `x-webhook-secret` contra `PAGAMENTO_WEBHOOK_SECRET`.
- Não adicionar `[functions.processar-pagamento] verify_jwt = false` em `supabase/config.toml` (atualmente está listado como `verify_jwt = false` — **remover essa entrada** para que a função volte ao default `verify_jwt = true` e seja protegida pelo JWT do Supabase).
- Manter todo o restante da lógica intacta (lookup do prestador, contas_receber, audit, acionamento de auto-finalizacao).
- Redeploy da função após alteração.

## 2. `src/components/FichaServicoTab.tsx`
- Localizar `enviarWebhook` e o ponto após `✅ WEBHOOK ENVIADO COM SUCESSO`.
- Adicionar chamada fire-and-forget:
  ```ts
  supabase.functions.invoke('processar-pagamento', { body: webhookPayload })
    .then(({ error }) => {
      if (error) console.warn('[processar-pagamento] Erro (não bloqueante):', error);
      else console.log('[processar-pagamento] ✅ Processado com sucesso');
    })
    .catch((e) => console.warn('[processar-pagamento] Falha silenciosa:', e));
  ```
- Garantir que `supabase` já está importado no arquivo (verificar import de `@/integrations/supabase/client`); se não estiver, adicionar.
- Não alterar nada do fluxo principal do Make.

## Salvaguardas
- Chamada é fire-and-forget: não usa `await` e não interrompe o fluxo Make existente.
- Remoção do header secret não afeta callers (não havia caller em produção; era apenas a proteção da função).
- Reativar JWT padrão fecha a função para chamadas externas anônimas, que era o objetivo.
