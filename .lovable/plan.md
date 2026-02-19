
## Avaliacao do Prestador - Sistema de Avaliacao de Prestadores

### Resumo

Criar um sistema de avaliacao de prestadores identico ao fluxo do NPS, mas focado em avaliar o prestador que realizou o servico. A avaliacao acontece logo apos o termino do servico, **antes** do NPS final. Escala de 1 a 5.

### O que sera criado

---

### 1. Nova tabela: `avaliacao_prestador`

Estrutura espelhada no `nps_respostas`, mas com foco no prestador:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| ficha_id | text (NOT NULL) | Referencia a ficha de servico |
| telefone_cliente | text (NOT NULL) | Telefone do cliente que avalia |
| prestador_id | text | CPF do prestador avaliado |
| nota | integer | Nota de 1 a 5 |
| classificacao | text | positivo / neutro / critico |
| feedback | text | Comentario do cliente |
| tipo_feedback | text | positivo / neutro / negativo |
| enviado_em | timestamptz (NOT NULL) | Quando foi enviado |
| respondido_em | timestamptz | Quando o cliente respondeu a nota |
| feedback_respondido_em | timestamptz | Quando o cliente respondeu o feedback |
| prioridade | boolean (default false) | Marcado se nota critica |
| supervisor_alertado | boolean (default false) | Se supervisor foi alertado |
| operador_id | uuid | Quem enviou a avaliacao |
| created_at | timestamptz | Data de criacao |

Politicas RLS identicas ao `nps_respostas` (SELECT, INSERT, UPDATE para todos autenticados). Realtime habilitado.

---

### 2. Novo componente: `AvaliacaoPrestadorFlowPanel.tsx`

Copia do `NPSFlowPanel.tsx` adaptado para avaliacao do prestador:

- Botao com icone de Wrench ou UserCheck (diferente da estrela do NPS)
- Label: "Av. Prestador"
- Mensagens adaptadas:
  - Inicial: "Ola, [nome]! O servico do prestador foi finalizado. Em uma escala de 1 a 5, como voce avalia o trabalho do prestador? (Responda so com um numero)"
  - Invalida: "Pode me responder apenas com um numero de 1 a 5?"
  - Follow-up positivo: "Que otimo! O que mais gostou no trabalho do prestador?"
  - Follow-up neutro: "Obrigado! O que o prestador poderia ter feito melhor?"
  - Follow-up critico: "Obrigado pela sinceridade. O que deu errado no trabalho do prestador?"
- Tabela consultada: `avaliacao_prestador` (em vez de `nps_respostas`)
- Realtime subscription na tabela `avaliacao_prestador`
- Mesmo fluxo: idle -> waiting_score -> waiting_feedback -> completed
- Alerta de supervisor para notas 1-2 (criticas)

---

### 3. Novo componente: `AvaliacaoPrestadorMetricsKPIs.tsx`

Copia do `NPSMetricsKPIs.tsx` adaptado:

- Titulo: "Metricas de Avaliacao de Prestadores (1-5)"
- Icone diferente (Wrench em vez de Star)
- Mesmos KPIs: Indice de Satisfacao, Media Geral, % Positivas, % Criticas
- Mesma distribuicao visual (barra colorida)
- Ranking de prestadores por media de avaliacao
- Lista de avaliacoes criticas recentes
- Dados vindos da tabela `avaliacao_prestador`

---

### 4. Integracao no ChatWindow

- Adicionar o botao `AvaliacaoPrestadorFlowPanel` ao lado do botao NPS existente, na barra de ferramentas
- Ordem visual: ... | Av. Prestador | Satisfacao (NPS) | ...
- O botao de Avaliacao do Prestador vem antes do NPS, refletindo a ordem do fluxo

---

### 5. Integracao no FichasOverview

- Adicionar `AvaliacaoPrestadorMetricsKPIs` na secao de metricas, acima ou ao lado do `NPSMetricsKPIs`
- Recebe os mesmos filtros de periodo (`periodoFrom`, `periodoTo`)

---

### Arquivos envolvidos

| Acao | Arquivo |
|------|---------|
| Criar | Migracao SQL para tabela `avaliacao_prestador` + RLS + realtime |
| Criar | `src/components/AvaliacaoPrestadorFlowPanel.tsx` |
| Criar | `src/components/AvaliacaoPrestadorMetricsKPIs.tsx` |
| Editar | `src/components/ChatWindow.tsx` (adicionar botao) |
| Editar | `src/components/FichasOverview.tsx` (adicionar metricas) |

### Riscos e protecoes

- Nenhuma alteracao em tabelas ou dados existentes
- A tabela `nps_respostas` permanece intacta
- Nenhuma modificacao no fluxo NPS atual
- Dados existentes nao serao afetados de nenhuma forma
