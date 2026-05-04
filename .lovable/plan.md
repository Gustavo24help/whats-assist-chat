
## Objetivo

Gerar um documento (`automacoes-externas-internalizaveis.md` em `/mnt/documents/`) que mapeia, para cada automação externa hoje em uso (Make.com, Twilio Studio, Zoho CRM, Asaas, Google Ads), **o que pode ser trazido para dentro do sistema**, com nível de dificuldade, ganho e riscos.

Nada será alterado em código ainda — é um documento estratégico. Após sua aprovação dos itens prioritários, posso implementar cada migração de forma incremental.

---

## Estrutura do documento

### 1. Resumo executivo
Tabela "semáforo" classificando cada automação externa em:
- 🟢 **Internalizável já** (lógica simples, sem custo extra)
- 🟡 **Internalizável com esforço** (precisa de OAuth, API key ou refactor)
- 🔴 **Manter externo** (Make/Zoho agregam valor real ou risco de regressão alto)

### 2. Análise por automação externa

**A. Make — Cenário "Criar Ficha" (Studio Flow → Make → Supabase + Zoho)**
- 🟢 Parte Supabase: já é só um INSERT em `fichas_de_servico`. Pode virar edge function `criar-ficha-do-bot` chamada direto pelo Studio Flow (elimina hop pelo Make).
- 🟡 Parte Zoho: depende de manter Zoho como CRM. Se for usado ativamente, manter; se for só "espelho", avaliar descontinuar.

**B. Make — `MAKE_WEBHOOK_UPDATE_PLANILHA` (Asaas → Planilha + Zoho)**
- 🟢 **Planilha Google Sheets**: pode ser substituída pelas próprias páginas internas (`PlanilhaControleFinanceiro`, `PlanilhaControlePagamentos`, `ContasReceber`) que já existem e leem do banco. A planilha externa hoje é redundante.
- 🟡 **Zoho update**: se quiser manter sincronia, criar edge function `sync-zoho-deal` chamando API Zoho direto (precisa de OAuth refresh token Zoho).

**C. Make — `MAKE_WEBHOOK_FINANCEIRO` (eventos financeiros)**
- 🟢 **Internalizável 100%**: hoje só replica dados em planilha. Como `transacoes_financeiras` já é fonte da verdade no app (Financeiro/KPIs), o webhook serve apenas para um espelho externo. Pode ser desligado e os relatórios consumidos diretamente do app + export CSV/PDF.

**D. Twilio Studio Flow (bot inicial)**
- 🔴 **Manter** no curto prazo: o Studio é o ponto de entrada do WhatsApp. Migrar o fluxo conversacional inteiro para edge function é viável (`twilio-webhook` já recebe TODAS as mensagens), mas é um projeto grande e arriscado. Recomendação: planejar migração futura para um "router" próprio em edge function que substitua o Studio passo-a-passo.
- 🟢 **Hooks específicos** (`POST_UserMsg`, `POST_TurnBotOff`): já são edge functions nossas. Nenhuma dependência adicional.

**E. Asaas (pagamentos)**
- 🔴 **Manter**: é gateway de pagamento real (PIX/boleto/cartão). Não há como "internalizar" sem virar adquirente. Mas:
- 🟢 **Reduzir acoplamento**: o `asaas-webhook` já está internalizado. O ponto de melhoria é tirar o Make do meio entre Asaas → Planilha (item B).

**F. Google Ads (métricas)**
- 🟡 **Internalizável**: hoje o Make puxa do Google Ads e POSTa em `google_ads_metrics`. Pode-se chamar a API do Google Ads direto de uma edge function `pull-google-ads-metrics` (cron diário). Requer OAuth Google Ads + refresh token. Ganho: elimina cenário Make pago.

**G. Zoho CRM (Contacts + Deals)**
- 🟡 Decisão estratégica: o app já é o CRM operacional (clientes, fichas, prestadores, financeiro). Se o Zoho não tiver uso ativo pelo time comercial, **descontinuar** elimina ~3 cenários Make e o erro `MANDATORY_NOT_FOUND`. Se for usado, criar edge `sync-zoho-deal` direto (API REST Zoho com OAuth).

### 3. Roadmap proposto (ordem de prioridade)

| # | Ação | Esforço | Risco | Ganho |
|---|---|---|---|---|
| 1 | Desligar `MAKE_WEBHOOK_FINANCEIRO` (substituir por relatórios internos) | Baixo | Baixo | Elimina 1 cenário Make |
| 2 | Substituir Google Sheets espelho pela página `PlanilhaControleFinanceiro` | Baixo | Baixo | Elimina dependência da planilha |
| 3 | Edge `criar-ficha-do-bot` (Studio chama direto, sem Make intermediário) | Médio | Médio | Reduz latência + 1 cenário Make |
| 4 | Decidir destino do Zoho CRM (manter via edge própria OU descontinuar) | Médio | Alto se descontinuar errado | Remove fonte do erro Last_Name |
| 5 | Edge `pull-google-ads-metrics` (substituir cenário Make Ads) | Alto (OAuth) | Médio | Elimina mais 1 cenário Make |
| 6 | (Longo prazo) Substituir Twilio Studio por router próprio | Muito alto | Alto | Controle total do bot |

### 4. Recomendações técnicas
- Antes de desligar qualquer webhook Make, monitorar 7 dias com logs em paralelo.
- Toda nova edge que substituir Make precisa de `automation_audit` (já usado pelo `asaas-webhook`).
- Para Zoho/Google Ads OAuth: armazenar refresh token em `secrets`, criar função de renovação automática.

---

## Entregável imediato

Um único arquivo: **`/mnt/documents/automacoes-externas-internalizaveis.md`** seguindo a estrutura acima, pronto para ser usado como base de decisão.

Sem alterações em código nesta etapa.
