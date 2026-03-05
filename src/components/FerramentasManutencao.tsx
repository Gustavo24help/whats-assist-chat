import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, CheckCircle, XCircle, Activity, RefreshCw, Database, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FunctionResult {
  success: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
}

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  functionName: string;
  icon: React.ReactNode;
  method?: string;
}

const tools: ToolConfig[] = [
  {
    id: "recover-sids",
    name: "Recuperar MessageSIDs",
    description: "Busca SIDs faltantes na Twilio e preenche no banco",
    functionName: "recover-message-sids",
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: "sync-messages",
    name: "Sincronizar Mensagens",
    description: "Sincroniza mensagens recentes da Twilio",
    functionName: "sync-twilio-messages",
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    id: "reprocess-queue",
    name: "Reprocessar Fila Backup",
    description: "Reprocessa mensagens na fila de backup",
    functionName: "reprocess-backup-queue",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "monitor",
    name: "Monitor de Mensagens",
    description: "Verifica saúde e divergências nas mensagens",
    functionName: "monitor-mensagens",
    icon: <Activity className="h-4 w-4" />,
    method: "GET",
  },
];

export const FerramentasManutencao = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, FunctionResult>>({});

  const executeTool = async (tool: ToolConfig) => {
    setLoading((prev) => ({ ...prev, [tool.id]: true }));
    setResults((prev) => ({ ...prev, [tool.id]: { success: false, data: null, error: null } }));

    try {
      const method = (tool.method || "POST") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      const { data, error } = await supabase.functions.invoke(tool.functionName, {
        method,
      });

      if (error) {
        const errorMsg = error.message || error.name || 'Erro desconhecido na execução';
        setResults((prev) => ({
          ...prev,
          [tool.id]: { success: false, data: null, error: errorMsg },
        }));
        toast({
          title: "Erro",
          description: `Erro ao executar ${tool.name}: ${errorMsg}`,
          variant: "destructive",
        });
      } else {
        setResults((prev) => ({
          ...prev,
          [tool.id]: { success: true, data: data as Record<string, unknown>, error: null },
        }));
        toast({
          title: "Sucesso",
          description: `${tool.name} executado com sucesso.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults((prev) => ({
        ...prev,
        [tool.id]: { success: false, data: null, error: msg },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ferramentas de Manutenção</CardTitle>
        <CardDescription>
          Execute funções de backend sob demanda para manutenção e diagnóstico do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tools.map((tool) => (
          <div key={tool.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">{tool.icon}</div>
                <div>
                  <h4 className="text-sm font-medium">{tool.name}</h4>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => executeTool(tool)}
                disabled={loading[tool.id]}
              >
                {loading[tool.id] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading[tool.id] ? "Executando..." : "Executar"}
              </Button>
            </div>

            {results[tool.id] && (
              <div
                className={`rounded-md p-3 text-xs font-mono overflow-auto max-h-48 ${
                  results[tool.id].success
                    ? "bg-muted/50 border border-primary/20"
                    : results[tool.id].error
                    ? "bg-destructive/10 border border-destructive/20"
                    : ""
                }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  {results[tool.id].success ? (
                    <CheckCircle className="h-3 w-3 text-primary" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive" />
                  )}
                  <span className={results[tool.id].success ? "text-primary" : "text-destructive"}>
                    {results[tool.id].success ? "Sucesso" : "Erro"}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap break-all">
                  {results[tool.id].error
                    ? results[tool.id].error
                    : JSON.stringify(results[tool.id].data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
