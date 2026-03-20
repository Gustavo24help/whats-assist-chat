

# Plano: Campo de Justificativa Financeira na Ficha + Aviso no Financeiro

## Resumo
Adicionar campo opcional "Observação Financeira" na aba Valores da ficha de serviço, para explicar irregularidades. No módulo Financeiro (Pagamento Prestadores), fichas com essa observação exibem um aviso visual truncado; ao clicar, abre popup com texto completo, ficha, operador e margem negativa (se aplicável).

## 1. Migração de Banco

Adicionar 2 colunas em `fichas_de_servico`:
- `observacao_financeira` (text, nullable) — o texto da justificativa
- `observacao_financeira_por` (uuid, nullable) — ID do operador que escreveu

## 2. FichaServicoTab.tsx — Campo na aba Valores

Após o bloco de "Tempo de Serviço" (linha ~1490), adicionar:
- Textarea com label "Observação Financeira (opcional)"
- Placeholder: "Explique irregularidades nos valores, margem, etc."
- Salva via `updateFicha({ observacao_financeira: value, observacao_financeira_por: userId })`
- Só grava `observacao_financeira_por` quando o campo é preenchido pela primeira vez ou alterado

## 3. PagamentoPrestadoresTabV2.tsx — Aviso no card pendente

No card de cada ficha pendente (linha ~430):
- Buscar `observacao_financeira` e `observacao_financeira_por` na query
- Se `observacao_financeira` existir, renderizar badge/alerta amarelo com ícone ⚠ e texto truncado (primeiros ~60 chars + "...")
- onClick abre dialog/popup com:
  - Texto completo da observação
  - ID da ficha
  - Nome do operador (resolver via profiles)
  - Se margem negativa: exibir "Margem: -X.X%" em vermelho

## 4. Componente do Popup

Criar componente inline ou reutilizar Dialog simples:
- Título: "Observação Financeira — {fichaId}"
- Corpo: texto completo
- Rodapé: "Registrado por: {nome operador}" + margem se negativa

## Arquivos a modificar
- **Migração SQL**: adicionar `observacao_financeira` e `observacao_financeira_por`
- **`src/components/FichaServicoTab.tsx`**: campo textarea na aba Valores
- **`src/components/financeiro/PagamentoPrestadoresTabV2.tsx`**: badge de aviso + popup de detalhes

