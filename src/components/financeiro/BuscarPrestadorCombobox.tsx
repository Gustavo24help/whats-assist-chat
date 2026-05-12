import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface PrestadorOption {
  id: string;
  nome: string;
  cpf?: string | null;
}

interface Props {
  value?: string | null;
  onChange: (prestador: PrestadorOption | null) => void;
  placeholder?: string;
}

export function BuscarPrestadorCombobox({ value, onChange, placeholder = "Buscar prestador..." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PrestadorOption[]>([]);
  const [selected, setSelected] = useState<PrestadorOption | null>(null);
  const [loading, setLoading] = useState(false);

  // Load selected when value changes externally
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    (async () => {
      const { data } = await supabase.from("prestadores").select("id,nome,cpf").eq("id", value).maybeSingle();
      if (data) setSelected(data as any);
    })();
  }, [value]);

  // Search
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase.from("prestadores").select("id,nome,cpf").order("nome").limit(30);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`nome.ilike.${term},cpf.ilike.${term}`);
      }
      const { data } = await q;
      if (!cancelled) setItems((data as any[]) || []);
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {selected ? selected.nome : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite nome ou CPF..." value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && <div className="py-4 text-center text-xs text-muted-foreground">Buscando...</div>}
            <CommandEmpty>Nenhum prestador encontrado</CommandEmpty>
            <CommandGroup>
              {selected && (
                <CommandItem onSelect={() => { setSelected(null); onChange(null); setOpen(false); }}>
                  <span className="text-xs text-muted-foreground italic">Limpar seleção</span>
                </CommandItem>
              )}
              {items.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => { setSelected(p); onChange(p); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === p.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm">{p.nome}</span>
                    {p.cpf && <span className="text-[10px] text-muted-foreground font-mono">{p.cpf}</span>}
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
