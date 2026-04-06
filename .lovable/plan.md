

## Plano de Implementação

### 1. Checkbox "Material pago pela 24help" na aba de Valores da Ficha

**Problema**: Hoje o campo `material_pago_24help` só existe na tabela `transacoes_financeiras` e é configurado no popup de confirmação financeira. O operador precisa definir isso já na ficha, na aba de valores.

**Solução**:

1. **Migração de banco**: Adicionar coluna `material_pago_24help` (boolean, default false) na tabela `fichas_de_servico`.

2. **FichaServicoTab.tsx**: Adicionar um checkbox abaixo do campo "Valor Peças" com label "Material pago pela 24help". Quando marcado, salva `material_pago_24help = true` na ficha. Visualmente, o campo de peças pode mostrar uma indicação de que não entrará no líquido do prestador.

3. **PopupConfirmacaoFinanceira.tsx**: Ao abrir, carregar o valor de `material_pago_24help` da ficha como estado inicial do checkbox (pré-preenchido). Ao salvar a transação, usar esse valor.

4. **PrestadorPortal.tsx**: Ajustar a lógica de `enrichServicosWithDates` para verificar `material_pago_24help` primeiro na ficha (`fichas_de_servico.material_pago_24help`) e usar como fallback o valor de `transacoes_financeiras` (para dados legados). Isso garante compatibilidade com dados já existentes.

**Dados existentes**: Nenhum dado existente será alterado. A nova coluna tem default `false`, preservando o comportamento atual para fichas já criadas.

---

### 2. Página de Orçamentos no menu Serviços

**Solução**:

1. **Nova página `src/pages/Orcamentos.tsx`**: Página dedicada com tabela listando todos os orçamentos da tabela `orcamentos`, com:
   - Colunas: Ficha (ID), Prestador (nome via join com `prestadores`), Valor MO, Valor Peças, Valor Total, Status, Data de Criação
   - **Filtros**:
     - Data fixa ou intervalo (date picker)
     - Ficha (busca por ID)
     - Prestador (select com busca)
     - Cliente (busca por telefone/nome via ficha)
   - Ordenação por data (mais recente primeiro)

2. **Rota em App.tsx**: Adicionar rota `/orcamentos` protegida.

3. **Menu lateral (PageLayout.tsx)**: Adicionar item "Orçamentos" dentro do grupo "Serviços", usando ícone `DollarSign` ou `ClipboardList`.

---

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| Migração SQL | Adicionar `material_pago_24help` em `fichas_de_servico` |
| `FichaServicoTab.tsx` | Checkbox na seção de valores |
| `PopupConfirmacaoFinanceira.tsx` | Pré-preencher checkbox com valor da ficha |
| `PrestadorPortal.tsx` | Ler flag da ficha com fallback para transação |
| `src/pages/Orcamentos.tsx` | Nova página com tabela e filtros |
| `src/App.tsx` | Nova rota `/orcamentos` |
| `src/components/PageLayout.tsx` | Item no menu Serviços |

