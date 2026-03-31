import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { messageId, audioUrl, table } = await req.json();

    if (!messageId || !audioUrl || !table) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (table !== "mensagens" && table !== "mensagens_prestadores") {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🎙️ Transcrevendo áudio: ${messageId} (${table})`);

    // Download audio from Twilio URL (requires Basic auth)
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    let audioResponse: Response;
    if (audioUrl.includes("api.twilio.com") || audioUrl.includes("media.twiliocdn.com")) {
      if (!accountSid || !authToken) {
        throw new Error("Twilio credentials not configured");
      }
      audioResponse = await fetch(audioUrl, {
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      });
    } else {
      // For non-Twilio URLs (e.g. Supabase Storage uploads from operators)
      audioResponse = await fetch(audioUrl);
    }

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    const audioBase64 = btoa(
      String.fromCharCode(...new Uint8Array(await audioBlob.arrayBuffer()))
    );

    // Determine MIME type
    const contentType = audioResponse.headers.get("content-type") || "audio/ogg";

    // Use Gemini via LOVABLE_API_KEY for transcription
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const geminiResponse = await fetch(
      "https://ai-gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcreva o áudio a seguir para texto em português brasileiro. Retorne APENAS o texto transcrito, sem nenhuma formatação, explicação ou prefixo. Se o áudio estiver vazio ou inaudível, retorne '[Áudio inaudível]'.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${contentType};base64,${audioBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const transcricao = geminiData.choices?.[0]?.message?.content?.trim() || null;

    if (!transcricao) {
      console.log(`⚠️ Transcrição vazia para ${messageId}`);
      return new Response(JSON.stringify({ success: true, transcricao: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Transcrição: "${transcricao.substring(0, 100)}..."`);

    // Save transcription to database
    const { error: updateError } = await supabase
      .from(table)
      .update({ transcricao_texto: transcricao })
      .eq("id", messageId);

    if (updateError) {
      throw new Error(`DB update error: ${updateError.message}`);
    }

    console.log(`💾 Transcrição salva para ${messageId}`);

    return new Response(
      JSON.stringify({ success: true, transcricao }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro na transcrição:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
