# Pagamentos — Lançamentos Manuais e Busca por ID

## Objetivo
1. Permitir cadastro **manual** de Contas a Pagar (avulsas, sem ficha, com opção de vincular).
2. Exibir **ID curto (8 chars)** em todas as listagens de Contas a Pagar e Receber.
3. Adicionar aba **"IDs"** em ambas (Pagar/Receber) com tabela enxuta e busca por ID.

---

## 1. Banco de Dados

### Nova tabela `contas_pagar_manual`
Para despesas avulsas (não vinculadas a ficha/transação automática). Campos:
- `id` UUID PK
- `descricao` text (obrigatório)
- `categoria` text (ex: aluguel, fornecedor, imposto, outros)
- `beneficiario_nome` text (obrigatório — texto livre)
- `beneficiario_tipo` text (`prestador` | `externo`)
- `prestador_id` text NULL (quando selecionado da base)
- `ficha_id` text NULL (vínculo opcional)
- `valor` numeric(10,2)
- `data_vencimento` date
- `data_pagamento` date NULL
- `forma_pagamento` text (PIX, transferência, dinheiro, boleto, cartão)
- `status` text (`pendente` | `pago` | `cancelado`) default `pendente`
- `observacoes` text
- `criado_por` uuid
- `comprovante_url` text NULL
- `created_at`, `updated_at`

RLS: padrão do projeto — `authenticated` ALL + `anon` ALL (consistente com `contas_receber` / `transacoes_financeiras`).

### Nada a alterar nas tabelas existentes
`transacoes_financeiras` e `contas_receber` já têm `id` UUID — só será exposto na UI.

---

## 2. UI — Contas a Pagar (`PagamentoPrestadoresTabV2.tsx`)

### Novas abas no `Tabs` existente
Adicionar:
- **"Lançamento Manual"** (botão "+ Novo lançamento" abre dialog)
- **"IDs"** (tabela enxuta + busca)

### Dialog `NovoLancamentoManualDialog.tsx` (novo)
Campos:
- Descrição*
- Categoria (Select: Aluguel, Fornecedor, Imposto, Salário, Outros)
- Beneficiário: **Combobox de busca** (digita → busca em `prestadores` por nome/CPF). Se não selecionar, vira texto livre (tipo `externo`).
- Vincular a Ficha (opcional): **Combobox de busca** por ID/nome de ficha.
- Valor (input monetário)
- Data de vencimento
- Forma de pagamento
- Observações
- Upload de comprovante (storage opcional — fase 2)

Salva em `contas_pagar_manual`. Toast de sucesso, atualiza listagem.

### Aba "Pendentes" / "Pagos" existentes
- Adicionar coluna **ID** (primeiros 8 chars, monospace, com botão copiar).
- Mesclar lançamentos manuais (`contas_pagar_manual`) com transações de prestador (`transacoes_financeiras`) na lista pendentes/pagos, distinguindo origem com badge ("Ficha" vs "Manual").

### Aba "IDs" (nova)
Layout enxuto:
- Input grande no topo: "Buscar por ID, beneficiário ou ficha"
- Tabela: `ID | Data | Beneficiário | Valor | Status | [Ver]`
- Busca client-side (já carrega tudo) + filtro por substring case-insensitive nos 8 chars do UUID.
- Click em "Ver" abre modal de detalhes (reaproveita modal existente quando origem é ficha; novo modal simples para manual).

---

## 3. UI — Contas a Receber (`ContasReceber.tsx`)

### Coluna ID
Adicionar coluna **ID** (8 chars + copiar) na tabela principal.

### Aba "IDs" (nova)
Reestruturar página com `Tabs`:
- **Tab "Lista"** = conteúdo atual (filtros + tabela completa).
- **Tab "IDs"** = busca dedicada por ID.

Mesmo padrão da aba IDs de Contas a Pagar: input de busca + tabela enxuta `ID | Data | Cliente | Valor | Status | [Ver]`.

---

## 4. Componente reutilizável
`src/components/financeiro/BuscarPorIdTab.tsx` — recebe array genérico + mapeamento de campos, renderiza input + tabela enxuta. Usado em Pagar e Receber.

`src/components/ui/IdBadge.tsx` — exibe `id.slice(0,8)` com botão copiar (clipboard) e tooltip com UUID completo.

---

## 5. Combobox de busca (autocomplete)
Usar shadcn `Command` + `Popover` (já presente em `components/ui/command.tsx`):
- `BuscarPrestadorCombobox` — query em `prestadores` (limite 50, ordenado por nome, debounce 200ms).
- `BuscarFichaCombobox` — query em `fichas_de_servico` por `id` ou `nome_cliente`.

---

## 6. Salvaguardas (project-knowledge)
- **Sem alteração** em dados existentes de `transacoes_financeiras` ou `contas_receber`.
- Nova tabela é aditiva — nada migra.
- Lançamentos manuais **não** entram nos KPIs financeiros existentes (Revenue/Lucro Bruto continuam usando `transacoes_financeiras` como hoje). Aparecem só nas listas de Contas a Pagar.

---

## Arquivos
**Criar:**
- `supabase/migrations/<ts>_contas_pagar_manual.sql`
- `src/components/financeiro/NovoLancamentoManualDialog.tsx`
- `src/components/financeiro/BuscarPorIdTab.tsx`
- `src/components/financeiro/BuscarPrestadorCombobox.tsx`
- `src/components/financeiro/BuscarFichaCombobox.tsx`
- `src/components/ui/IdBadge.tsx`

**Editar:**
- `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` (abas + coluna ID + merge de manual)
- `src/pages/ContasReceber.tsx` (Tabs com aba IDs + coluna ID)
