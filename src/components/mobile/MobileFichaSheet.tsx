import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: { telefone: string; nome: string; ficha_id_real?: string | null };
}

export function MobileFichaSheet({ open, onOpenChange, cliente }: Props) {
  const [ficha, setFicha] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      let q = supabase.from("fichas_de_servico").select("*").eq("telefone_cliente", cliente.telefone);
      if (cliente.ficha_id_real) q = q.eq("id", cliente.ficha_id_real);
      const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      setFicha(data);
      setLoading(false);
    };
    load();
  }, [open, cliente.telefone, cliente.ficha_id_real]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader>
          <DrawerTitle>{cliente.nome || cliente.telefone}</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="px-4 pb-6 max-h-[70dvh]">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !ficha ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Sem ficha vinculada</div>
          ) : (
            <div className="space-y-3 text-sm">
              <Field label="OS" value={ficha.numero_os || ficha.id?.slice(0, 8)} />
              <Field label="Status" value={ficha.status} />
              <Field label="Cliente" value={ficha.nome_cliente} />
              <Field label="Telefone" value={ficha.telefone_cliente} />
              <Field label="Endereço" value={ficha.endereco} />
              <Field label="Bairro" value={ficha.bairro} />
              <Field label="Cidade" value={ficha.cidade} />
              <Field label="Equipamento" value={ficha.equipamento} />
              <Field label="Defeito" value={ficha.defeito} />
              <Field label="Prestador" value={ficha.prestador_nome} />
              <Field label="Valor total" value={ficha.valor_total ? `R$ ${ficha.valor_total}` : null} />
              <Field
                label="Visita técnica"
                value={
                  ficha.data_visita_tecnica
                    ? new Date(ficha.data_visita_tecnica).toLocaleString("pt-BR")
                    : ficha.horario_visita_tecnica
                    ? new Date(ficha.horario_visita_tecnica).toLocaleString("pt-BR")
                    : null
                }
              />
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="border-b border-border/60 pb-2">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-foreground mt-0.5 break-words">{String(value)}</div>
    </div>
  );
}
