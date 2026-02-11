
Contexto do problema (por que “demora” mesmo sendo de 30 em 30s)
- Do jeito que está hoje, o “sync-messages” foi criado em: `supabase/functions/_scheduled/sync-messages/index.ts`.
- O runtime de functions não suporta subpastas para publicar uma função. Na prática, só pastas diretamente dentro de `supabase/functions/<nome-da-funcao>/index.ts` viram funções publicadas.
- Resultado: o “sync-messages” não está sendo publicado como função executável, por isso:
  - Você não encontra a função na lista (só aparece `sync-twilio-messages`);
  - Não aparecem logs de `sync-messages`;
  - O “a cada 30 segundos” não está acontecendo, então parece que está demorando.

Objetivo
- Fazer a função “sync-messages” existir de verdade (publicada) e rodar o cron a cada 30s, chamando `sync-twilio-messages`.
- Sem mexer em dados existentes (apenas automação de execução).

Plano de correção (implementação)
1) Validar o estado atual no código
   - Confirmar que existe a pasta `supabase/functions/_scheduled/sync-messages/` e que não existe `supabase/functions/sync-messages/`.
   - Confirmar `supabase/config.toml` tem o bloco `[functions."sync-messages"] verify_jwt = false` (já existe).

2) Ajustar a estrutura para uma função publicável
   - Criar a função em uma pasta de 1 nível, exatamente assim:
     - `supabase/functions/sync-messages/index.ts`
   - Copiar o mesmo código do cron para dentro desse `index.ts`.
   - (Opcional recomendado) Remover a pasta antiga `supabase/functions/_scheduled/sync-messages/` para evitar confusão (não será publicada de qualquer forma).

3) Corrigir o `config.toml` para o nome correto (sem aspas, padrão do projeto)
   - Trocar:
     - `[functions."sync-messages"]`
   - Para:
     - `[functions.sync-messages]`
   - Manter:
     - `verify_jwt = false`
   Observação: as aspas costumam funcionar, mas padronizar evita inconsistência e facilita leitura/diagnóstico.

4) Evitar “empilhamento” de execuções (motivo comum de lentidão quando realmente está rodando)
   - Como o cron é de 30 em 30 segundos, se `sync-twilio-messages` demorar mais que 30s, pode acontecer concorrência/overlap (uma execução começa antes da anterior terminar).
   - Implementar um “lock” simples (leve e seguro) usando a própria tabela `twilio_sync_control`:
     - Antes de chamar `sync-twilio-messages`, gravar `sync_in_progress = true` e `sync_started_at = now()`.
     - Se já estiver `sync_in_progress = true` e começou há menos de X segundos (ex.: 120s), pular a execução.
     - No final, marcar `sync_in_progress = false`.
   - Importante: isso não altera mensagens existentes, só adiciona controle de execução (mínimo risco para dados).

5) Deploy e verificação
   - Fazer deploy da função `sync-messages`.
   - Checar logs da função `sync-messages`:
     - Deve aparecer “Sync cron job started” quando o runtime subir.
     - Deve aparecer logs `[CRON] ...` a cada ~30s.
   - Checar logs da função `sync-twilio-messages` para confirmar que está sendo chamada periodicamente.
   - Se ainda parecer “demorado”, medir a duração real do `sync-twilio-messages` (pode estar levando muito tempo por causa de múltiplas chamadas sequenciais para mídias).

Resultados esperados
- A função `sync-messages` passa a aparecer como função no backend.
- Os logs de cron começam a aparecer e a sincronização passa a acontecer em intervalos regulares.
- Se `sync-twilio-messages` estiver pesado, o lock evita execuções simultâneas que dão a impressão de atraso e instabilidade.

Riscos / cuidados com dados
- Não haverá alteração em dados existentes de mensagens/clientes/fichas.
- A única mudança potencial no banco (se aplicarmos o lock) é adicionar colunas de controle no `twilio_sync_control` ou usar campos já existentes. Isso não muda timestamps de mensagens nem “corrige” dados antigos, então não há risco de deslocamento de horário como no caso do timezone.
