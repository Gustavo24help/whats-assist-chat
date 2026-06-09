## Visão geral

Adicionar um botão **"Proposta Comercial"** dentro da conversa (header do `ChatWindow` / `ChatWindowBeta`), visível **apenas quando há ficha vinculada à conversa**. Ao clicar, abre um modal com tudo pré-preenchido da ficha + cliente; operador ajusta e clica em **"Gerar e Baixar"** ou **"Gerar + Enviar no WhatsApp"**. Cada geração vira uma versão salva no histórico, com link público de aceite digital.

Reaproveita 100% do padrão de `send-recibo` (pdf-lib + Helvetica + paleta verde 24help) e do `submit-orcamento` (rota pública). Não altera nada de bot, finanças, status ou orçamento atual.

## Fluxo do usuário

1. Operador abre conversa com ficha vinculada → vê botão **"Proposta"** no header.
2. Clica → modal carrega:
   - Cabeçalho 24help fixo (logo, CNPJ, contato).
   - Dados do cliente da ficha (nome, CPF, endereço, telefone) — editáveis.
   - Itens em linhas: descrição / quantidade / valor unitário — pré-preenchidos com mão de obra + peças da ficha. Botão "+ Adicionar item".
   - Subtotal calculado, campo de desconto, total.
   - Prazo de execução, garantia (padrão 90 dias), validade da proposta (padrão 7 dias).
   - Forma de pagamento (texto livre).
3. Dois botões finais:
   - **Baixar PDF** — chama edge function, recebe PDF, salva versão, faz download.
   - **Gerar + Enviar no WhatsApp** — mesma geração + envia como mídia anexa na conversa atual via `send-whatsapp`, registrando mensagem no chat.
4. PDF entregue ao cliente contém QR code + link curto `/proposta-aceite/:token`. Cliente abre, digita nome e clica **"Aceitar proposta"** → grava `aceita_em`, `aceita_por_nome`, `aceita_ip`.
5. No header da conversa aparece selo **"✅ Proposta aceita em DD/MM HH:MM"** quando aceita; antes disso, **"📄 Proposta enviada — aguardando aceite"**.

## Banco de dados (1 migration, aditivo)

**Tabela `propostas_comerciais`:**
- `id` uuid PK
- `ficha_id` uuid FK → `fichas_de_servico.id` (não-nulo)
- `cliente_id` uuid FK → `clientes.id` (nullable)
- `numero` text — formato `PROP-2026-NNNNN` (sequencial via sequence)
- `versao` int — incremental por `ficha_id`
- `dados_snapshot` jsonb — cliente + itens + totais + textos no momento da geração (imutável)
- `valor_total` numeric(12,2)
- `validade_dias` int default 7
- `pdf_storage_path` text — `propostas/{ficha_id}/{id}.pdf`
- `aceite_token` text único (gen_random_uuid hex)
- `aceita_em` timestamptz nullable
- `aceita_por_nome` text nullable
- `aceita_ip` text nullable
- `enviada_whatsapp` boolean default false
- `enviada_em` timestamptz nullable
- `criado_por` uuid (auth.uid()) / `criado_por_nome` text
- `created_at` / `updated_at`

GRANTs: `authenticated` (SELECT/INSERT/UPDATE), `service_role` ALL, `anon` SELECT apenas via política que filtra por `aceite_token` (necessário para página pública de aceite).

RLS:
- `authenticated`: SELECT/INSERT/UPDATE livre (padrão das tabelas operacionais).
- `anon`: SELECT apenas quando consultando por `aceite_token` específico (política `USING (true)` é o padrão do projeto; o controle real é via Edge Function pública).
- UPDATE pelo `anon` é **bloqueado** — aceite roda via edge function `aceitar-proposta` (service_role).

**Bucket `propostas`** (privado, criado via `storage_create_bucket`). Download pelo operador via signed URL de 1h; envio ao WhatsApp via signed URL pública temporária (Twilio aceita).

## Edge Functions (3 novas)

1. **`gerar-proposta-pdf`** (JWT obrigatório)
   - Input: `{ ficha_id, dados }` (dados editados pelo operador).
   - Gera PDF com pdf-lib (mesmo estilo `send-recibo`): cabeçalho 24help verde, dados do cliente, tabela de itens, totais, prazo/garantia/validade, QR code do link de aceite (lib `npm:qrcode@1.5.4` → PNG embed), rodapé com `numero` e linha de assinatura.
   - Faz upload no bucket `propostas`.
   - Insere linha em `propostas_comerciais` (calcula `versao = max(versao)+1` para a ficha, gera `numero` via sequence, gera `aceite_token`).
   - Retorna `{ id, numero, versao, pdf_signed_url, aceite_url }`.

2. **`enviar-proposta-whatsapp`** (JWT obrigatório)
   - Input: `{ proposta_id }`.
   - Gera signed URL pública (24h) do PDF.
   - Chama `send-whatsapp` interno com `mediaUrl` + texto curto (`"Olá {nome}, segue sua proposta {numero}. Validade {N} dias. Link: {aceite_url}"`).
   - Marca `enviada_whatsapp=true`, `enviada_em=now()`.

3. **`aceitar-proposta`** (público, sem JWT — padrão `public-orcamento-data`)
   - GET `?token=xxx` → retorna `dados_snapshot` (somente leitura).
   - POST `?token=xxx` com `{ nome }` → grava `aceita_em`, `aceita_por_nome`, `aceita_ip` (extraído do header), com idempotência (não sobrescreve se já aceito).
   - Registra mensagem automática no chat da ficha: `"✅ Proposta {numero} aceita por {nome} em {data}"` (insert em `mensagens` como sistema).

## Frontend

**Novos arquivos:**
- `src/components/proposta/PropostaComercialModal.tsx` — Dialog grande com:
  - Seção "Cliente" (campos editáveis).
  - Seção "Itens" (linhas dinâmicas com `useFieldArray` ou estado local; botões +/-).
  - Seção "Condições" (prazo, garantia, validade, pagamento).
  - Footer: subtotal/desconto/total + botões "Baixar" / "Enviar no WhatsApp".
- `src/components/proposta/PropostaButton.tsx` — botão no header do chat (gated por `ficha_id`).
- `src/pages/PropostaAceite.tsx` — rota pública `/proposta-aceite/:token`, mostra resumo + form de aceite. Adicionar rota em `App.tsx` (fora do guard de auth).
- `src/lib/proposta.ts` — helpers para chamar as 2 edge functions e calcular totais.

**Edição em arquivos existentes (mínima):**
- `src/components/ChatWindow.tsx` e `src/components/ChatWindowBeta.tsx`: inserir `<PropostaButton fichaId={...} />` no header, ao lado dos botões existentes. Apenas adiciona — não remove nada.
- `src/App.tsx`: adicionar `<Route path="/proposta-aceite/:token" element={<PropostaAceite />} />` na lista de rotas públicas (mesmo nível de `/orcamento/:fichaId`).

**Selos de status** no header (gated por última proposta da ficha): badge cinza "📄 Proposta enviada" ou verde "✅ Aceita em DD/MM". Hook leve `usePropostaStatus(fichaId)` consulta `propostas_comerciais` por `ficha_id` ordenado por `created_at desc limit 1`.

## Pré-preenchimento (vem da ficha)

| Campo modal | Origem |
|---|---|
| Nome, CPF, telefone, endereço cliente | `clientes` via `fichas_de_servico.cliente_id` |
| Itens (linhas) | `fichas_de_servico`: linha 1 = "Mão de obra" (valor_mao_obra), linha 2..N = peças cadastradas. Operador pode adicionar/remover/editar. |
| Subtotal | Soma dos itens |
| Total | `Subtotal / 0.77` (margem 23%, conforme regra global), arredondado para final '8' — operador pode sobrescrever |
| Prazo | Data agendada da ficha, se houver |
| Garantia | "90 dias" (padrão editável) |
| Validade | "7 dias" (padrão editável) |
| Pagamento | "À vista no PIX ou cartão em até 10x" (padrão editável) |

## Salvaguardas (não-quebrar)

- Migration apenas **adiciona** tabela + bucket. Nada de `ALTER` em tabelas existentes.
- Cálculo de margem 23% / final '8' segue a regra global registrada em `mem://`.
- Botão só aparece com `ficha_id` presente; sem ficha, não há ponto de entrada.
- Geração nunca altera `fichas_de_servico`, `transacoes_financeiras`, `bot_habilitado`, `status`, `orcamentos` ou qualquer fluxo financeiro.
- Envio via WhatsApp reusa `send-whatsapp` existente; mensagem entra em `mensagens` como qualquer outra (deduplicação atual cobre).
- Aceite público roda em edge function isolada com idempotência (não sobrescreve aceite já registrado).
- `dados_snapshot` é imutável — se a ficha mudar depois, a proposta gerada permanece como estava no momento do envio.

## Fora de escopo (confirmar depois)

- Templates de proposta (modelos salvos para reutilizar).
- Notificação ao operador quando cliente aceita (pode reusar sistema atual de notificações depois).
- Conversão de proposta aceita em `orcamentos` aprovados automaticamente.
- Edição de proposta já enviada (hoje gera nova versão).

## Resumo das mudanças

```text
+ supabase/migrations/<ts>_propostas_comerciais.sql
+ bucket 'propostas' (privado)
+ supabase/functions/gerar-proposta-pdf/index.ts
+ supabase/functions/enviar-proposta-whatsapp/index.ts
+ supabase/functions/aceitar-proposta/index.ts
+ src/components/proposta/PropostaComercialModal.tsx
+ src/components/proposta/PropostaButton.tsx
+ src/pages/PropostaAceite.tsx
+ src/lib/proposta.ts
~ src/components/ChatWindow.tsx          (1 import + 1 botão no header)
~ src/components/ChatWindowBeta.tsx      (1 import + 1 botão no header)
~ src/App.tsx                            (1 rota pública)
```

Confirma para eu implementar?