
Objetivo
- Fazer a busca por nº da ficha (modo “#”) realmente retornar resultados mesmo quando o usuário atual não tem permissão de leitura direta na tabela de fichas (RLS), sem mexer em dados existentes e sem expor informações além do necessário.

Diagnóstico (o que está acontecendo agora)
- O seu ajuste de “ignorar filtros” (atendente/status) está correto e já não deveria esconder o cliente.
- Porém, o modo “#” depende deste trecho:
  - ConversationList.tsx → buscarClientesPorIdFicha() faz SELECT direto em `fichas_de_servico` (campo `id`) e salva telefones em `clientesTelefonesPorIdFicha`.
  - Se esse SELECT volta vazio (por RLS/permissão), `clientesTelefonesPorIdFicha` fica `[]` e o filtro final remove todos.
- Evidência:
  - No backend, a ficha existe: `FS2-260112` → `whatsapp:+554198739924` (confirmado via query).
  - No browser, o `clientes` GET retorna o cliente `whatsapp:+554198739924`, então o problema não é “cliente não está carregando”; é o lookup da ficha no modo “#”.

Estratégia (mais robusta e com menos risco de segurança)
- Não relaxar RLS de `fichas_de_servico` (isso pode expor dados sensíveis de fichas para qualquer usuário autenticado).
- Em vez disso, criar uma “função do backend” (Edge Function) que:
  - roda com privilégios elevados internamente,
  - aceita o termo (ex.: `FS2-260112`),
  - retorna SOMENTE os telefones correspondentes (e opcionalmente os ids encontrados),
  - e o frontend usa esse retorno para preencher `clientesTelefonesPorIdFicha`.
- Isso resolve o problema de forma definitiva mesmo com políticas de acesso restritivas.

Mudanças planejadas (código)
1) Criar uma função de backend: `search-ficha-id`
   - Local: `supabase/functions/search-ficha-id/index.ts`
   - Entrada: `{ term: string }`
   - Saída: `{ phones: string[], matchedIds?: string[] }`
   - Regras:
     - Validar `term` (min length, trim)
     - Consultar `fichas_de_servico` por `id ILIKE %term%` (e opcionalmente também `nome_ficha ILIKE %term%` para redundância)
     - Retornar lista única de `telefone_cliente`
     - Não retornar dados de ficha (status, endereço, valores etc.), apenas telefone(s) (mínimo necessário para localizar a conversa)

2) Atualizar `src/components/ConversationList.tsx` para o modo “#” usar a função de backend (em vez de SELECT direto)
   - Alterar o `useEffect` “Buscar clientes por ID da ficha de serviço” para:
     - chamar `supabase.functions.invoke('search-ficha-id', { body: { term: debouncedSearchTerm }})`
     - em sucesso: `setClientesTelefonesPorIdFicha(data.phones)`
     - em falha: logar erro + `setClientesTelefonesPorIdFicha([])` + opcional toast “Não foi possível buscar ficha agora”
   - Manter debounce existente (300ms) para evitar chamadas excessivas.
   - Opcional (recomendado): adicionar um “estado de carregamento” só para a busca por ID (ex.: `isSearchingById`) para evitar flicker e para permitir mostrar “Buscando…” ao invés de “Nenhuma conversa encontrada” durante o request.

3) Instrumentação de debug (para acabar com loop de tentativa)
   - Adicionar logs controlados (apenas em dev) no fluxo de busca por ID:
     - `searchMode`, `debouncedSearchTerm`, retorno da função (quantidade de telefones)
   - Assim, se ainda falhar, a gente confirma em 1 rodada se o problema é:
     - modo não está “id_ficha”
     - termo não chegou debounced
     - função retornou 0
     - ou o cliente não está em `clientes` por outro motivo

Validação de “não mexer em dados”
- Essa mudança não altera nenhum registro existente.
- Não muda timezone nem campos de data.
- Apenas altera como o frontend descobre “qual telefone pertence a esta ficha” no modo de busca “#”.

Critérios de aceite (o que você vai testar)
1) Em /chat:
   - Selecionar modo “#”
   - Digitar `FS2-260112`
   - A conversa do telefone `whatsapp:+554198739924` deve aparecer mesmo:
     - estando atribuída a outro atendente
     - estando com ficha “Finalizado”
2) Clique no resultado:
   - Abre a conversa normalmente
   - Regras de escrita continuam as mesmas (somente leitura / assumir, conforme já existe)

Riscos e mitigação
- Risco: a função retornar telefones de muitas fichas se o termo for curto.
  - Mitigação: exigir mínimo de caracteres (ex.: 6) ou exigir prefixo (ex.: “FS”/“FGM”) para termos muito genéricos.
- Risco: expor indevidamente a existência de fichas via busca.
  - Mitigação: manter resposta mínima (somente telefones) e exigir usuário autenticado (o token já é enviado automaticamente).
  - Se necessário, restringir por role depois (ex.: apenas supervisor/admin) — mas você pediu “mostrar tudo na busca”, então manteremos aberto para usuários autenticados do sistema.

Arquivos envolvidos
- Novo: `supabase/functions/search-ficha-id/index.ts`
- Alterar: `src/components/ConversationList.tsx`

Sequência de implementação
1) Ler políticas atuais/confirmar comportamento de SELECT em `fichas_de_servico` no client (para validar a hipótese de RLS).
2) Implementar função `search-ficha-id`.
3) Trocar o useEffect do modo “id_ficha” para usar a função.
4) Adicionar loading/UX mínimo e logs.
5) Teste end-to-end com `FS2-260112` e mais 1 ficha de controle.

Observação sobre crédito/tempo
- Esse caminho evita mais tentativas “às cegas”: ele cria um ponto único e verificável (resposta da função) para sabermos exatamente onde falha, reduzindo o número de iterações necessárias.
