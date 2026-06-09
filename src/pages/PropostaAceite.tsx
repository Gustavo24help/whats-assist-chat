import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Proposta = {
  numero: string;
  versao: number;
  valor_total: number;
  validade_dias: number;
  dados_snapshot: any;
  aceita_em: string | null;
  aceita_por_nome: string | null;
  created_at: string;
  pdf_url: string;
  expirada: boolean;
};

const formatBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PropostaAceite() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [aceitando, setAceitando] = useState(false);
  const [aceito, setAceito] = useState<{ aceita_em: string; aceita_por_nome: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("aceitar-proposta", {
          body: undefined,
          // GET com query param via fetch direto
        });
        // fallback direto, pois invoke é POST por padrão
      } catch {}
      const url = `https://halqtsowfqkczvlvwmdd.supabase.co/functions/v1/aceitar-proposta?token=${encodeURIComponent(token)}`;
      const r = await fetch(url, { headers: { "Content-Type": "application/json" } });
      const json = await r.json();
      if (!r.ok) { setErro(json.error || "Erro ao carregar"); setLoading(false); return; }
      setProposta(json.proposta);
      if (json.proposta?.aceita_em) {
        setAceito({ aceita_em: json.proposta.aceita_em, aceita_por_nome: json.proposta.aceita_por_nome });
      }
      setLoading(false);
    })();
  }, [token]);

  const aceitar = async () => {
    if (!nome.trim()) return;
    setAceitando(true);
    try {
      const url = `https://halqtsowfqkczvlvwmdd.supabase.co/functions/v1/aceitar-proposta?token=${encodeURIComponent(token!)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const json = await r.json();
      if (!r.ok) { setErro(json.error || "Falha"); return; }
      setAceito({ aceita_em: json.aceita_em, aceita_por_nome: json.aceita_por_nome });
    } finally {
      setAceitando(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-700" /></div>;
  }

  if (erro || !proposta) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-destructive">Proposta não encontrada</h1>
          <p className="text-sm text-muted-foreground mt-2">{erro}</p>
        </div>
      </div>
    );
  }

  const d = proposta.dados_snapshot || {};
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-background rounded-lg border shadow-sm overflow-hidden">
        <div className="bg-green-700 text-white p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">24help</div>
            <div className="text-xs opacity-90">Proposta Comercial</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{proposta.numero}</div>
            <div className="text-xs opacity-90">v{proposta.versao}</div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase">Cliente</h2>
            <p className="font-semibold">{d.cliente?.nome}</p>
            {d.cliente?.cpf && <p className="text-sm text-muted-foreground">CPF/CNPJ: {d.cliente.cpf}</p>}
            {d.cliente?.endereco && <p className="text-sm text-muted-foreground">{d.cliente.endereco}</p>}
          </section>

          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Escopo</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr><th className="text-left py-1">Descrição</th><th className="text-right">Qtd</th><th className="text-right">Subtotal</th></tr>
              </thead>
              <tbody>
                {(d.itens || []).map((it: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{it.descricao}</td>
                    <td className="text-right">{it.quantidade}</td>
                    <td className="text-right">{formatBRL(it.quantidade * it.valor_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="flex justify-between items-center border-t pt-3">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-green-700">{formatBRL(proposta.valor_total)}</span>
          </section>

          {(d.prazo || d.garantia || d.pagamento) && (
            <section className="text-sm space-y-1 bg-muted/30 rounded p-3">
              {d.prazo && <p><strong>Prazo:</strong> {d.prazo}</p>}
              {d.garantia && <p><strong>Garantia:</strong> {d.garantia}</p>}
              {d.pagamento && <p><strong>Pagamento:</strong> {d.pagamento}</p>}
              <p><strong>Validade:</strong> {proposta.validade_dias} dias</p>
            </section>
          )}

          <div className="flex gap-2">
            <a href={proposta.pdf_url} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="outline" className="w-full"><FileDown className="h-4 w-4 mr-2" />Baixar PDF</Button>
            </a>
          </div>

          {aceito ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-700 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Proposta aceita</p>
              <p className="text-sm text-green-700 mt-1">
                Por <strong>{aceito.aceita_por_nome}</strong> em {new Date(aceito.aceita_em).toLocaleString("pt-BR")}
              </p>
            </div>
          ) : proposta.expirada ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
              <p className="font-semibold text-destructive">Proposta expirada</p>
              <p className="text-sm text-muted-foreground mt-1">Entre em contato para uma nova proposta.</p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-4 space-y-3">
              <Label className="text-green-800 font-semibold">Aceite digital — digite seu nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              <Button onClick={aceitar} disabled={aceitando || !nome.trim()} className="w-full bg-green-700 hover:bg-green-800">
                {aceitando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aceitar Proposta
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Ao aceitar, você concorda com os termos descritos acima.
              </p>
            </div>
          )}
        </div>

        <div className="bg-muted/40 text-center text-[10px] text-muted-foreground p-3 border-t">
          24HELP INTERMEDIACAO E GESTAO DE SERVICOS LTDA — CNPJ 85.016.434/0001-32
        </div>
      </div>
    </div>
  );
}
