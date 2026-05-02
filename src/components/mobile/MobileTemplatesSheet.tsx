import { useEffect, useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";

interface Template {
  id: string;
  titulo: string;
  mensagem: string;
  tag: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (texto: string) => void;
  cliente: { telefone: string; nome: string };
}

export function MobileTemplatesSheet({ open, onOpenChange, onSelect, cliente }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("mensagens_padronizadas")
        .select("id, titulo, mensagem, tag")
        .order("ordem", { ascending: true });
      setTemplates(data || []);
      setLoading(false);
    };
    load();
  }, [open]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return templates;
    return templates.filter((tp) => `${tp.titulo} ${tp.mensagem} ${tp.tag || ""}`.toLowerCase().includes(t));
  }, [templates, search]);

  const replaceVars = (msg: string) => msg.replace(/\{nome\}/gi, cliente.nome || "");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader>
          <DrawerTitle>Templates</DrawerTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar template..." className="pl-9" />
          </div>
        </DrawerHeader>
        <ScrollArea className="px-4 pb-6 max-h-[60dvh]">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nenhum template</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(replaceVars(t.mensagem))}
                  className="w-full text-left p-3 rounded-md border border-border bg-card active:bg-muted transition-colors"
                >
                  <div className="font-medium text-sm text-foreground">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                    {replaceVars(t.mensagem)}
                  </div>
                  {t.tag && (
                    <div className="mt-2 inline-block text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {t.tag}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
