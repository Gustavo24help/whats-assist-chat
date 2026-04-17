

## Entendimento

Hoje o envio do link de pagamento e a mensagem de confirmação podem sair de 2 lugares:

1. **Automático** — `auto-finalizacao` (trigger AFTER UPDATE em `fichas_de_servico` quando status vira "Agendado"/"Finalizado") gera link Asaas + envia mensagem.
2. **Manual** — operador clica em "Gerar/Enviar link" na ficha (`EnviarLinkPagamentoDialog.tsx`) ou envia recibo via `send-recibo`.

Hoje **não há controle** de quantas vezes foi enviado nem **de onde** saiu. O operador pode reenviar sem perceber que o automático já mandou — gerando duplicidade e confusão para o cliente.

## Solução proposta

### 1. Rastreamento de envios (banco)

Adicionar campos em `fichas_de_servico` (ou usar `notas` parsing — mas campos dedicados são melhor):

| Campo | Tipo | Descrição |
|---|---|---|
| `link_pagamento_envio_count` | int default 0 | Quantas vezes o link foi enviado |
| `link_pagamento_ultimo_envio_em` | timestamptz | Timestamp do último envio |
| `link_pagamento_ultimo_envio_origem` | text | `'automatico'` ou `'manual'` |
| `link_pagamento_ultimo_envio_por` | uuid | user_id (null se automático) |
| `recibo_envio_count` | int default 0 | Já existe `recibo_enviado` boolean — adicionar contador |
| `recibo_ultimo_envio_origem` | text | `'automatico'` ou `'manual'` |
| `recibo_ultimo_envio_por` | uuid | user_id |

Default 0 / null preserva todas as fichas existentes — nenhum dado é alterado.

### 2. Registrar origem em todos os pontos de envio

- `auto-finalizacao/index.ts` → ao enviar, incrementa contador com origem `'automatico'`.
- `EnviarLinkPagamentoDialog.tsx` → ao enviar, incrementa com `'manual'` + user_id.
- `send-recibo` (quando chamado pelo webhook Asaas) → origem `'automatico'`.
- Botão manual de "Enviar recibo" (se existir, ou criar) → origem `'manual'`.

### 3. Aviso de confirmação no manual

No `EnviarLinkPagamentoDialog` (e no fluxo manual de recibo), **antes de abrir o dialog de envio**, fazer um SELECT no count. Se `> 0`:

- Mostrar `AlertDialog` com:
  - "Este link já foi enviado **N vez(es)**."
  - "Último envio: **DD/MM HH:mm** por **[automático | nome do operador]**."
  - Botões: **"Cancelar"** / **"Reenviar mesmo assim"**.

Só após confirmar, abre o `EnviarLinkPagamentoDialog` normal.

### 4. Indicador visual na ficha

Pequeno badge na seção de pagamento da ficha:
- "Link enviado 1× (automático)" ou "Link enviado 2× (último: manual por João)".
- Ajuda o operador a ver de relance sem precisar abrir o dialog.

## Arquivos afetados

- **Migration nova** — adicionar 6 colunas em `fichas_de_servico` (com defaults seguros, nada quebra).
- `supabase/functions/auto-finalizacao/index.ts` — gravar origem `automatico` ao enviar.
- `supabase/functions/asaas-webhook/index.ts` — gravar origem `automatico` ao disparar recibo.
- `supabase/functions/send-recibo/index.ts` — receber parâmetro `origem` opcional; default `automatico`.
- `src/components/EnviarLinkPagamentoDialog.tsx` — incrementar contador como `manual` + user_id ao enviar.
- `src/components/FichaServicoTab.tsx` (ou onde abre o dialog de link) — pré-check com `AlertDialog` se já houve envio.
- Componente novo opcional: `ConfirmReenvioDialog.tsx` reutilizável para link e recibo.

## Validação anti-regressão

- Defaults de coluna = 0/null → fichas antigas seguem funcionando, exibem "primeiro envio" no fluxo manual sem aviso.
- Nenhum envio é bloqueado — só adiciona uma confirmação extra.
- Contador é **incremento aditivo** — não altera dados financeiros nem status.
- O envio automático continua funcionando; só passa a registrar origem.

## Pergunta antes de implementar

Apenas uma dúvida para garantir que entrego o que você quer:
