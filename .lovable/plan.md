# Corrigir botão "Legenda" do Chat BETA

## Problema
O botão **Legenda** (com `HelpCircle` + emojis explicativos) foi inserido por engano **dentro** do `PopoverContent` do popover de **Tags** em `src/components/ConversationListBeta.tsx`. Por isso ele nunca aparece na barra de filtros — só apareceria se o usuário abrisse o popover de Tags, e mesmo assim como conteúdo aninhado (não como ícone). Existem ainda tags `</PopoverContent></Popover>` duplicadas (linhas 1803–1804) que mantêm o JSX válido por coincidência.

Estrutura atual (errada):
```text
<Popover Tags>
  <PopoverContent>
    ...lista de tags...
    <Popover Legenda>     <-- aninhado dentro de Tags
      ...
    </Popover>
  </PopoverContent>      <-- fechamento correto
</Popover>
  </PopoverContent>      <-- duplicado
</Popover>               <-- duplicado
```

## Correção (1 arquivo)

**Arquivo:** `src/components/ConversationListBeta.tsx` (linhas ~1688–1806)

1. Fechar corretamente o `PopoverContent` e `Popover` de Tags **logo após** o botão "Limpar seleção" (linha 1749).
2. Mover o `<Popover>` da Legenda para **fora**, ficando como **irmão** do popover de Tags, dentro do mesmo container flex da barra de filtros.
3. Remover o par `</PopoverContent></Popover>` duplicado das linhas 1803–1804.

Estrutura final esperada:
```text
<div className="flex ...">          <-- linha de filtros
  <FilterDropdown ... />
  <Popover Tags>
    <PopoverTrigger>...</PopoverTrigger>
    <PopoverContent>
      ...lista de tags + Limpar seleção...
    </PopoverContent>
  </Popover>
  <Popover Legenda>                  <-- agora irmão, visível
    <PopoverTrigger>
      <Button> HelpCircle + "Legenda" </Button>
    </PopoverTrigger>
    <PopoverContent>
      ...conteúdo da legenda (cores, ícones, UM)...
    </PopoverContent>
  </Popover>
</div>
```

## Garantias de não-regressão
- Nenhuma mudança em dados, RLS, timezones ou status de fichas.
- Apenas reorganização de JSX em um componente de UI.
- Conteúdo da legenda (textos, emojis, ícones) permanece **idêntico** ao já escrito.
- Popover de Tags continua funcionando exatamente igual (mesmas props, mesma lista, mesmo "Limpar seleção").

## Resultado visual
Na barra de filtros do Chat BETA aparecerá, ao lado do botão "Tags", um botão pequeno com ícone de interrogação e o texto "Legenda" (oculto em telas pequenas). Ao clicar, abre o popover com:
- Cor da borda do card (status da ficha)
- Ícones (📋, 🧾, 🆕, 🔥, ⏰, ⏳, ✓/✗, ✨, 🔴/🟡)
- UM (C / 24)
