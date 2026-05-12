import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface FichaOption {
  id: string;
  nome_cliente: string | null;
  nome_ficha: string | null;
  status: string | null;
}

interface Props {
  value?: string | null;
  onChange: (ficha: FichaOption | null) => void;
  placeholder?: string;
}

export function BuscarFichaCombobox({ value, onChange, placeholder = "Vincular a ficha (opcional)..." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FichaOption[]>([]);
  const [selected, setSelected] = useState<FichaOption | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    (async () => {
      const { data } = await (supabase as any).from("fichas_de_servico")
        .select("id,nome_cliente,nome_ficha,status").eq("id", value).maybeSingle();
      if (data) setSelected(data as FichaOption);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      let q: any = (supabase as any).from("fichas_de_servico")
        .select("id,nome_cliente,nome_ficha,status").order("created_at", { ascending: false }).limit(30);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`id.ilike.${term},nome_cliente.ilike.${term},nome_ficha.ilike.${term}`);
      }
      const { data } = await q;
      if (!cancelled) setItems(((data as any[]) || []) as FichaOption[]);
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {selected ? `${selected.id} — ${selected.nome_cliente || selected.nome_ficha || ""}` : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite ID ou nome do cliente..." value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && <div className="py-4 text-center text-xs text-muted-foreground">Buscando...</div>}
            <CommandEmpty>Nenhuma ficha encontrada</CommandEmpty>
            <CommandGroup>
              {selected && (
                <CommandItem onSelect={() => { setSelected(null); onChange(null); setOpen(false); }}>
                  <span className="text-xs text-muted-foreground italic">Limpar seleção</span>
                </CommandItem>
              )}
              {items.map((f) => (
                <CommandItem key={f.id} value={f.id} onSelect={() => { setSelected(f); onChange(f); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === f.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm font-mono">{f.id}</span>
                    <span className="text-[10px] text-muted-foreground">{f.nome_cliente || f.nome_ficha || "—"} · {f.status || "—"}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
