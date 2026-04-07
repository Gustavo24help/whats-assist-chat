import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowDown, Save, Users, Clock } from "lucide-react";
import { toast } from "sonner";

interface ChainEntry {
  ordem: number;
  destino_user_id: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

export function AtribuicaoCadeiaConfig() {
  const { user } = useAuth();
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [horaSaida, setHoraSaida] = useState("18:00");
  const [lembreteMinutos, setLembreteMinutos] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    // Fetch profiles
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .neq("id", user!.id);
    setProfiles((profs || []) as Profile[]);

    // Fetch chain
    const { data: chainData } = await supabase
      .from("atribuicao_cadeia" as any)
      .select("ordem, destino_user_id")
      .eq("user_id", user!.id)
      .order("ordem", { ascending: true });
    if (chainData && (chainData as any[]).length > 0) {
      setChain((chainData as any[]).map((c: any) => ({ ordem: c.ordem, destino_user_id: c.destino_user_id })));
    }

    // Fetch exit time
    const { data: exitData } = await supabase
      .from("horario_saida_previsto" as any)
      .select("hora_saida, lembrete_minutos_antes")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (exitData) {
      const d = exitData as any;
      setHoraSaida(d.hora_saida || "18:00");
      setLembreteMinutos(d.lembrete_minutos_antes ?? 15);
    }
  };

  const addEntry = () => {
    const nextOrdem = chain.length > 0 ? Math.max(...chain.map(c => c.ordem)) + 1 : 0;
    setChain([...chain, { ordem: nextOrdem, destino_user_id: null }]);
  };

  const removeEntry = (index: number) => {
    setChain(chain.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, userId: string | null) => {
    const updated = [...chain];
    updated[index] = { ...updated[index], destino_user_id: userId };
    setChain(updated);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // Delete existing chain
      await supabase
        .from("atribuicao_cadeia" as any)
        .delete()
        .eq("user_id", user.id);

      // Insert new chain
      if (chain.length > 0) {
        const rows = chain.map((c, i) => ({
          user_id: user.id,
          ordem: i,
          destino_user_id: c.destino_user_id,
        }));
        await supabase.from("atribuicao_cadeia" as any).insert(rows);
      }

      // Upsert exit time
      await supabase
        .from("horario_saida_previsto" as any)
        .upsert({
          user_id: user.id,
          hora_saida: horaSaida,
          lembrete_minutos_antes: lembreteMinutos,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      toast.success("Configurações salvas!");
    } catch (err) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const getProfileName = (id: string | null) => {
    if (!id) return "Qualquer disponível";
    return profiles.find(p => p.id === id)?.full_name || "Usuário";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Cadeia de Redistribuição
          </CardTitle>
          <CardDescription>
            Defina para quem seus chats serão redistribuídos ao deslogar. A ordem importa: o sistema tentará o primeiro da lista, depois o segundo, e assim por diante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {chain.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6 text-center font-mono">{index + 1}º</span>
              <Select
                value={entry.destino_user_id || "__any__"}
                onValueChange={(v) => updateEntry(index, v === "__any__" ? null : v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">🔄 Qualquer disponível</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeEntry(index)} className="shrink-0">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {chain.length > 0 && chain[chain.length - 1].destino_user_id !== null && (
            <p className="text-xs text-amber-600">
              💡 Dica: adicione "Qualquer disponível" como último item para garantir que sempre haverá alguém.
            </p>
          )}

          <Button variant="outline" size="sm" onClick={addEntry} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar destino
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Horário de Saída
          </CardTitle>
          <CardDescription>
            Receba um lembrete antes do seu horário de saída para deslogar e redistribuir seus chats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário previsto de saída</Label>
              <Input
                type="time"
                value={horaSaida}
                onChange={(e) => setHoraSaida(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Avisar quantos minutos antes</Label>
              <Select value={String(lembreteMinutos)} onValueChange={(v) => setLembreteMinutos(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
}
