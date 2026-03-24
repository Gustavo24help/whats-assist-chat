

# Seletor de Ficha Ativa no Chat de Prestadores com Prefixo Automático na Mensagem

## Problema
Um prestador pode estar atendendo múltiplas fichas ao mesmo tempo. Quando o operador envia mensagens, o prestador não sabe a qual serviço a mensagem se refere, causando confusão.

## Solução
Adicionar um seletor acima da caixa de mensagem que mostra apenas as fichas ativas daquele prestador (não finalizadas/perdidas). Ao selecionar uma ficha, toda mensagem enviada será automaticamente prefixada com uma referência clara à ficha, no formato:

```
📋 *Ref: FS5-260319 - Instalação de torneira*
---
Corpo da mensagem normal aqui
```

O prestador recebe no WhatsApp a mensagem completa com a referência. O operador digita apenas o corpo — o prefixo é adicionado automaticamente.

## Alterações

### 1. `ChatWindowPrestadores.tsx`
- Adicionar state `fichasAtivas` — lista de fichas onde `prestador_id = prestadorCpf` e status NOT IN ('Finalizado', 'Perdido')
- Adicionar state `fichaSelecionada` — ficha escolhida para contextualizar mensagens
- Carregar fichas ativas ao abrir o chat (useEffect com query)
- No `handleSend`: se uma ficha estiver selecionada, prefixar a mensagem com `📋 *Ref: {ficha.id} - {ficha.descricao || ficha.nome_ficha}*\n---\n` antes de enviar ao WhatsApp
- Exibir um seletor (Select ou chips) entre o header e as mensagens, mostrando as fichas ativas com ID + descrição resumida
- Permitir "Nenhuma ficha" como opção (envia sem prefixo)

### 2. UI do seletor
- Barra compacta abaixo do header: `[📋 Ficha: FS5-260319 - Instalação ▾]`
- Se só há 1 ficha ativa, já vem pré-selecionada
- Se não há fichas ativas, não exibe o seletor
- Badge colorido na ficha selecionada para destaque visual

### 3. Na mensagem salva no banco (`mensagens_prestadores`)
- O `texto` salvo inclui o prefixo completo (para histórico)
- O `ficha_id` é preenchido com a ficha selecionada

## Detalhes
- A query busca fichas por `prestador_id = prestadorCpf` (CPF do prestador, que é a FK usada em `fichas_de_servico`)
- Props `prestadorCpf` já é passado ao componente
- Não requer migração — usa dados existentes

