

## Plano: Sistema de Gatilhos de Template 24h + Contas a Receber

Este plano implementa duas funcionalidades conectadas: (1) detecção automática da janela de 24h do WhatsApp para decidir se envia mensagem normal ou template, e (2) página de Contas a Receber para gestão de cobranças.

---

### Contexto atual

- O sistema **já verifica a janela de 24h** no `send-whatsapp` (linhas 147-189) e retorna `FORA_JANELA_24H` quando fora da janela.
- O `EnviarLinkPagamentoDialog.tsx` **já trata** esse erro mostrando aviso ao operador.
- O `send-template` **já existe** e envia via `contentSid`.
- **Não existe** tabela `contas_receber` nem `whatsapp_envios_rastreamento`.
- **Não existe** campo `ultima_mensagem_recebida` na tabela `clientes` (apenas `ultima_interacao`).

O que falta é: (a) automatizar o fallback para template quando fora da janela, em vez de apenas bloquear, e (b) criar a página de Contas a Receber.

---

### Parte 1: Automatização do envio com fallback para template

**1.1 Migração — campo na tabela clientes**
```sql
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS ultima_mensagem_recebida TIMESTAMPTZ;
```

**1.2 Migração — tabela contas_receber**
```sql
CREATE TABLE contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT REFERENCES fichas_de_servico(id),
  cliente_telefone TEXT NOT NULL,
  cliente_nome TEXT,
  prestador_nome TEXT,
  valor_total NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'aguardando',
  pagamento_link TEXT,
  asaas_id TEXT,
  asaas_status TEXT,
  requer_template BOOLEAN DEFAULT false,
  link_enviado_em TIMESTAMPTZ,
  link_reenvio_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
-- RLS: apenas autenticados
CREATE POLICY "Authenticated users can manage contas_receber"
  ON contas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**1.3 Migração — tabela whatsapp_envios_rastreamento**
```sql
CREATE TABLE whatsapp_envios_rastreamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT,
  conta_receber_id UUID REFERENCES contas_receber(id),
  ficha_id TEXT,
  tipo_envio TEXT, -- 'normal' ou 'template'
  template_sid TEXT,
  status TEXT DEFAULT 'enviado',
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_envios_rastreamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage envios"
  ON whatsapp_envios_rastreamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**1.4 Atualizar `twilio-webhook` — registrar `ultima_mensagem_recebida`**
Quando uma mensagem de cliente chega (direção `client_to_bot`), atualizar o campo `ultima_mensagem_recebida` do cliente com o timestamp atual. Isso complementa o `ultima_interacao` já existente.

**1.5 Atualizar `send-whatsapp` — fallback automático para template**
Em vez de retornar `FORA_JANELA_24H` e bloquear, o `send-whatsapp` passará a aceitar um parâmetro opcional `fallbackToTemplate: true` com `templateContentSid` e `templateVariables`. Se fora da janela e fallback habilitado, ele chama o `send-template` internamente. Se não, mantém o comportamento atual de bloqueio.

**1.6 Atualizar `EnviarLinkPagamentoDialog.tsx`**
Adicionar opção de "Enviar como Template" quando fora da janela, usando um template pré-configurado para link de pagamento, em vez de apenas exibir erro.

---

### Parte 2: Página Contas a Receber

**2.1 Nova página `src/pages/ContasReceber.tsx`**
Adaptação do componente fornecido para a stack do projeto (TypeScript, Supabase client, shadcn/ui). Inclui:
- **3 cards de resumo** no topo: A Receber (azul), Pago (verde), Vencido (vermelho)
- **Filtros**: Status, Período, Cliente, Prestador
- **Tabela**: ID, Cliente, Valor, Vencimento, Pagamento, Status, Ações (ver detalhes)
- **Modal de detalhes**: Info do serviço, info de pagamento, link Asaas, botões (reenviar link, marcar pago, editar vencimento, cancelar)
- Indicador visual de "Requer Template" e "Horas desde última mensagem"

**2.2 Rota e menu**
- `src/App.tsx`: Adicionar rota `/contas-receber`
- `src/components/PageLayout.tsx`: Adicionar item "Contas a Receber" dentro do grupo Financeiro

---

### Visualização da UI (para texto de aviso)

**Contas a Receber** — Tela principal:
- Topo: 3 cards coloridos (A Receber | Pago | Vencido) com valores totais e quantidade
- Abaixo: barra de filtros (Status, Período, Cliente, Prestador)
- Tabela com colunas: Ficha, Cliente, Valor, Vencimento, Pagamento, Status, Ações
- Badge colorido por status: verde (Pago), azul (Aguardando), vermelho (Vencido)
- Clicando em "Ver detalhes" abre modal com resumo, botões de ação e histórico de envios

**Envio de Link de Pagamento** — Melhoria:
- Quando o cliente não respondeu há mais de 24h, aparece aviso amarelo
- Botão "Enviar como Template" disponível automaticamente
- Registro do tipo de envio (normal vs template) para rastreabilidade

---

### Texto para Aviso da Nova Funcionalidade

> **Nova funcionalidade: Contas a Receber**
>
> Agora você pode acompanhar todas as cobranças em um só lugar. Acesse pelo menu Financeiro > Contas a Receber.
>
> - Veja o resumo de valores a receber, pagos e vencidos
> - Filtre por status, período, cliente ou prestador
> - Reenvie links de pagamento diretamente pela tela
> - O sistema detecta automaticamente se o cliente está fora da janela de 24h do WhatsApp e oferece envio via template aprovado
> - Histórico completo de envios (normal ou template) para cada cobrança

---

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| Migração SQL | 3 alterações: campo em clientes, tabela contas_receber, tabela whatsapp_envios_rastreamento |
| `supabase/functions/twilio-webhook/index.ts` | Atualizar `ultima_mensagem_recebida` em mensagens recebidas |
| `supabase/functions/send-whatsapp/index.ts` | Adicionar fallback para template |
| `src/pages/ContasReceber.tsx` | Nova página |
| `src/components/EnviarLinkPagamentoDialog.tsx` | Botão de envio via template |
| `src/App.tsx` | Nova rota |
| `src/components/PageLayout.tsx` | Item no menu |

