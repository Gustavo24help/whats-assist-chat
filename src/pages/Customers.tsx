import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, UserPlus, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  total_services_completed: number;
  total_services_cancelled: number;
  total_spent: number;
  avg_ticket: number;
  last_service_at?: string | null;
  last_contact_at?: string | null;
  status: string;
  segment?: string | null;
  tags: string[];
  notes?: string | null;
  days_since_last_service?: number | null;
  preferred_skus: string[];
  preferred_provider_name?: string | null;
}

interface CustomerService {
  id: string;
  customer_id: string;
  ficha_id?: string | null;
  sku?: string | null;
  description?: string | null;
  service_date?: string | null;
  status: string;
  quoted_value?: number | null;
  final_value?: number | null;
  provider_name?: string | null;
  cancellation_reason?: string | null;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  last_sku_requested?: string | null;
  last_quoted_value?: number | null;
  last_contact_at?: string | null;
  total_quotes_requested: number;
  tags: string[];
  notes?: string | null;
}

async function fetchAll<T>(table: string, build: (q: any) => any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = build((supabase as any).from(table).select("*"));
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as T[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const fmtBRL = (n?: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const statusColor = (s: string) => {
  switch (s) {
    case "finalizado": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "em_garantia": return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "em_andamento": return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "orcamento_recusado":
    case "cancelado_cliente":
    case "cancelado_prestador": return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "sem_resposta": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [services, setServices] = useState<CustomerService[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [leadStatus, setLeadStatus] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, l, s] = await Promise.all([
        fetchAll<Customer>("customers", (q) => q.order("last_service_at", { ascending: false, nullsFirst: false })),
        fetchAll<Lead>("leads", (q) => q.order("last_contact_at", { ascending: false, nullsFirst: false })),
        fetchAll<CustomerService>("customer_services", (q) => q.order("service_date", { ascending: false, nullsFirst: false })),
      ]);
      setCustomers(c); setLeads(l); setServices(s);
    } catch (e: any) {
      toast.error("Erro ao carregar CRM: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => {
    const total = customers.length;
    const avgTicket = total ? customers.reduce((a, c) => a + Number(c.avg_ticket || 0), 0) / total : 0;
    const totalInteractions = services.length;
    const totalClosed = services.filter(s => s.status === "finalizado" || s.status === "em_garantia").length;
    const convRate = totalInteractions ? (totalClosed / totalInteractions) * 100 : 0;
    const churnRisk = customers.filter(c => (c.days_since_last_service ?? 0) > 90).length;
    return { total, avgTicket, convRate, churnRisk };
  }, [customers, services]);

  const leadMetrics = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter(l => l.status === "converted").length;
    const hot = leads.filter(l => l.status === "em_negociacao").length;
    const convRate = total ? (converted / total) * 100 : 0;
    return { total, convRate, hot };
  }, [leads]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (segmentFilter !== "all" && c.segment !== segmentFilter) return false;
      if (q && !`${c.name} ${c.phone}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customers, search, statusFilter, segmentFilter]);

  const reengagement = useMemo(() => {
    return services
      .filter(s => s.status === "orcamento_recusado" || s.status === "sem_resposta")
      .slice(0, 200);
  }, [services]);

  const customerById = useMemo(() => {
    const m = new Map<string, Customer>();
    customers.forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => leadStatus === "all" ? true : l.status === leadStatus);
  }, [leads, leadStatus]);

  const customerServices = (id: string) =>
    services.filter(s => s.customer_id === id);

  const promoteLead = async (leadId: string) => {
    try {
      const { error } = await supabase.rpc("promote_lead_to_customer" as any, { _lead_id: leadId });
      if (error) throw error;
      toast.success("Lead promovido a cliente");
      await load();
    } catch (e: any) { toast.error("Erro: " + e.message); }
  };

  const saveCustomerEdits = async (c: Customer, notes: string, tagsRaw: string) => {
    const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("customers").update({ notes, tags }).eq("id", c.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Atualizado");
    await load();
    setSelectedCustomer({ ...c, notes, tags });
  };

  return (
    <PageLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        <header>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">CRM de clientes reais e leads da 24help</p>
        </header>

        {/* Métricas Clientes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Clientes reais" value={metrics.total.toString()} />
          <MetricCard label="Ticket médio" value={fmtBRL(metrics.avgTicket)} />
          <MetricCard label="Conversão (fechados/total)" value={`${metrics.convRate.toFixed(1)}%`} />
          <MetricCard label="Risco de churn (>90d)" value={metrics.churnRisk.toString()} />
        </div>

        {/* Métricas Leads */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label="Total de leads" value={leadMetrics.total.toString()} />
          <MetricCard label="Conversão lead→cliente" value={`${leadMetrics.convRate.toFixed(1)}%`} />
          <MetricCard label="Leads quentes" value={leadMetrics.hot.toString()} />
        </div>

        <Tabs defaultValue="clientes">
          <TabsList>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="reengajamento">Re-engajamento</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Buscar por nome ou telefone..." className="max-w-sm"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Segmento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos segmentos</SelectItem>
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="condominio">Condomínio</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load}>Recarregar</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Total gasto</TableHead>
                      <TableHead>Serviços</TableHead>
                      <TableHead>Último serviço</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="inline animate-spin" /></TableCell></TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                    ) : filteredCustomers.map(c => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{fmtBRL(c.total_spent)}</TableCell>
                        <TableCell>{c.total_services_completed}</TableCell>
                        <TableCell>{fmtDate(c.last_service_at)}</TableCell>
                        <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RE-ENGAJAMENTO */}
          <TabsContent value="reengajamento">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Valor orçado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reengagement.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nada para re-engajar</TableCell></TableRow>
                    ) : reengagement.map(s => {
                      const c = customerById.get(s.customer_id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{c?.name ?? "—"}<div className="text-xs text-muted-foreground">{c?.phone}</div></TableCell>
                          <TableCell><Badge variant="secondary">{s.sku ?? "—"}</Badge></TableCell>
                          <TableCell>{fmtBRL(s.quoted_value)}</TableCell>
                          <TableCell>{fmtDate(s.service_date)}</TableCell>
                          <TableCell><span className={`px-2 py-1 rounded text-xs ${statusColor(s.status)}`}>{s.status}</span></TableCell>
                          <TableCell>
                            {c?.phone && (
                              <Button size="sm" variant="outline" onClick={() => window.open(`/chat?telefone=${encodeURIComponent(c.phone)}`, "_blank")}>
                                <ExternalLink className="h-3 w-3 mr-1" /> Chat
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEADS */}
          <TabsContent value="leads" className="space-y-3">
            <div className="flex gap-2">
              <Select value={leadStatus} onValueChange={setLeadStatus}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_negociacao">Em negociação</SelectItem>
                  <SelectItem value="frio">Frio</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                  <SelectItem value="converted">Convertido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Último SKU</TableHead>
                      <TableHead>Valor orçado</TableHead>
                      <TableHead>Último contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead</TableCell></TableRow>
                    ) : filteredLeads.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.phone}</TableCell>
                        <TableCell><Badge variant="secondary">{l.last_sku_requested ?? "—"}</Badge></TableCell>
                        <TableCell>{fmtBRL(l.last_quoted_value)}</TableCell>
                        <TableCell>{fmtDate(l.last_contact_at)}</TableCell>
                        <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                        <TableCell>
                          {l.status !== "converted" && (
                            <Button size="sm" onClick={() => promoteLead(l.id)}>
                              <UserPlus className="h-3 w-3 mr-1" /> Promover
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedCustomer && (
        <CustomerDetail
          customer={selectedCustomer}
          services={customerServices(selectedCustomer.id)}
          onClose={() => setSelectedCustomer(null)}
          onSave={saveCustomerEdits}
        />
      )}
    </PageLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function CustomerDetail({
  customer, services, onClose, onSave,
}: {
  customer: Customer;
  services: CustomerService[];
  onClose: () => void;
  onSave: (c: Customer, notes: string, tagsRaw: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [tagsRaw, setTagsRaw] = useState((customer.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Telefone" value={customer.phone} />
            <Info label="Status" value={customer.status} />
            <Info label="Total gasto" value={fmtBRL(customer.total_spent)} />
            <Info label="Ticket médio" value={fmtBRL(customer.avg_ticket)} />
            <Info label="Serviços fechados" value={String(customer.total_services_completed)} />
            <Info label="Cancelados" value={String(customer.total_services_cancelled)} />
            <Info label="Último serviço" value={fmtDate(customer.last_service_at)} />
            <Info label="Prestador favorito" value={customer.preferred_provider_name ?? "—"} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Tags (separadas por vírgula)</label>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="apartamento, pet, idoso" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button
            disabled={saving}
            onClick={async () => { setSaving(true); await onSave(customer, notes, tagsRaw); setSaving(false); }}
          >Salvar</Button>

          <div>
            <h3 className="font-semibold mb-2">Histórico de serviços ({services.length})</h3>
            <div className="space-y-2">
              {services.length === 0 && <p className="text-sm text-muted-foreground">Sem registros</p>}
              {services.map(s => (
                <div key={s.id} className="border rounded p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColor(s.status)}`}>{s.status}</span>
                    <span className="text-muted-foreground text-xs">{fmtDate(s.service_date)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{s.sku ?? "—"}</Badge>
                    <span className="font-medium">{fmtBRL(s.final_value ?? s.quoted_value)}</span>
                    {s.provider_name && <span className="text-xs text-muted-foreground">· {s.provider_name}</span>}
                  </div>
                  {s.description && <p className="mt-1 text-muted-foreground">{s.description}</p>}
                  {s.cancellation_reason && <p className="mt-1 text-red-600 text-xs">Motivo: {s.cancellation_reason}</p>}
                  {s.ficha_id && (
                    <a href={`/fichas/${s.ficha_id}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
                      Abrir ficha →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
