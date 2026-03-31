

## Revisão do Plano: Transcrição Automática de Áudios

### Resumo do que o plano propõe

O plano descreve 4 entregas para transcrever automaticamente áudios recebidos via WhatsApp (clientes e prestadores) usando OpenAI Whisper:
1. Migration SQL — adicionar coluna `transcricao_texto` na tabela `mensagens`
2. Secret — armazenar `OPENAI_API_KEY` como secret
3. Edge Function `transcribe-audio` — baixa áudio do Storage, envia ao Whisper, salva transcrição
4. UI — exibir texto transcrito abaixo do player de áudio no ChatWindow

### O que está CORRETO no plano

- A arquitetura geral (Edge Function + fire-and-forget no webhook) é sólida
- A abordagem de não bloquear o webhook do Twilio está correta (limite de 15s)
- O uso de Supabase Secret para a chave OpenAI segue o padrão existente
- O padrão de CORS e service_role nas Edge Functions está alinhado com o projeto

### O que está INCORRETO ou INCOMPLETO

1. **Tabela errada para prestadores**: O plano assume que tudo vai na tabela `mensagens`, mas **mensagens de prestadores ficam em `mensagens_prestadores`** (tabela separada). A coluna `transcricao_texto` precisa ser adicionada em AMBAS as tabelas, e o webhook precisa disparar a transcrição para ambas as rotas.

2. **Áudios NÃO estão no Supabase Storage**: O plano diz que "áudios são salvos no Supabase Storage", mas na verdade o webhook salva apenas a **URL do Twilio** (`MediaUrl0`) no campo `arquivo_url`. O áudio fica hospedado nos servidores do Twilio. A Edge Function `transcribe-audio` precisa baixar o áudio **da URL do Twilio** (que requer autenticação Basic com `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`), não do Storage.

3. **Formato de áudio**: O plano diz que "o sistema já converte áudios para OGG/Opus antes de salvar". Isso está **incorreto**. A conversão para MP3 via lamejs existe apenas no `AudioRecorder` do **frontend** para envio de áudios gravados pelo operador. Áudios recebidos de prestadores/clientes via Twilio são mantidos no formato original (geralmente OGG/Opus do WhatsApp). Whisper aceita OGG, então não é problema, mas a premissa está errada.

4. **`types.ts` não pode ser editado manualmente**: O plano instrui editar `src/integrations/supabase/types.ts`, mas esse arquivo é **auto-gerado** pelo sistema e nunca deve ser editado manualmente. A coluna aparecerá automaticamente após a migration.

5. **Alternativa sem OpenAI**: O projeto já tem `LOVABLE_API_KEY` configurado e acesso a modelos Gemini que suportam áudio. Seria possível usar Gemini (google/gemini-2.5-flash) para transcrição sem precisar de uma chave OpenAI adicional. Isso simplificaria a implementação e eliminaria a Entrega 2.

6. **Escopo "prestadores"**: O título diz "áudios de prestadores" mas o plano aplica a todos os áudios (clientes + prestadores). Precisa confirmar o escopo desejado.

### Viabilidade

O plano é **viável** com as correções acima. Principais pontos de atenção:

- **Custo**: Whisper cobra ~$0.006/min. Se houver volume alto de áudios, o custo pode ser relevante. Gemini via Lovable AI seria custo zero.
- **Latência**: A transcrição leva 2-10s dependendo do tamanho do áudio. O fire-and-forget resolve isso.
- **URLs do Twilio expiram**: As MediaUrls do Twilio podem expirar. A transcrição precisa ser feita logo após o recebimento (no webhook), o que o plano já prevê.

### Resumo das correções necessárias no plano

| Item | Problema | Correção |
|------|----------|----------|
| Migration | Só menciona `mensagens` | Adicionar coluna em `mensagens` E `mensagens_prestadores` |
| Download do áudio | Assume Storage | Baixar da URL Twilio com auth Basic |
| Formato | Assume conversão OGG prévia | Não há conversão; áudio vem direto do Twilio |
| types.ts | Instrui edição manual | Remover instrução; é auto-gerado |
| API | Assume OpenAI obrigatória | Considerar Gemini (já disponível, sem custo extra) |
| Webhook | Só menciona rota clientes | Incluir rota prestadores (`mensagens_prestadores`) |

