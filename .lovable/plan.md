

## Plano: Popup de Pagamento ao Prestador

### O que muda

**No `PagamentoPrestadoresTabV2.tsx`**, ao clicar no botão "Pagar", em vez de executar diretamente o `marcarPago`, abre um popup (Dialog) com todas as informações do pagamento para conferência antes de confirmar.

### Conteudo do Popup

O popup terá:
- **X para fechar** (nativo do DialogContent)
- **Nome do Prestador** (destaque)
- **Nome do PIX** do prestador
- **Chave PIX** com botão de copiar
- **Banco** destino
- **Numero da Ficha** (ID)
- **Composição dos valores**:
  - Mao de Obra
  - Pecas
  - Taxa 24help (23%)
  - Total da OS
  - **Liquido Prestador** (valor a transferir, em destaque)
- **Botao "Confirmar Pagamento"** que executa o `marcarPago` existente

### Implementacao

1. Adicionar estado `pagamentoConfirm` (`FichaFinanceira | null`) no componente
2. Trocar o `onClick` do botao "Pagar" para abrir o popup em vez de chamar `marcarPago` direto
3. Criar um novo `Dialog` com layout limpo e organizado, usando o mesmo padrão visual do dialog de detalhes já existente (grid 2 colunas, Separators)
4. O botão "Confirmar Pagamento" dentro do popup chama `marcarPago(pagamentoConfirm)` e fecha o dialog

### Arquivo editado
- `src/components/financeiro/PagamentoPrestadoresTabV2.tsx`

