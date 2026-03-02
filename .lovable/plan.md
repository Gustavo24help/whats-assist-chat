
# Plano: Conectar o PopupConfirmacaoFinanceira ao fluxo de fichas

## Problema Identificado

O componente `PopupConfirmacaoFinanceira` existe e esta completo, mas **nao e importado nem utilizado em nenhum lugar do app**. Isso significa que:

- Nenhuma transacao financeira e criada
- As tabelas `transacoes_financeiras`, `adiantamentos` e `conta_corrente_prestador` ficam vazias
- As abas Historico, KPIs, Conta Corrente e Pagamentos do Dia nao mostram dados
- O modulo financeiro esta 100% desconectado do fluxo operacional

## Solucao

Integrar o `PopupConfirmacaoFinanceira` no componente `FichaServicoTab.tsx`, que e onde o operador gerencia cada ficha de servico. O popup deve abrir quando o operador clicar em um botao "Confirmar Financeiro" visivel na ficha.

## Detalhes Tecnicos

### Arquivo a editar: `src/components/FichaServicoTab.tsx`

1. **Importar** o componente `PopupConfirmacaoFinanceira`
2. **Adicionar estado** `financeiroOpen` (boolean) para controlar a abertura do dialog
3. **Adicionar botao** "Confirmar Financeiro" (icone DollarSign) na interface da ficha, visivel quando:
   - O status da ficha for "Finalizado" ou "Em andamento" (fichas que ja foram executadas)
   - A ficha tiver um prestador atribuido
4. **Renderizar** o `<PopupConfirmacaoFinanceira>` passando:
   - `open={financeiroOpen}`
   - `onOpenChange={setFinanceiroOpen}`
   - `fichaId={fichaId}`
   - `onConfirm` que recarrega os dados da ficha

### O que NAO sera alterado

- `PopupConfirmacaoFinanceira.tsx` — ja esta pronto e funcional
- Pagina `Financeiro.tsx` e todas as abas financeiras
- Tabelas do banco de dados
- Edge functions existentes
- Logica de calculo (arredondamento para 8, margem 23%, 2 dias uteis)

### Fluxo completo apos a integracao

```text
Operador abre ficha no Chat
       |
       v
Ficha com status "Finalizado" + prestador atribuido
       |
       v
Botao "Confirmar Financeiro" aparece
       |
       v
PopupConfirmacaoFinanceira abre
       |
       v
Operador preenche valores, forma de pagamento
       |
       v
Ao confirmar:
  1. INSERT em transacoes_financeiras
  2. UPDATE adiantamentos (compensar pendentes)
  3. INSERT em conta_corrente_prestador
  4. Webhook para Make.com
       |
       v
Dados aparecem em /financeiro:
  - KPIs atualizados
  - Historico de Transacoes
  - Pagamentos do Dia (na data prevista)
  - Conta Corrente do prestador
```

### Protecao de dados existentes

- Nenhuma migracao de banco de dados
- Apenas INSERT de novos registros ao confirmar
- Dados existentes nas fichas nao sao alterados
- O botao so aparece em fichas com status adequado, evitando confirmacoes acidentais
