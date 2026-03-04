import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  ALERTABLE_STATUSES,
  DEFAULT_STATUS_ALERT_RULES,
  parseStatusAlertRules,
  STATUS_ALERT_CONFIG_KEY,
  type StatusAlertRule,
} from "@/lib/statusAlertConfig";

export const StatusAlertSettings = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<StatusAlertRule[]>(DEFAULT_STATUS_ALERT_RULES);
  const [loading, setLoading] = useState(true);
  const [statusToAdd, setStatusToAdd] = useState<string>("");
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRules = useCallback(async (rulesToSave: StatusAlertRule[]) => {
    const payload = JSON.stringify(rulesToSave);
    const { error } = await supabase.from("configuracoes").upsert(
      {
        chave: STATUS_ALERT_CONFIG_KEY,
        valor: payload,
        descricao: "Regras de alerta por status da ficha (limite em minutos e cor)",
      },
      { onConflict: "chave" }
    );
    if (error) {
      console.error("Erro ao salvar regras de alerta:", error);
    }
  }, []);

  // Auto-save com debounce de 800ms após carregamento inicial
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistRules(rules);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [rules, persistRules]);

  useEffect(() => {
    const fetchRules = async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", STATUS_ALERT_CONFIG_KEY)
        .maybeSingle();

      setRules(parseStatusAlertRules(data?.valor));
      setLoading(false);
      // Marcar como carregado DEPOIS de setar rules para não disparar auto-save no load
      setTimeout(() => { hasLoadedRef.current = true; }, 100);
    };

    fetchRules();
  }, []);

  const availableStatuses = useMemo(
    () => ALERTABLE_STATUSES.filter((status) => !rules.some((rule) => rule.status === status)),
    [rules]
  );

  useEffect(() => {
    if (availableStatuses.length === 0) {
      setStatusToAdd("");
      return;
    }

    if (!statusToAdd || !availableStatuses.includes(statusToAdd)) {
      setStatusToAdd(availableStatuses[0]);
    }
  }, [availableStatuses, statusToAdd]);

  const updateRule = (index: number, patch: Partial<StatusAlertRule>) => {
    setRules((prev) => {
      if (patch.status && prev.some((rule, idx) => idx !== index && rule.status === patch.status)) {
        return prev;
      }

      return prev.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule));
    });
  };

  const addRule = () => {
    if (!statusToAdd) return;
    setRules((prev) => [...prev, { status: statusToAdd, maxMinutes: 60, color: "#DC2626" }]);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    await persistRules(rules);
    toast({ title: "Regras salvas", description: "As regras de alerta de status foram atualizadas." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas por Tempo em Status</CardTitle>
        <CardDescription>
          Defina por status o tempo limite (em minutos) e a cor final do alerta. Nos chats, o aviso evolui de laranja para a cor configurada conforme o tempo excedido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando regras...</p>
        ) : (
          <>
            <div className="space-y-3">
              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum status configurado. Adicione os status que devem gerar alerta.
                </p>
              )}

              {rules.map((rule, index) => {
                const statusOptions = [rule.status, ...availableStatuses];

                return (
                  <div key={`${rule.status}-${index}`} className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr_1fr_auto] gap-2 items-end p-3 border rounded-md">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={rule.status} onValueChange={(value) => updateRule(index, { status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Limite (minutos)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={rule.maxMinutes}
                        onChange={(e) => updateRule(index, { maxMinutes: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Cor final</Label>
                      <Input
                        type="color"
                        value={rule.color}
                        onChange={(e) => updateRule(index, { color: e.target.value })}
                        className="h-10 p-1"
                      />
                    </div>

                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[260px] space-y-1">
                <Label>Adicionar status</Label>
                <Select value={statusToAdd} onValueChange={setStatusToAdd} disabled={availableStatuses.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" variant="outline" onClick={addRule} disabled={!statusToAdd}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar status
              </Button>

              <Button type="button" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> Salvar regras
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
