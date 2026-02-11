

## Corrigir erro de autenticação no envio de WhatsApp ao aprovar orçamento

### Problema identificado

Quando a Valentina aprovou um orçamento, o status foi atualizado com sucesso na ficha, mas o envio da mensagem WhatsApp falhou com erro 401 (não autorizado). Os logs confirmam duas chamadas `send-whatsapp` com retorno 401 no horário em que ela usou o sistema.

**Causa raiz:** O componente `AprovacaoOrcamentoDialog.tsx` usa `supabase.auth.getSession()` para obter o token, mas esse método pode retornar um token expirado sem fazer o refresh automático. O correto é usar `supabase.auth.getUser()` que sempre valida e renova o token, ou usar `supabase.functions.invoke()` que já lida com autenticação automaticamente.

### Correção

**Arquivo:** `src/components/AprovacaoOrcamentoDialog.tsx`

Substituir o `fetch` manual com token por `supabase.functions.invoke("send-whatsapp", ...)`, que:
- Gerencia automaticamente o token de autenticação
- Faz refresh do token se necessário
- Simplifica o código

**De (atual):**
```typescript
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ to: clienteTelefone, message: mensagem }),
  }
);
```

**Para (corrigido):**
```typescript
const { data, error } = await supabase.functions.invoke("send-whatsapp", {
  body: { to: clienteTelefone, message: mensagem },
});
```

### Impacto

- Sem alteração no banco de dados
- Sem impacto em dados existentes
- Apenas melhora a confiabilidade da autenticação ao enviar WhatsApp na aprovação de orçamentos
- Funciona igualmente para todos os usuários (você, Valentina e qualquer outro)

