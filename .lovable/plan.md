

# Botão "Copiar Info para Prestador" na Seção de Agendamento

## Contexto

Já existe a função `handleCopyServiceInfo` no `ChatWindow.tsx` que copia dados da ficha para o clipboard. A ideia é disponibilizar essa mesma funcionalidade diretamente na seção de Agendamento da ficha (dentro do `FichaServicoTab.tsx`), para que o operador possa copiar os dados do serviço no momento em que agenda, sem precisar ir ao chat.

## O que será feito

### 1. Botão na seção "Agendamento" do `FichaServicoTab.tsx`

- Adicionar um botão com ícone de cópia (📋) ao lado do título "Agendamento" (linha ~1071)
- Visível apenas quando há dados mínimos preenchidos (prestador, data de agendamento ou descrição)
- Ao clicar, monta texto formatado com os dados da ficha atual e copia para o clipboard

### 2. Dados copiados (formato WhatsApp-friendly)

```text
📋 *Ficha #ID*
👤 Cliente: Nome
📍 Endereço: Rua - Bairro - Cidade
🔧 Serviço: Descrição
📂 Categoria: Nome da categoria
👷 Prestador: Nome do prestador
📅 Agendamento: dd/MM/yyyy às HH:mm
⏱ Tempo estimado: X horas
💰 Valor total: R$ X,XX
📝 Obs: Notas
```

### 3. Implementação

- Reutiliza os dados já carregados no estado do componente (`ficha`, `prestadores`, `categorias`)
- Não faz nova query ao banco — usa o que já está em memória
- Toast de confirmação ao copiar
- Botão fica desabilitado se a ficha não tiver dados suficientes

### Também no `AgendamentoDetalhesModal.tsx` (calendário)

- Adicionar o mesmo botão de cópia no modal de detalhes do agendamento, para quem acessar pelo calendário

## Arquivo(s) alterados

- `src/components/FichaServicoTab.tsx` — botão + função de cópia na seção Agendamento
- `src/components/calendario/AgendamentoDetalhesModal.tsx` — botão de cópia no modal

