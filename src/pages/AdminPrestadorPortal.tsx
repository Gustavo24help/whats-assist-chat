import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrestadorPortal from "./PrestadorPortal";

interface Prestador {
  cpf: string;
  nome: string;
  telefone: string;
  categoria: string | null;
  especialidade: string | null;
  ativo: boolean;
}

export default function AdminPrestadorPortal() {
  const navigate = useNavigate();
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("prestadores")
        .select("cpf, nome, telefone, categoria, especialidade, ativo")
        .order("nome");
      setPrestadores(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = prestadores.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.nome.toLowerCase().includes(term) ||
      p.cpf.includes(term) ||
      (p.categoria && p.categoria.toLowerCase().includes(term))
    );
  });

  if (selectedCpf) {
    return (
      <PrestadorPortal
        initialCpf={selectedCpf}
        adminMode
        onBack={() => setSelectedCpf(null)}
      />
    );
  }

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">👁️ Visão Admin — Portal Prestadores</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um prestador para visualizar seu portal completo
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card
                key={p.cpf}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedCpf(p.cpf)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.nome}</CardTitle>
                    <Badge variant={p.ativo ? "default" : "secondary"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <CardDescription>CPF: {p.cpf}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {p.categoria && <p>📋 {p.categoria}</p>}
                      <p>📞 {p.telefone}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-muted-foreground text-sm col-span-full">Nenhum prestador encontrado.</p>
            )}
          </div>
        )}
      </main>
    </PageLayout>
  );
}
