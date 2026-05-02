import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MobileConversationList } from "@/components/mobile/MobileConversationList";
import { MobileChatScreen } from "@/components/mobile/MobileChatScreen";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  ficha_id_real?: string | null;
}

const MobileChat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Cliente | null>(null);

  // deep link via ?telefone=
  useEffect(() => {
    const telefone = searchParams.get("telefone");
    if (!telefone || selected?.telefone === telefone) return;
    (async () => {
      const { data } = await supabase.from("clientes").select("*").eq("telefone", telefone).maybeSingle();
      if (data) {
        setSelected(data as any);
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  if (selected) {
    return <MobileChatScreen cliente={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <MobileConversationList
      onSelectCliente={(c) => setSelected(c as Cliente)}
      onLogout={handleLogout}
      onOpenSettings={() => navigate("/settings")}
    />
  );
};

export default MobileChat;
