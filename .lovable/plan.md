## Como a exposição acontece (demonstração real)

A tabela `clientes` tem políticas RLS para o papel `anon` com `USING (true)`. Isso significa que **qualquer pessoa na internet, sem login**, usando apenas a chave pública (`anon key`) que está no JS do site, consegue ler/inserir/atualizar todos os 1.337 clientes.

Acabei de testar agora, em modo leitura, batendo direto no endpoint público do Supabase (sem nenhum login):

```
GET https://halqtsowfqkczvlvwmdd.supabase.co/rest/v1/clientes
?select=nome,telefone,cpf,endereco,bairro,notas_internas
Header: apikey: <anon key — visível no bundle do site>
```

Resposta recebida:
```json
[
  {"nome":"Franco","telefone":"whatsapp:+554388010804",
   "cpf":"01019177918","endereco":"Av Visconde de Guarapuava, 2305 AP 507", ...},
  {"nome":"Byanca✨","telefone":"whatsapp:+554199308441", ...}
]
```

Ou seja: **CPF, telefone, endereço, nome, notas internas e tags de todos os clientes** estão disponíveis publicamente. Um concorrente, ex-funcionário ou bot de scraping pode baixar o banco inteiro paginando 1000 em 1000. Pior: as políticas `anon` também permitem `INSERT` e `UPDATE`, então é possível **alterar dados** (mudar telefone, sobrescrever notas, criar clientes falsos) sem autenticação.

### Por que está assim hoje
A memória do projeto registra: `RLS OPEN para 'anon' em tabelas operacionais para Make.com / webhooks`. Tentativas anteriores de fechar quebraram integrações. Então qualquer correção precisa preservar:
- Webhooks externos (Twilio, Make, Asaas) que escrevem em `clientes`.
- Edge functions internas (`twilio-webhook`, `submit-orcamento`, `public-orcamento-data`, etc.).
- Formulário público de orçamento (rota `/orcamento/:fichaId`).

---

## Plano de correção (seguro, sem quebrar integrações)

### Passo 1 — Auditar quem realmente usa `anon` na tabela `clientes`
Antes de remover qualquer policy, listar:
- Quais Edge Functions hoje fazem query em `clientes` usando a anon key vs. service role key.
- Se o formulário público (`OrcamentoPublico.tsx` / `public-orcamento-data`) lê de `clientes` direto ou via edge function.
- Confirmar se Make.com / Twilio batem direto no PostgREST com anon key ou se passam por uma edge function nossa.

Resultado esperado: lista pequena de pontos legítimos que precisam de write/read anônimo.

### Passo 2 — Mover qualquer integração externa para `service_role` em Edge Functions
Para cada ponto legítimo encontrado no passo 1:
- Se for um webhook externo (Make, Twilio, Asaas): garantir que ele chama nossa Edge Function (não o PostgREST direto). A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` internamente, que ignora RLS.
- Se hoje algum webhook bate direto no `rest/v1/clientes` com a anon key, criar uma edge function intermediária (padrão já usado em `public-orcamento-data` e `submit-orcamento`).

### Passo 3 — Remover as policies `anon` da tabela `clientes`
Migration removendo apenas as 3 policies do papel `anon`:
- `Anon pode ver clientes` (SELECT)
- `Anon pode inserir clientes` (INSERT)
- `Anon pode atualizar clientes` (UPDATE)

Mantém intactas:
- As policies `authenticated` (atendentes continuam funcionando normal pelo app).
- A policy `service_role` (edge functions e webhooks via edge continuam funcionando).

### Passo 4 — Validação imediata pós-deploy
- Refazer o mesmo `curl` anônimo do teste acima → deve retornar `[]` ou erro de permissão.
- Logar no app como atendente → conversas, fichas e contatos devem carregar normal.
- Testar fluxos críticos: receber mensagem nova via Twilio (webhook), enviar formulário público de orçamento, receber webhook do Asaas.
- Monitorar logs das Edge Functions por 24h para pegar qualquer integração esquecida.

### Passo 5 — Plano de rollback
Manter pronta uma migration reversa que recria as 3 policies `anon`, caso alguma integração crítica que não mapeamos quebre. Aplicar em < 5 min se algo quebrar em produção.

### Passo 6 (opcional, recomendado) — Aplicar o mesmo padrão para outras tabelas críticas
O scanner também aponta exposição igual em `prestadores` (CPF, PIX, conta bancária), `fichas_de_servico`, `mensagens`, `transacoes_financeiras`, `nps_respostas`. O mesmo plano vale para elas, mas podemos fazer **uma tabela por vez** começando pela `clientes` para reduzir risco.

---

## Resumo executivo (para você decidir)

- **Risco hoje:** vazamento total de PII de 1.337 clientes (CPF, endereço, telefone) + possibilidade de adulteração. Qualquer pessoa com a URL do app consegue.
- **Causa:** policies RLS deixadas com `anon = true` em 2025 para destravar Make/Twilio.
- **Correção:** mover integrações externas para edge functions (que usam service role) e remover acesso anônimo. Sem mudança na UI, sem mudança no fluxo do atendente.
- **Tempo estimado:** Passos 1–5 só para `clientes` ≈ 1 ciclo de implementação + validação. Passo 6 (outras tabelas) pode ser feito depois, em ondas.

Posso começar pelo Passo 1 (auditoria) assim que você aprovar — ainda em modo plano, só leitura, sem mexer em nada.