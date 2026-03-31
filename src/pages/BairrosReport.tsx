import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MapPin, 
  Users, 
  CheckCircle, 
  XCircle, 
  Filter,
  ArrowLeft,
  TrendingUp,
  Building2,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { PageLayout } from "@/components/PageLayout";

type FilterType = "todos" | "fechados" | "nao_fechados";

interface BairroData {
  bairro: string;
  total: number;
  fechados: number;
  naoFechados: number;
  taxaConversao: number;
}

interface ClienteComBairro {
  telefone: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade?: string;
  temFichaFechada: boolean;
  fichaStatus?: string;
}

// Lista de bairros conhecidos de Curitiba e região para matching
const BAIRROS_CONHECIDOS = [
  "agua verde", "água verde", "ahú", "ahu", "alto boqueirao", "alto boqueirão", "alto da gloria", "alto da glória",
  "alto da rua xv", "atuba", "augusta", "bacacheri", "bairro alto", "barreirinha", "batel", "bigorrilho",
  "boa vista", "bom retiro", "boqueirão", "boqueirao", "butiatuvinha", "cabral", "cachoeira", "cajuru",
  "campina do siqueira", "campo comprido", "campo de santana", "capao da imbuia", "capão da imbuia",
  "capao raso", "capão raso", "cascatinha", "caximba", "centro", "centro civico", "centro cívico",
  "champagnat", "cidade industrial", "cic", "colombo", "cristo rei", "cajuru", "fazendinha",
  "fanny", "ganchinho", "guabirotuba", "guaira", "guaíra", "hauer", "hugo lange", "jardim botanico",
  "jardim botânico", "jardim das americas", "jardim das américas", "jardim social", "juveve", "juvevê",
  "lamenha pequena", "lindoia", "lindóia", "louisiana", "merces", "mercês", "mossungue", "mossunguê",
  "novo mundo", "orleans", "parolin", "pinheirinho", "pilarzinho", "portao", "portão", "prado velho",
  "reboucas", "rebouças", "riviera", "santa candida", "santa cândida", "santa felicidade",
  "santa quiteria", "santa quitéria", "santo inacio", "santo inácio", "sao braz", "são braz",
  "sao francisco", "são francisco", "sao joao", "são joão", "sao lourenco", "são lourenço",
  "sao miguel", "são miguel", "seminario", "seminário", "sitio cercado", "sítio cercado",
  "taboao", "taboão", "taruma", "tarumã", "tatuquara", "tingui", "uberaba", "umbara", "umbarà",
  "vila izabel", "vila isabel", "vista alegre", "xaxim",
  // Cidades da região metropolitana
  "sao jose dos pinhais", "são josé dos pinhais", "colombo", "pinhais", "araucaria", "araucária",
  "campo largo", "almirante tamandare", "almirante tamandaré", "piraquara", "fazenda rio grande"
];

const extractBairro = (endereco: string): string => {
  if (!endereco) return "Não informado";
  
  const enderecoLower = endereco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Tentar encontrar padrão "bairro: X" ou "bairro X"
  const bairroMatch = endereco.match(/bairro[:\s]+([^,\n\-]+)/i);
  if (bairroMatch) {
    return bairroMatch[1].trim();
  }
  
  // Procurar por bairros conhecidos no texto
  for (const bairro of BAIRROS_CONHECIDOS) {
    const bairroNormalized = bairro.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (enderecoLower.includes(bairroNormalized)) {
      // Retornar a versão capitalizada
      return bairro.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  
  // Tentar extrair de padrões comuns de endereço brasileiro
  // Exemplo: "Rua X, 123 - Bairro Y" ou "Rua X, 123, Bairro Y, Cidade"
  const parts = endereco.split(/[,\-\n]/);
  if (parts.length >= 3) {
    // Geralmente o bairro está na 3ª ou 4ª parte
    for (let i = 2; i < Math.min(parts.length, 5); i++) {
      const part = parts[i].trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const bairro of BAIRROS_CONHECIDOS) {
        const bairroNormalized = bairro.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (part.includes(bairroNormalized)) {
          return bairro.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
      }
    }
  }
  
  return "Outros";
};

const BairrosReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteComBairro[]>([]);
  const [filter, setFilter] = useState<FilterType>("todos");
  const [searchBairro, setSearchBairro] = useState("");
  const [selectedBairro, setSelectedBairro] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar clientes com endereço ou bairro
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("telefone, nome, endereco, bairro, cidade")
        .or("endereco.neq.,bairro.neq.");

      if (clientesError) throw clientesError;

      // Buscar fichas para verificar status e dados de bairro/cidade
      const { data: fichasData, error: fichasError } = await supabase
        .from("fichas_de_servico")
        .select("telefone_cliente, endereco, bairro, cidade, status");

      if (fichasError) throw fichasError;

      // Criar mapa de fichas por telefone
      const fichasMap = new Map<string, { endereco: string; bairro: string | null; cidade: string | null; status: string; fechada: boolean }[]>();
      fichasData?.forEach(ficha => {
        const current = fichasMap.get(ficha.telefone_cliente) || [];
        current.push({
          endereco: ficha.endereco || "",
          bairro: ficha.bairro || null,
          cidade: ficha.cidade || null,
          status: ficha.status || "",
          fechada: ficha.status === "Finalizado"
        });
        fichasMap.set(ficha.telefone_cliente, current);
      });

      // Processar clientes
      const clientesProcessados: ClienteComBairro[] = [];
      const telefonesProcessados = new Set<string>();

      // Helper para obter bairro com prioridade: campo dedicado > extração do endereço
      const getBairro = (
        bairroDedicado: string | null | undefined,
        endereco: string | null | undefined,
        fichasBairro?: string | null
      ): string => {
        // Prioridade 1: Campo bairro dedicado do cliente
        if (bairroDedicado && bairroDedicado.trim()) {
          return bairroDedicado.trim();
        }
        // Prioridade 2: Campo bairro da ficha
        if (fichasBairro && fichasBairro.trim()) {
          return fichasBairro.trim();
        }
        // Prioridade 3: Extração do endereço (fallback para dados históricos)
        if (endereco && endereco.trim()) {
          return extractBairro(endereco);
        }
        return "Não informado";
      };

      // Helper para obter cidade
      const getCidade = (
        cidadeDedicada: string | null | undefined,
        fichasCidade?: string | null
      ): string | undefined => {
        if (cidadeDedicada && cidadeDedicada.trim()) {
          return cidadeDedicada.trim();
        }
        if (fichasCidade && fichasCidade.trim()) {
          return fichasCidade.trim();
        }
        return undefined;
      };

      // Primeiro, processar clientes da tabela clientes
      clientesData?.forEach(cliente => {
        if (telefonesProcessados.has(cliente.telefone)) return;
        
        const fichasCliente = fichasMap.get(cliente.telefone) || [];
        const temFichaFechada = fichasCliente.some(f => f.fechada);
        const ultimaFicha = fichasCliente[fichasCliente.length - 1];
        
        // Verificar se tem algum dado de localização
        const temBairroDedicado = cliente.bairro && cliente.bairro.trim();
        const temEndereco = cliente.endereco && cliente.endereco.trim();
        const temBairroFicha = ultimaFicha?.bairro;
        const temEnderecoFicha = ultimaFicha?.endereco;
        
        if (!temBairroDedicado && !temEndereco && !temBairroFicha && !temEnderecoFicha) return;
        
        clientesProcessados.push({
          telefone: cliente.telefone,
          nome: cliente.nome,
          endereco: cliente.endereco || ultimaFicha?.endereco || "",
          bairro: getBairro(cliente.bairro, cliente.endereco, ultimaFicha?.bairro),
          cidade: getCidade(cliente.cidade, ultimaFicha?.cidade),
          temFichaFechada,
          fichaStatus: ultimaFicha?.status
        });
        telefonesProcessados.add(cliente.telefone);
      });

      // Adicionar fichas com dados de localização que não estão em clientes
      fichasData?.forEach(ficha => {
        if (telefonesProcessados.has(ficha.telefone_cliente)) return;
        
        const temBairro = ficha.bairro && ficha.bairro.trim();
        const temEndereco = ficha.endereco && ficha.endereco.trim();
        
        if (!temBairro && !temEndereco) return;
        
        clientesProcessados.push({
          telefone: ficha.telefone_cliente,
          nome: "Cliente",
          endereco: ficha.endereco || "",
          bairro: getBairro(ficha.bairro, ficha.endereco),
          cidade: getCidade(ficha.cidade),
          temFichaFechada: ficha.status === "Finalizado",
          fichaStatus: ficha.status || undefined
        });
        telefonesProcessados.add(ficha.telefone_cliente);
      });

      setClientes(clientesProcessados);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    let filtered = clientes;
    
    if (filter === "fechados") {
      filtered = filtered.filter(c => c.temFichaFechada);
    } else if (filter === "nao_fechados") {
      filtered = filtered.filter(c => !c.temFichaFechada);
    }
    
    if (selectedBairro) {
      filtered = filtered.filter(c => c.bairro === selectedBairro);
    }
    
    return filtered;
  }, [clientes, filter, selectedBairro]);

  const bairrosAgrupados = useMemo(() => {
    const bairrosMap = new Map<string, BairroData>();
    
    clientesFiltrados.forEach(cliente => {
      const existing = bairrosMap.get(cliente.bairro) || {
        bairro: cliente.bairro,
        total: 0,
        fechados: 0,
        naoFechados: 0,
        taxaConversao: 0
      };
      
      existing.total++;
      if (cliente.temFichaFechada) {
        existing.fechados++;
      } else {
        existing.naoFechados++;
      }
      existing.taxaConversao = existing.total > 0 
        ? Math.round((existing.fechados / existing.total) * 100) 
        : 0;
      
      bairrosMap.set(cliente.bairro, existing);
    });
    
    return Array.from(bairrosMap.values())
      .filter(b => searchBairro 
        ? b.bairro.toLowerCase().includes(searchBairro.toLowerCase()) 
        : true
      )
      .sort((a, b) => b.total - a.total);
  }, [clientesFiltrados, searchBairro]);

  const totais = useMemo(() => {
    return {
      total: clientesFiltrados.length,
      fechados: clientesFiltrados.filter(c => c.temFichaFechada).length,
      naoFechados: clientesFiltrados.filter(c => !c.temFichaFechada).length,
      bairrosUnicos: new Set(clientesFiltrados.map(c => c.bairro)).size
    };
  }, [clientesFiltrados]);

  const topBairros = useMemo(() => {
    return bairrosAgrupados.slice(0, 10);
  }, [bairrosAgrupados]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                Mapa de Bairros
              </h1>
              <p className="text-muted-foreground">
                Distribuição geográfica dos clientes
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Contatos</SelectItem>
                <SelectItem value="fechados">Serviços Fechados</SelectItem>
                <SelectItem value="nao_fechados">Não Fechados</SelectItem>
              </SelectContent>
            </Select>
            
            {selectedBairro && (
              <Button variant="outline" onClick={() => setSelectedBairro(null)}>
                Limpar: {selectedBairro}
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Contatos</p>
                  <p className="text-3xl font-bold">{totais.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Serviços Fechados</p>
                  <p className="text-3xl font-bold text-green-600">{totais.fechados}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Não Fechados</p>
                  <p className="text-3xl font-bold text-amber-600">{totais.naoFechados}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bairros Únicos</p>
                  <p className="text-3xl font-bold text-blue-600">{totais.bairrosUnicos}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Bairros Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 10 Bairros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topBairros.map((bairro, index) => (
                <div 
                  key={bairro.bairro} 
                  className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  onClick={() => setSelectedBairro(bairro.bairro)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}º
                      </span>
                      <span className="font-medium">{bairro.bairro}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-green-500/10 text-green-700">
                        {bairro.fechados} fechados
                      </Badge>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                        {bairro.naoFechados} pendentes
                      </Badge>
                      <span className="font-bold">{bairro.total} total</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={bairro.taxaConversao} 
                      className="h-2 flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {bairro.taxaConversao}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabela Completa */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Todos os Bairros</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar bairro..."
                  value={searchBairro}
                  onChange={(e) => setSearchBairro(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bairro</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Fechados</TableHead>
                    <TableHead className="text-right">Não Fechados</TableHead>
                    <TableHead className="text-right">Taxa Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bairrosAgrupados.map(bairro => (
                    <TableRow 
                      key={bairro.bairro}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedBairro(bairro.bairro)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {bairro.bairro}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{bairro.total}</TableCell>
                      <TableCell className="text-right text-green-600">{bairro.fechados}</TableCell>
                      <TableCell className="text-right text-amber-600">{bairro.naoFechados}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant="outline"
                          className={
                            bairro.taxaConversao >= 70 
                              ? "bg-green-500/10 text-green-700" 
                              : bairro.taxaConversao >= 40 
                                ? "bg-amber-500/10 text-amber-700"
                                : "bg-red-500/10 text-red-700"
                          }
                        >
                          {bairro.taxaConversao}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detalhes do Bairro Selecionado */}
        {selectedBairro && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Clientes em {selectedBairro}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedBairro(null)}>
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados
                      .filter(c => c.bairro === selectedBairro)
                      .map(cliente => (
                        <TableRow key={cliente.telefone}>
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell>{cliente.telefone}</TableCell>
                          <TableCell className="max-w-xs truncate" title={cliente.endereco}>
                            {cliente.endereco}
                          </TableCell>
                          <TableCell>
                            {cliente.temFichaFechada ? (
                              <Badge className="bg-green-500">Fechado</Badge>
                            ) : cliente.fichaStatus ? (
                              <Badge variant="outline">{cliente.fichaStatus}</Badge>
                            ) : (
                              <Badge variant="secondary">Sem ficha</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BairrosReport;
