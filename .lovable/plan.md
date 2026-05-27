## Objetivos

1. Acabar com o limite de 1000 linhas que faz fichas/orçamentos sumirem.
2. Voltar a permitir arrastar/colar imagem fora da janela de mensagens (na lateral da ficha, lista de conversas, etc.).
3. Acelerar o carregamento do Chat.

---

## 1. Velocidade + fim do limite (RPCs no banco)

Hoje o `ConversationListBeta` faz, para cada lote de 500 telefones, várias páginas de `.range(0..999, 1000..1999, …)` em `mensagens`. Com ~70k mensagens isso vira centenas de round-trips e trava o navegador.

A solução é deixar o banco fazer a agregação. Crio duas funções `STABLE SECURITY DEFINER`:

- `get_ultima_msg_cliente(_telefones text[])` — devolve a data da última mensagem do CLIENTE por telefone (ignora o número Twilio de saída). Usado para janela 24h.
- `get_ultima_msg_qualquer(_telefones text[])` — devolve a última mensagem (qualquer remetente) por telefone com `remetente`, `tipo_remetente`, `operador_nome`. Usado para a tag "última msg por X".

Ambas com `GRANT EXECUTE` a `authenticated`, `anon`, `service_role`. Nenhuma altera regra de negócio, só lê.

No frontend (`ConversationListBeta.tsx`):

- Substituo as duas chamadas `chunkedIn('mensagens', …)` por `supabase.rpc(...)` em lotes de 500 telefones (mesma estratégia do `fetchUnreadStateForUser`).
- Mantenho `chunkedIn` para `fichas_de_servico`, `orcamentos` e `ficha_status_historico` — tabelas menores, onde a paginação interna já protege contra o truncamento de 1000.

Resultado: mesmas informações, sem limite, e o número de requisições cai de centenas para 3–4. O chat destrava e a lista entra cheia.

Nada muda no comportamento, layout, contagem de não-lidas, badges ou regras de negócio. Apenas o transporte das duas consultas de mensagem.

---

## 2. Arrastar/colar imagem fora da janela de mensagens

Hoje `onDragEnter/Over/Leave/Drop` e `onPaste` estão amarrados só ao container das mensagens (`ChatWindowBeta.tsx` linhas 2734 e 3144). Se você solta a imagem na lateral da ficha, na lista ou em qualquer outra área do chat, nada acontece.

Mudança:

- Mover os handlers de drag-and-drop para o wrapper raiz do `ChatWindowBeta` (o `<div>` mais externo do componente), mantendo o overlay visual centralizado sobre a área das mensagens.
- Adicionar `onPaste` no mesmo wrapper raiz (além do textarea), para que Ctrl+V cole imagem mesmo com o foco fora do campo de texto.
- Manter as mesmas regras atuais: bloqueia se `statusConversa === "fechada"` e só aceita image/video/audio/PDF.

Sem alterar o fluxo de upload, validação 24h ou Twilio.

---

## 3. Detalhes técnicos

**Migração SQL (resumo):**

```text
CREATE OR REPLACE FUNCTION public.get_ultima_msg_cliente(_telefones text[])
RETURNS TABLE(cliente_id text, ultima_data_hora timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cliente_id, MAX(data_hora)
  FROM mensagens
  WHERE cliente_id = ANY(_telefones)
    AND remetente <> 'whatsapp:+554138911555'
  GROUP BY cliente_id
$$;

CREATE OR REPLACE FUNCTION public.get_ultima_msg_qualquer(_telefones text[])
RETURNS TABLE(cliente_id text, data_hora timestamptz, remetente text, tipo_remetente text, operador_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (cliente_id) cliente_id, data_hora, remetente, tipo_remetente, operador_nome
  FROM mensagens
  WHERE cliente_id = ANY(_telefones)
  ORDER BY cliente_id, data_hora DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_ultima_msg_cliente(text[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_ultima_msg_qualquer(text[]) TO authenticated, anon, service_role;
```

Índice já existente em `mensagens(cliente_id, data_hora)` cobre as duas (se faltar, crio).

**Arquivos alterados:**
- nova migração SQL (funções acima)
- `src/components/ConversationListBeta.tsx` — troca dos dois `chunkedIn('mensagens', …)` por `rpc` em chunks de 500
- `src/components/ChatWindowBeta.tsx` — move drag/drop/paste para o wrapper raiz

**Salvaguardas (regra do projeto):**
- Nenhuma escrita; só leitura agregada. Não muda dados existentes nem fuso/horários.
- Mesmos campos retornados que o código já consome (`cliente_id`, `data_hora`, `remetente`, `tipo_remetente`, `operador_nome`).
- Lógica de não-lidas, badges, alertas, conversa aberta/fechada e janela 24h ficam inalteradas.
