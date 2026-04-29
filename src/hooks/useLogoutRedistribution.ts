import { supabase } from "@/integrations/supabase/client";

const REDISTRIBUTION_FLAG = "redistribuicao-em-andamento";

export async function redistributeChats(userId: string) {
  // Set flag so popups ignore these updates
  try { localStorage.setItem(REDISTRIBUTION_FLAG, "true"); } catch {}

  try {
    // 1. Find all clients assigned to this operator
    const { data: clients } = await supabase
      .from("clientes")
      .select("telefone")
      .eq("atendente_id", userId);

    if (!clients || clients.length === 0) return;

    // 2. Get the operator's redistribution chain
    const { data: chain } = await supabase
      .from("atribuicao_cadeia" as any)
      .select("ordem, destino_user_id")
      .eq("user_id", userId)
      .order("ordem", { ascending: true });

    // 3. Get online operators (have open registro_ponto without saida_em)
    const { data: onlineRecords } = await supabase
      .from("registro_ponto" as any)
      .select("user_id")
      .is("saida_em", null);

    const onlineUserIds = new Set(
      (onlineRecords || [])
        .map((r: any) => r.user_id)
        .filter((id: string) => id !== userId)
    );

    // 4. Find the first available operator from the chain
    let targetUserId: string | null = null;

    if (chain && chain.length > 0) {
      for (const entry of chain as any[]) {
        if (entry.destino_user_id === null) {
          const anyOnline = Array.from(onlineUserIds)[0] as string | undefined;
          if (anyOnline) {
            targetUserId = anyOnline;
            break;
          }
        } else if (onlineUserIds.has(entry.destino_user_id)) {
          targetUserId = entry.destino_user_id;
          break;
        }
      }
    }

    // 5. Fallback: any online operator
    if (!targetUserId && onlineUserIds.size > 0) {
      targetUserId = Array.from(onlineUserIds)[0] as string;
    }

    // 6. Reassign all clients (set to null if no one available)
    // Use silent RPC so the takeover trigger does NOT spam notifications
    // ("Fulano atribuiu você à conversa") to the target user.
    const telefones = clients.map(c => c.telefone);

    for (let i = 0; i < telefones.length; i += 50) {
      const chunk = telefones.slice(i, i + 50);
      const { error: rpcError } = await (supabase as any).rpc(
        "redistribute_chats_silent",
        { _telefones: chunk, _target_user_id: targetUserId }
      );

      // Fallback: if RPC isn't available yet, do the legacy update
      // (this preserves current behavior — chats still migrate, just may
      // emit notifications like before).
      if (rpcError) {
        console.warn("[redistributeChats] RPC silent falhou, usando update direto:", rpcError);
        await supabase
          .from("clientes")
          .update({ atendente_id: targetUserId })
          .in("telefone", chunk);
      }
    }

    return { reassignedCount: telefones.length, targetUserId };
  } finally {
    // Clear flag after a short delay to let realtime events settle
    setTimeout(() => {
      try { localStorage.removeItem(REDISTRIBUTION_FLAG); } catch {}
    }, 3000);
  }
}
