
# Plano: Criar coluna comparecimento_prestador e limpar UI duplicada

## Problema
A coluna `comparecimento_prestador` nao existe na tabela `fichas_de_servico` no banco de dados. O codigo front-end ja tem a UI implementada (accordion "Comparecimento do Prestador" dentro da FichaServicoTab), mas sem a coluna, nada funciona.

Alem disso, existe uma aba "Acompanhamento" separada no FichaPanel que e redundante, pois o mesmo campo ja aparece como accordion dentro da aba "Ficha".

## Etapa 1: Criar coluna no banco de dados

Migracao SQL:
```sql
ALTER TABLE public.fichas_de_servico
ADD COLUMN IF NOT EXISTS comparecimento_prestador text;
```

Isso nao afeta dados existentes — a coluna sera nullable com default NULL.

## Etapa 2: Remover aba Acompanhamento duplicada

No `FichaPanel.tsx`, remover:
- A aba "Acompanhamento" do TabsList (linhas 172-175)
- O TabsContent correspondente (linhas 184-186)
- O import de `AcompanhamentoTab` e `ClipboardCheck`

O "Comparecimento do Prestador" ja existe como accordion dentro de `FichaServicoTab.tsx` (linhas 1091-1125), entao a aba separada e desnecessaria.

O resultado final tera apenas 2 abas (Ficha e Orcamentos), exatamente como no screenshot de referencia.

## Arquivos a editar
1. **Migracao SQL** — adicionar coluna `comparecimento_prestador`
2. **`src/components/FichaPanel.tsx`** — remover aba Acompanhamento duplicada

## O que NAO sera alterado
- `FichaServicoTab.tsx` — ja tem o accordion funcionando corretamente
- `AcompanhamentoTab.tsx` — arquivo permanece (pode ser removido depois se desejar)
- Dados existentes no banco — nenhum dado sera modificado
