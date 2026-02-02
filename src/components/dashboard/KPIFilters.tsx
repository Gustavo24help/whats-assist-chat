import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KPIFiltersProps {
  onFiltersChange: (filters: {
    categoriaId?: number;
    prestadorCpf?: string;
    clienteTelefone?: string;
  }) => void;
}

interface Categoria {
  id: number;
  nome: string;
}

interface Prestador {
  cpf: string;
  nome: string;
}

export const KPIFilters = ({ onFiltersChange }: KPIFiltersProps) => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all');
  const [selectedPrestador, setSelectedPrestador] = useState<string>('all');
  const [clienteTelefone, setClienteTelefone] = useState<string>('');

  // Fetch categorias and prestadores on mount
  useEffect(() => {
    const fetchData = async () => {
      const [categoriasResult, prestadoresResult] = await Promise.all([
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase.from('prestadores').select('cpf, nome').order('nome'),
      ]);

      if (categoriasResult.data) {
        setCategorias(categoriasResult.data);
      }
      if (prestadoresResult.data) {
        setPrestadores(prestadoresResult.data);
      }
    };

    fetchData();
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange({
      categoriaId: selectedCategoria !== 'all' ? Number(selectedCategoria) : undefined,
      prestadorCpf: selectedPrestador !== 'all' ? selectedPrestador : undefined,
      clienteTelefone: clienteTelefone.trim() || undefined,
    });
  }, [selectedCategoria, selectedPrestador, clienteTelefone, onFiltersChange]);

  const handleClearFilters = () => {
    setSelectedCategoria('all');
    setSelectedPrestador('all');
    setClienteTelefone('');
  };

  const hasActiveFilters = selectedCategoria !== 'all' || selectedPrestador !== 'all' || clienteTelefone.trim() !== '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Categoria Filter */}
      <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Categorias</SelectItem>
          {categorias.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prestador Filter */}
      <Select value={selectedPrestador} onValueChange={setSelectedPrestador}>
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <SelectValue placeholder="Prestador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Prestadores</SelectItem>
          {prestadores.map((prest) => (
            <SelectItem key={prest.cpf} value={prest.cpf}>
              {prest.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cliente Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Telefone do cliente"
          value={clienteTelefone}
          onChange={(e) => setClienteTelefone(e.target.value)}
          className="pl-8 h-9 w-[180px] text-sm"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
};
