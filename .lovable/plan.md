
# Plano de Implementacao — Modulo Financeiro Completo

## Resumo

O modulo financeiro ja possui uma base funcional: a pagina de **Pagamentos do Dia** (`/financeiro`) para liquidacao de prestadores, o **PopupConfirmacaoFinanceira** para calculo e registro de transacoes, e o **ReciboGenerator** para PDFs. Este plano visa consolidar e expandir essa base com as funcionalidades que foram definidas anteriormente.

---

## O que ja existe e sera MANTIDO (sem alteracoes)

- `PopupConfirmacaoFinanceira` — calculo com arredondamento para 8, margem de 23%, compensacao de adiantamentos, conta corrente, webhook Make.com
- `ReciboGenerator` — geracao de PDF com logo, CNPJ, selo PAGO
- `transacoes_financeiras`, `adiantamentos`, `conta_corrente_prestador`, `descontos_ajustes` — tabelas ja criadas
- Edge functions `webhook-financeiro` e `update-pagamento` — ja funcionais
- Logica de negocio (2 dias uteis, material pago pela 24help, etc.)

---

## Melhorias a Implementar

### 1. Pagina Financeiro expandida com abas

Transformar `/financeiro` de uma pagina so de "pagamentos do dia" para um hub financeiro com abas:

- **Pagamentos do Dia** (aba atual, mantida como esta)
- **Historico de Transacoes** — lista completa com filtros por periodo, prestador, status
- **Adiantamentos** — gestao de adiantamentos pendentes/compensados
- **Conta Corrente** — extrato por prestador

### 2. Aba Historico de Transacoes

- Tabela com todas as transacoes de `transacoes_financeiras`
- Filtros: data inicio/fim, prestador (busca), status pagamento cliente, status pagamento prestador, categoria
- Colunas: Data Execucao, Ficha, Prestador, Valor Cliente, Valor Prestador, Lucro, Margem %, Status Cliente, Status Prestador
- Totalizadores no rodape: soma de valores, lucro total, margem media
- Exportacao para CSV

### 3. Aba Adiantamentos

- Lista de adiantamentos da tabela `adiantamentos`
- Filtros por status (pendente/compensado), prestador, periodo
- Botao para criar novo adiantamento (dialog simples com prestador, valor, motivo, ficha opcional)
- Badge visual: pendente (amarelo), compensado (verde)
- Total de adiantamentos pendentes em destaque

### 4. Aba Conta Corrente

- Selecionar prestador via dropdown/busca
- Exibir extrato da tabela `conta_corrente_prestador` ordenado por data
- Debitos e creditos com cores distintas
- Saldo atual em destaque
- Filtro por periodo

### 5. KPIs financeiros no topo

Cards de resumo visivel em todas as abas:
- Total Recebido (clientes pagos no mes)
- Total Pago (prestadores pagos no mes)  
- Lucro Bruto do Mes
- Margem Media
- Adiantamentos Pendentes (valor total)

---

## Detalhes Tecnicos

### Arquivos a criar
- `src/components/financeiro/FinanceiroTabs.tsx` — componente de abas principal
- `src/components/financeiro/HistoricoTransacoes.tsx` — tabela com filtros
- `src/components/financeiro/AdiantamentosTab.tsx` — gestao de adiantamentos
- `src/components/financeiro/ContaCorrenteTab.tsx` — extrato por prestador
- `src/components/financeiro/FinanceiroKPIs.tsx` — cards de resumo
- `src/components/financeiro/NovoAdiantamentoDialog.tsx` — dialog para criar adiantamento

### Arquivo a editar
- `src/pages/Financeiro.tsx` — refatorar para usar o sistema de abas, movendo o conteudo atual para a aba "Pagamentos do Dia"

### Banco de dados
- Nenhuma alteracao necessaria — todas as tabelas ja existem (`transacoes_financeiras`, `adiantamentos`, `conta_corrente_prestador`, `descontos_ajustes`)
- Policies RLS ja estao configuradas para todas elas

### Padrao de queries
- Usar `supabase.from(...)` direto (mesmo padrao ja usado no projeto)
- Paginacao para historico (limite de 50 por pagina)
- Filtros aplicados no `.select()` com `.gte()`, `.lte()`, `.eq()`, `.ilike()`

### Exportacao CSV
- Gerar CSV client-side com os dados filtrados do historico
- Download via `Blob` + `URL.createObjectURL`

### Protecao de dados existentes
- Todas as operacoes de leitura: nenhum risco
- Criacao de adiantamento: INSERT apenas, nao altera dados existentes
- Nenhuma migracao de dados — leitura pura das tabelas existentes

---

## Ordem de implementacao

1. Criar componente de KPIs financeiros
2. Criar aba Historico de Transacoes (tabela + filtros)
3. Criar aba Adiantamentos (lista + dialog de criacao)
4. Criar aba Conta Corrente (extrato por prestador)
5. Refatorar Financeiro.tsx para integrar tudo com abas
