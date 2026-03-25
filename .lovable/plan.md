

# Editar/Apagar mensagens + Botão "Copiar Info do Serviço"

## Resumo

Três funcionalidades:
1. **Editar e apagar mensagens** no chat de clientes e prestadores (via context menu)
2. **Botão "Copiar informações do serviço"** no chat de atendimento para enviar dados organizados ao prestador

---

## 1. Editar e Apagar Mensagens

### Regras de negócio
- Apenas mensagens **enviadas pelo operador** (isAtendente) podem ser editadas/apagadas
- Apenas o **próprio operador** que enviou (ou admin) pode editar/apagar
- Mensagens de **clientes/prestadores** não podem ser alteradas (veio do WhatsApp, não temos controle)
- Editar atualiza o campo `texto` na tabela; apagar faz soft-delete (texto = "[Mensagem apagada]")
- Não há como editar/apagar no WhatsApp do destinatário — apenas no sistema interno

### Alterações

**`src/components/MessageContextMenu.tsx`**
- Adicionar props: `onEdit`, `onDelete`, `canEditDelete` (boolean)
- Adicionar itens "Editar mensagem" (Pencil icon) e "Apagar mensagem" (Trash2 icon) no context menu
- Mostrar apenas quando `canEditDelete = true`
- Apagar abre confirmação inline antes de executar

**`src/components/ChatWindow.tsx`** (chat clientes)
- Criar funções `handleEditMessage(id, newText)` e `handleDeleteMessage(id)`
- `handleEditMessage`: update na tabela `mensagens` campo `texto`
- `handleDeleteMessage`: update `texto` = "[Mensagem apagada]" na tabela `mensagens`
- Passar `onEdit`, `onDelete` e `canEditDelete` ao `MessageContextMenu`
- `canEditDelete` = true se `isAtendente(msg.remetente)` e (`msg.enviado_por_id === user.id` ou `isAdmin`)

**`src/components/prestador-chat/ChatWindowPrestadores.tsx`** (chat prestadores)
- Importar e usar `MessageContextMenu` (atualmente não usa)
- Criar mesmas funções `handleEditMessage` e `handleDeleteMessage` para tabela `mensagens_prestadores`
- Envolver cada mensagem com `MessageContextMenu`

**Database**: Ambas as tabelas `mensagens` e `mensagens_prestadores` já permitem UPDATE para authenticated users — nenhuma migration necessária.

---

## 2. Botão "Copiar Info do Serviço para Prestador"

### Regras de negócio
- No chat de atendimento ao cliente, quando há ficha ativa, exibir um botão na toolbar/header
- Ao clicar, busca os dados da ficha (`fichas_de_servico`) e formata um texto organizado pronto para colar no chat de prestadores
- Texto formatado inclui: ID da ficha, nome do cliente, endereço, descrição do serviço, categoria, valores, tempo de serviço, horário agendado

### Formato do texto copiado

```text
📋 *Ficha #FS-001234*
👤 Cliente: João Silva
📍 Endereço: Rua Exemplo, 123 - Bairro
🔧 Serviço: Troca de torneira
📂 Categoria: Hidráulica
⏱ Tempo estimado: 2 horas
📅 Agendamento: 25/03/2026 às 14:00
💰 Valor total: R$ 350,00
📝 Obs: Cliente pediu para ligar antes
```

### Alterações

**`src/components/ChatWindow.tsx`**
- Criar função `handleCopyServiceInfo()` que busca a ficha ativa no banco e formata o texto
- Adicionar botão (ícone ClipboardList ou Copy) na barra de ações do header do chat, visível quando `fichaId` existe
- Copiar para clipboard e mostrar toast de sucesso

---

## Detalhes Técnicos

- Edit inline: ao clicar "Editar", o texto da mensagem vira um `<Textarea>` editável com botões Salvar/Cancelar
- Delete: soft-delete apenas (update texto), mantém registro no banco
- A cópia de info usa `navigator.clipboard.writeText()` como já feito no `MessageContextMenu`
- Para o chat de prestadores, o `MessageContextMenu` será reutilizado sem as opções de "preencher campo da ficha" (pois não se aplica)

